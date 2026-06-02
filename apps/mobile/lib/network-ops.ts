import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';

const CONFIG_KEY = 'sparqplug_network_ops_config_v1';

export type NetworkOpsConfig = {
  vpnDomain: string;
  piholeDomain: string;
  piholeApiToken: string;
  preferHttps: boolean;
};

export type PiHoleSummary = {
  dns_queries_today: number;
  ads_blocked_today: number;
  ads_percentage_today: number;
  domains_being_blocked: number;
  unique_clients: number;
  status: 'enabled' | 'disabled' | string;
};

export type NetworkTestStatus = 'pass' | 'fail' | 'warn';

export type NetworkTestResult = {
  id: string;
  label: string;
  status: NetworkTestStatus;
  detail: string;
  durationMs: number;
  source: 'client' | 'backend';
};

const DEFAULT_CONFIG: NetworkOpsConfig = {
  vpnDomain: 'vpn.alphazonelabs.com',
  piholeDomain: 'adblock.alphazonelabs.com',
  piholeApiToken: '',
  preferHttps: false,
};

function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function nowMs(): number {
  return Date.now();
}

function withProtocol(hostOrDomain: string, preferHttps: boolean): string {
  const trimmed = hostOrDomain.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  return `${preferHttps ? 'https' : 'http'}://${trimmed}`;
}

function buildPiHoleBase(config: NetworkOpsConfig): string {
  return withProtocol(normalizeDomain(config.piholeDomain), config.preferHttps);
}

function makeTestResult(base: Omit<NetworkTestResult, 'durationMs'>, startedAt: number): NetworkTestResult {
  return {
    ...base,
    durationMs: Math.max(1, nowMs() - startedAt),
  };
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: '*/*' },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

type DnsOverHttpsAnswer = {
  data?: string;
  type?: number;
};

type DnsOverHttpsResponse = {
  Status?: number;
  Answer?: DnsOverHttpsAnswer[];
};

async function lookupPublicDnsA(hostname: string): Promise<string[]> {
  const name = normalizeDomain(hostname);
  if (!name) return [];

  const query = new URLSearchParams({ name, type: 'A' }).toString();
  const json = await fetchJson<DnsOverHttpsResponse>(`https://cloudflare-dns.com/dns-query?${query}`);
  const answers = json.Answer ?? [];

  return answers
    .filter((answer) => answer.type === 1 && typeof answer.data === 'string')
    .map((answer) => (answer.data ?? '').trim())
    .filter(Boolean);
}

function withAuthParam(config: NetworkOpsConfig): string {
  return config.piholeApiToken.trim() ? `&auth=${encodeURIComponent(config.piholeApiToken.trim())}` : '';
}

