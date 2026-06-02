import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, PlayCircle, RotateCw, ShieldCheck, TestTube2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  checkPiHoleReachable,
  checkVpnEndpoint,
  getPiHoleAdminUrl,
  getPiHoleSummary,
  getWireGuardAppUrl,
  loadNetworkOpsConfig,
  pausePiHole,
  resumePiHole,
  runRemoteNetworkTests,
  saveNetworkOpsConfig,
  type NetworkOpsConfig,
  type NetworkTestResult,
  type PiHoleSummary,
} from '@/lib/network-ops';

type HealthChecks = {
  piholeReachable: boolean;
  vpnResolvable: boolean;
};

const DEFAULT_SUMMARY: PiHoleSummary = {
  dns_queries_today: 0,
  ads_blocked_today: 0,
  ads_percentage_today: 0,
  domains_being_blocked: 0,
  unique_clients: 0,
  status: 'disabled',
};

function statusBadgeClass(status: NetworkTestResult['status']) {
  if (status === 'pass') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40';
  if (status === 'warn') return 'bg-amber-500/15 text-amber-200 border border-amber-500/40';
  return 'bg-rose-500/15 text-rose-200 border border-rose-500/40';
}

function StatusPill({ healthy, label }: { healthy: boolean; label: string }) {
  return (
    <span className={healthy ? 'inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200' : 'inline-flex items-center rounded-full border border-rose-500/50 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-200'}>
      {label}
    </span>
  );
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-sky-900/80 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wider text-sky-200/70">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

export function NetworkOpsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<NetworkOpsConfig>(() => loadNetworkOpsConfig());
  const [summary, setSummary] = useState<PiHoleSummary>(DEFAULT_SUMMARY);
  const [checks, setChecks] = useState<HealthChecks>({ piholeReachable: false, vpnResolvable: false });
  const [tests, setTests] = useState<NetworkTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const blockingEnabled = useMemo(() => `${summary.status}`.toLowerCase() === 'enabled', [summary.status]);

  useEffect(() => {
    void refreshAll(config).finally(() => setLoading(false));
  }, []);

  async function refreshAll(activeConfig: NetworkOpsConfig = config) {
    setRefreshing(true);
    setError(null);

    try {
      const [latestSummary, piholeReachable, vpnResolvable] = await Promise.all([
        getPiHoleSummary(activeConfig),
        checkPiHoleReachable(activeConfig),
        checkVpnEndpoint(activeConfig.vpnDomain),
      ]);
      setSummary(latestSummary);
      setChecks({ piholeReachable, vpnResolvable });
    } catch (err) {
      setError((err as Error).message || 'Unable to refresh Network Ops data.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    saveNetworkOpsConfig(config);
    await refreshAll(config);
  }

  async function handlePause(seconds: number) {
    setBusyAction(`pause-${seconds}`);
    try {
      await pausePiHole(config, seconds);
      await refreshAll(config);
    } catch (err) {
      setError((err as Error).message || 'Unable to pause Pi-hole right now.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResume() {
    setBusyAction('resume');
    try {
      await resumePiHole(config);
      await refreshAll(config);
    } catch (err) {
      setError((err as Error).message || 'Unable to resume Pi-hole right now.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunTests() {
    setRunningTests(true);
    try {
      const results = await runRemoteNetworkTests(config);
      setTests(results);
    } catch (err) {
      setError((err as Error).message || 'Unable to run remote tests.');
    } finally {
      setRunningTests(false);
    }
  }

  function openPiHole() {
    window.open(getPiHoleAdminUrl(config), '_blank', 'noopener,noreferrer');
  }

  function openWireGuard() {
    window.open(getWireGuardAppUrl(), '_blank', 'noopener,noreferrer');
  }

  const passCount = tests.filter((t) => t.status === 'pass').length;
  const warnCount = tests.filter((t) => t.status === 'warn').length;
  const failCount = tests.filter((t) => t.status === 'fail').length;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_15%_0%,#0a2947_0%,#081726_40%,#050a12_100%)] px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-sky-900/60 bg-slate-950/55 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Network Ops</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-50">DarkSkyHole Control Center</h1>
              <p className="mt-2 text-sm text-slate-300/90">Built and tuned for live domains and remote diagnostics.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunTests}
                disabled={runningTests}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                title="Run remote tests"
              >
                {runningTests ? <RotateCw className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => navigate('/network-ops/guide')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-100 transition hover:bg-sky-500/20"
                title="Open guide"
              >
                <BookOpen className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill healthy={checks.piholeReachable} label={checks.piholeReachable ? 'Pi-hole reachable' : 'Pi-hole unreachable'} />
            <StatusPill healthy={checks.vpnResolvable} label={checks.vpnResolvable ? 'VPN DNS resolves' : 'VPN DNS unresolved'} />
          </div>

          {error ? <p className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Blocking" value={blockingEnabled ? 'Enabled' : 'Paused'} note={blockingEnabled ? 'Protection is currently active' : 'Tracking protection is paused'} />
          <StatCard title="Blocked Today" value={summary.ads_blocked_today.toLocaleString()} note={`${summary.ads_percentage_today.toFixed(1)}% of DNS traffic`} />
          <StatCard title="DNS Queries" value={summary.dns_queries_today.toLocaleString()} note={`Across ${summary.unique_clients} clients`} />
          <StatCard title="Domains in Gravity" value={summary.domains_being_blocked.toLocaleString()} note="Current blocklist total" />
        </section>

        <section className="rounded-2xl border border-sky-900/60 bg-slate-950/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Quick Controls</h2>
              <p className="text-sm text-slate-400">Run checks, open tools, and control ad blocking remotely.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => refreshAll(config)} className="inline-flex items-center gap-1 rounded-lg border border-sky-700/50 bg-sky-900/20 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-900/35" disabled={refreshing}>
                <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={openPiHole} className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/50 bg-cyan-900/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/35">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Pi-hole
              </button>
              <button onClick={openWireGuard} className="inline-flex items-center gap-1 rounded-lg border border-indigo-700/50 bg-indigo-900/20 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-900/35">
                <ShieldCheck className="h-3.5 w-3.5" />
                WireGuard
              </button>
              <button onClick={handleRunTests} className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/35" disabled={runningTests}>
                <PlayCircle className="h-3.5 w-3.5" />
                {runningTests ? 'Running...' : 'Run Tests'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => handlePause(300)} disabled={busyAction !== null} className="rounded-lg border border-amber-600/50 bg-amber-900/25 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40 disabled:opacity-60">Pause 5m</button>
            <button onClick={() => handlePause(1800)} disabled={busyAction !== null} className="rounded-lg border border-amber-600/50 bg-amber-900/25 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40 disabled:opacity-60">Pause 30m</button>
            <button onClick={handleResume} disabled={busyAction !== null} className="rounded-lg border border-teal-600/50 bg-teal-900/25 px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-900/40 disabled:opacity-60">Resume Now</button>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-900/60 bg-slate-950/55 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Connection Settings</h2>
          <p className="mt-1 text-sm text-slate-400">Stored in local browser storage for this account profile.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-300">VPN Domain</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                value={config.vpnDomain}
                onChange={(event) => setConfig((prev) => ({ ...prev, vpnDomain: event.target.value }))}
                placeholder="vpn.alphazonelabs.com"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-300">Pi-hole Domain</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                value={config.piholeDomain}
                onChange={(event) => setConfig((prev) => ({ ...prev, piholeDomain: event.target.value }))}
                placeholder="adblock.alphazonelabs.com"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-300">Pi-hole API Token (optional)</span>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                value={config.piholeApiToken}
                onChange={(event) => setConfig((prev) => ({ ...prev, piholeApiToken: event.target.value }))}
                placeholder="Paste API token if auth is required"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={config.preferHttps}
                onChange={(event) => setConfig((prev) => ({ ...prev, preferHttps: event.target.checked }))}
              />
              Prefer HTTPS for Pi-hole domain
            </label>
            <button onClick={handleSave} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Save Settings</button>
          </div>
        </section>

        {tests.length > 0 ? (
          <section className="rounded-2xl border border-sky-900/60 bg-slate-950/55 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Remote Test Results</h2>
                <p className="text-sm text-slate-400">Combined client-side and backend-side diagnostics.</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200">Pass {passCount}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">Warn {warnCount}</span>
                <span className="rounded-full bg-rose-500/15 px-2 py-1 text-rose-200">Fail {failCount}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {tests.map((test) => (
                <article key={`${test.source}-${test.id}`} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-100">{test.label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(test.status)}`}>
                      {test.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{test.detail}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{test.source.toUpperCase()} • {test.durationMs}ms</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/55 p-5 text-sm text-slate-300">Loading Network Ops...</div>
        ) : null}
      </div>
    </div>
  );
}