export async function loadNetworkOpsConfig(): Promise<NetworkOpsConfig> {
  const raw = await SecureStore.getItemAsync(CONFIG_KEY);
  if (!raw) return DEFAULT_CONFIG;

  try {
    const parsed = JSON.parse(raw) as Partial<NetworkOpsConfig>;
    return {
      vpnDomain: parsed.vpnDomain ? normalizeDomain(parsed.vpnDomain) : DEFAULT_CONFIG.vpnDomain,
      piholeDomain: parsed.piholeDomain ? normalizeDomain(parsed.piholeDomain) : DEFAULT_CONFIG.piholeDomain,
      piholeApiToken: parsed.piholeApiToken ?? '',
      preferHttps: Boolean(parsed.preferHttps),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveNetworkOpsConfig(config: NetworkOpsConfig): Promise<void> {
  const normalized: NetworkOpsConfig = {
    ...config,
    vpnDomain: normalizeDomain(config.vpnDomain),
    piholeDomain: normalizeDomain(config.piholeDomain),
  };
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(normalized));
}

export async function getPiHoleSummary(config: NetworkOpsConfig): Promise<PiHoleSummary> {
  const base = buildPiHoleBase(config);
  const auth = withAuthParam(config);
  return fetchJson<PiHoleSummary>(`${base}/admin/api.php?summaryRaw${auth}`);
}

export async function pausePiHole(config: NetworkOpsConfig, seconds: number): Promise<void> {
  const base = buildPiHoleBase(config);
  const auth = withAuthParam(config);
  await fetchJson(`${base}/admin/api.php?disable=${Math.max(1, Math.floor(seconds))}${auth}`);
}

export async function resumePiHole(config: NetworkOpsConfig): Promise<void> {
  const base = buildPiHoleBase(config);
  const auth = withAuthParam(config);
  await fetchJson(`${base}/admin/api.php?enable${auth}`);
}

export async function checkPiHoleReachable(config: NetworkOpsConfig): Promise<boolean> {
  const base = buildPiHoleBase(config);
  try {
    const text = await fetchText(`${base}/admin/login`);
    return text.toLowerCase().includes('pi-hole');
  } catch {
    return false;
  }
}

export async function checkVpnEndpoint(vpnDomain: string): Promise<boolean> {
  const normalized = normalizeDomain(vpnDomain);
  if (!normalized) return false;

  try {
    const ips = await lookupPublicDnsA(normalized);
    return ips.length > 0;
  } catch {
    return false;
  }
}

export async function runClientNetworkTests(config: NetworkOpsConfig): Promise<NetworkTestResult[]> {
  const tests: NetworkTestResult[] = [];

  {
    const started = nowMs();
    try {
      const ips = await lookupPublicDnsA(config.vpnDomain);
      tests.push(
        makeTestResult(
          {
            id: 'vpn-public-dns',
            label: 'VPN public DNS lookup',
            status: ips.length > 0 ? 'pass' : 'fail',
            detail: ips.length > 0 ? `Resolved A records: ${ips.join(', ')}` : 'No public A records found for VPN domain.',
            source: 'client',
          },
          started,
        ),
      );
    } catch (err) {
      tests.push(
        makeTestResult(
          {
            id: 'vpn-public-dns',
            label: 'VPN public DNS lookup',
            status: 'fail',
            detail: (err as Error).message || 'Public DNS lookup failed.',
            source: 'client',
          },
          started,
        ),
      );
    }
  }

  {
    const started = nowMs();
    try {
      const text = await fetchText(`${buildPiHoleBase(config)}/admin/login`, 7000);
      const ok = text.toLowerCase().includes('pi-hole');
      tests.push(
        makeTestResult(
          {
            id: 'pihole-admin',
            label: 'Pi-hole admin reachability',
            status: ok ? 'pass' : 'fail',
            detail: ok ? 'Pi-hole admin login page is reachable.' : 'Pi-hole responded but login signature was not detected.',
            source: 'client',
          },
          started,
        ),
      );
    } catch (err) {
      tests.push(
        makeTestResult(
          {
            id: 'pihole-admin',
            label: 'Pi-hole admin reachability',
            status: 'fail',
            detail: (err as Error).message || 'Pi-hole admin is not reachable from this device.',
            source: 'client',
          },
          started,
        ),
      );
    }
  }

  {
    const started = nowMs();
    try {
      const summary = await getPiHoleSummary(config);
      tests.push(
        makeTestResult(
          {
            id: 'pihole-summary-api',
            label: 'Pi-hole summary API',
            status: 'pass',
            detail: `Queries today: ${summary.dns_queries_today.toLocaleString()} • Blocked: ${summary.ads_blocked_today.toLocaleString()}`,
            source: 'client',
          },
          started,
        ),
      );
    } catch (err) {
      tests.push(
        makeTestResult(
          {
            id: 'pihole-summary-api',
            label: 'Pi-hole summary API',
            status: 'fail',
            detail: (err as Error).message || 'Could not query Pi-hole API summary.',
            source: 'client',
          },
          started,
        ),
      );
    }
  }

  {
    const started = nowMs();
    try {
      const ip = (await fetchText('https://api.ipify.org', 6000)).trim();
      tests.push(
        makeTestResult(
          {
            id: 'public-egress-ip',
            label: 'Public egress IP',
            status: ip ? 'pass' : 'warn',
            detail: ip ? `Current public IP: ${ip}` : 'Could not determine public IP.',
            source: 'client',
          },
          started,
        ),
      );
    } catch (err) {
      tests.push(
        makeTestResult(
          {
            id: 'public-egress-ip',
            label: 'Public egress IP',
            status: 'warn',
            detail: (err as Error).message || 'Public IP lookup failed.',
            source: 'client',
          },
          started,
        ),
      );
    }
  }

  return tests;
}

type BackendRemoteTestsPayload = {
  success: boolean;
  data?: {
    tests?: NetworkTestResult[];
  };
};

export async function runRemoteNetworkTests(config: NetworkOpsConfig): Promise<NetworkTestResult[]> {
  const clientTests = await runClientNetworkTests(config);

  try {
    const payload = await api.get<BackendRemoteTestsPayload>('/services/network-ops/remote-tests', {
      vpnDomain: normalizeDomain(config.vpnDomain),
      piholeDomain: normalizeDomain(config.piholeDomain),
    });

    const backendTests = (payload.data?.tests ?? []).map((test) => ({
      ...test,
      source: 'backend' as const,
    }));

    return [...clientTests, ...backendTests];
  } catch (err) {
    const started = nowMs();
    const backendUnavailable = makeTestResult(
      {
        id: 'backend-remote-tests',
        label: 'Backend remote checks',
        status: 'warn',
        detail: (err as Error).message || 'Backend remote tests were unavailable for this session.',
        source: 'backend',
      },
      started,
    );

    return [...clientTests, backendUnavailable];
  }
}

export function getPiHoleAdminUrl(config: NetworkOpsConfig): string {
  return `${buildPiHoleBase(config)}/admin`;
}

export function getWireGuardAppUrl(): string {
  return 'wireguard://';
}
