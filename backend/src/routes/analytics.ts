import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { analyticsDomains } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

type CloudflareZone = {
  id: string;
  name: string;
  status: string;
};

type GraphqlGroup = {
  sum?: {
    requests?: number;
    pageViews?: number;
    bytes?: number;
    edgeResponseBytes?: number;
    threats?: number;
    cachedRequests?: number;
    visits?: number;
  };
  uniq?: {
    uniques?: number;
  };
  dimensions?: {
    datetime?: string;
    date?: string;
    metric?: string;
  };
};

type GraphqlResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequests1hGroups?: GraphqlGroup[];
        httpRequests1dGroups?: GraphqlGroup[];
        topPaths?: GraphqlGroup[];
        topCountries?: GraphqlGroup[];
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

function durationTokenToMs(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d+)([hdw])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (unit) {
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    case 'w':
      return amount * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function getGraphqlRangeLimitMs(message?: string) {
  if (!message) return null;
  const match = message.match(/wider than\s+([0-9]+[hdw])/i);
  const duration = match?.[1];
  return duration ? durationTokenToMs(duration) : null;
}

async function executeCloudflareGraphql(c: { env: Bindings }, query: string) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getCloudflareToken(c)}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch analytics from Cloudflare (HTTP ${response.status})`);
  }

  const result = (await response.json()) as GraphqlResponse;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? 'Failed to fetch analytics');
  }

  return result;
}

function normalizeDomainName(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/\.+$/, '');
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/[/?#].*$/, '')
      .replace(/:\d+$/, '')
      .replace(/\.+$/, '');
  }
}

function getCloudflareToken(c: { env: Bindings }) {
  const token = c.env.CLOUDFLARE_ANALYTICS_TOKEN?.trim();
  if (!token) {
    throw new Error('Cloudflare analytics token is not configured in the backend environment.');
  }

  return token;
}

async function fetchCloudflareZones(token: string, name?: string): Promise<CloudflareZone[]> {
  const params = new URLSearchParams({ per_page: '100' });
  if (name) {
    params.set('name', normalizeDomainName(name));
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: CloudflareZone[];
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.[0]?.message ?? `Cloudflare zones request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload.result ?? [];
}

async function upsertAnalyticsDomain(db: ReturnType<typeof createDb>, organizationId: string, zone: CloudflareZone) {
  const normalizedName = normalizeDomainName(zone.name);
  const status = zone.status === 'active' ? 'active' : 'inactive';
  const existing = await db.query.analyticsDomains.findFirst({
    where: and(eq(analyticsDomains.organizationId, organizationId), eq(analyticsDomains.zoneId, zone.id)),
  });

  if (existing) {
    await db
      .update(analyticsDomains)
      .set({ name: normalizedName, status, updatedAt: new Date().toISOString() })
      .where(eq(analyticsDomains.id, existing.id));
    return { id: existing.id, created: false };
  }

  const id = generateId();
  await db.insert(analyticsDomains).values({ id, organizationId, name: normalizedName, zoneId: zone.id, status });
  return { id, created: true };
}

function buildAnalyticsSnapshot(
  domainId: string,
  zoneId: string,
  range: string,
  requestGroups: GraphqlGroup[],
  topPathGroups: GraphqlGroup[],
  countryGroups: GraphqlGroup[],
) {
  const totals = requestGroups.reduce(
    (acc, group) => {
      acc.requests += group.sum?.requests ?? 0;
      acc.pageViews += group.sum?.pageViews ?? 0;
      acc.bandwidth += group.sum?.bytes ?? 0;
      acc.threats += group.sum?.threats ?? 0;
      acc.cachedRequests += group.sum?.cachedRequests ?? 0;
      acc.uniqueVisitors += group.uniq?.uniques ?? 0;
      return acc;
    },
    { requests: 0, pageViews: 0, bandwidth: 0, threats: 0, cachedRequests: 0, uniqueVisitors: 0 },
  );

  const timeseries = requestGroups.map((group) => ({
    timestamp: group.dimensions?.datetime ?? group.dimensions?.date ?? new Date().toISOString(),
    requests: group.sum?.requests ?? 0,
    visitors: group.uniq?.uniques ?? 0,
    bandwidth: group.sum?.bytes ?? 0,
    threats: group.sum?.threats ?? 0,
    cacheHits: group.sum?.cachedRequests ?? 0,
    originRequests: Math.max((group.sum?.requests ?? 0) - (group.sum?.cachedRequests ?? 0), 0),
  }));

  return {
    id: `${domainId}:${range}`,
    domainId,
    zoneId,
    metrics: {
      requests: totals.requests,
      totalRequests: totals.requests,
      uniqueVisitors: totals.uniqueVisitors,
      pageViews: totals.pageViews,
      bandwidth: totals.bandwidth,
      cacheHitRatio: totals.requests > 0 ? Number(((totals.cachedRequests / totals.requests) * 100).toFixed(2)) : 0,
      threats: totals.threats,
      botTraffic: 0,
      blockedRequests: totals.threats,
      originRequests: Math.max(totals.requests - totals.cachedRequests, 0),
      originErrors: 0,
      avgResponseTime: 0,
    },
    timeseries,
    trafficTimeseries: timeseries,
    topPages: topPathGroups
      .filter((group) => Boolean(group.dimensions?.metric))
      .map((group) => ({
        url: group.dimensions?.metric ?? '/',
        path: group.dimensions?.metric ?? '/',
        requests: group.sum?.requests ?? group.sum?.visits ?? 0,
        visitors: group.sum?.visits ?? 0,
        avgDuration: 0,
      })),
    topCountries: countryGroups.map((group) => ({
      country: group.dimensions?.metric ?? 'Unknown',
      countryCode: '',
      countryName: group.dimensions?.metric ?? 'Unknown',
      requests: group.sum?.requests ?? group.sum?.visits ?? 0,
      visitors: group.sum?.visits ?? 0,
      bandwidth: group.sum?.edgeResponseBytes ?? group.sum?.bytes ?? 0,
    })),
    securityEvents: [],
    dateFilter: { range },
    capturedAt: new Date().toISOString(),
  };
}

export const analyticsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
analyticsRouter.use('*', authMiddleware);

analyticsRouter.get('/domains', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const domains = await db.query.analyticsDomains.findMany({ where: eq(analyticsDomains.organizationId, orgId) });
  return c.json({ success: true, data: { items: domains, total: domains.length, page: 1, limit: Math.max(domains.length, 1), hasMore: false } });
});

analyticsRouter.get('/domains/zones', zValidator('query', z.object({ name: z.string().optional() })), async (c) => {
  try {
    const zones = await fetchCloudflareZones(getCloudflareToken(c), c.req.valid('query').name);
    return c.json({ success: true, data: zones });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ZONE_LOOKUP_FAILED',
          message: error instanceof Error ? error.message : 'Unable to load Cloudflare zones',
        },
      },
      502,
    );
  }
});

analyticsRouter.post('/domains/sync', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  try {
    const zones = await fetchCloudflareZones(getCloudflareToken(c));
    let created = 0;
    let updated = 0;

    for (const zone of zones) {
      const result = await upsertAnalyticsDomain(db, orgId, zone);
      if (result.created) created += 1;
      else updated += 1;
    }

    const domains = await db.query.analyticsDomains.findMany({ where: eq(analyticsDomains.organizationId, orgId) });

    return c.json({
      success: true,
      data: {
        imported: zones.length,
        created,
        updated,
        items: domains,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ZONE_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Unable to sync Cloudflare zones',
        },
      },
      502,
    );
  }
});

analyticsRouter.post('/domains', zValidator('json', z.object({ name: z.string().min(1), zoneId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { name, zoneId } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const normalizedName = normalizeDomainName(name);

  try {
    const zones = await fetchCloudflareZones(getCloudflareToken(c), normalizedName);
    const exactZone = zones.find((zone) => normalizeDomainName(zone.name) === normalizedName);

    if (!exactZone) {
      return c.json({ success: false, error: { code: 'ZONE_NOT_FOUND', message: 'No matching Cloudflare zone found.' } }, 404);
    }

    if (zoneId?.trim() && exactZone.id !== zoneId.trim()) {
      return c.json(
        {
          success: false,
          error: {
            code: 'ZONE_MISMATCH',
            message: 'The selected Cloudflare zone does not match the requested domain.',
          },
        },
        400,
      );
    }

    const result = await upsertAnalyticsDomain(db, orgId, exactZone);
    const domain = await db.query.analyticsDomains.findFirst({ where: eq(analyticsDomains.id, result.id) });
    return c.json({ success: true, data: domain }, result.created ? 201 : 200);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DOMAIN_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Unable to add Cloudflare domain',
        },
      },
      502,
    );
  }
});

analyticsRouter.delete('/domains/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const domain = await db.query.analyticsDomains.findFirst({
    where: and(eq(analyticsDomains.id, c.req.param('id')), eq(analyticsDomains.organizationId, orgId)),
  });

  if (!domain) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' } }, 404);
  }

  await db.delete(analyticsDomains).where(eq(analyticsDomains.id, domain.id));
  return c.json({ success: true, data: { id: domain.id } });
});

analyticsRouter.get('/domains/:zoneId/snapshot', zValidator('query', z.object({ since: z.string().optional(), until: z.string().optional(), range: z.string().default('24h') })), async (c) => {
  const orgId = c.get('organizationId');
  const zoneId = c.req.param('zoneId');
  const { since, until, range } = c.req.valid('query');
  const db = createDb(c.env.DB);

  const domain = await db.query.analyticsDomains.findFirst({
    where: and(eq(analyticsDomains.organizationId, orgId), eq(analyticsDomains.zoneId, zoneId)),
  });

  if (!domain) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Analytics domain not found' } }, 404);
  }

  const now = new Date();
  let sinceDate: Date;

  switch (range) {
    case '1h': sinceDate = new Date(now.getTime() - 60 * 60 * 1000); break;
    case '6h': sinceDate = new Date(now.getTime() - 6 * 60 * 60 * 1000); break;
    case '7d': sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case '30d': sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case '90d': sinceDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
    default: sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const sinceStr = since ?? sinceDate.toISOString();
  const untilStr = until ?? now.toISOString();
  const untilDate = new Date(untilStr);
  const requestedSpanMs = new Date(untilStr).getTime() - new Date(sinceStr).getTime();
  const useDailyGroups = requestedSpanMs > 3 * 24 * 60 * 60 * 1000;
  const maxBreakdownWindowMs = 30 * 24 * 60 * 60 * 1000;
  let topBreakdownSince = requestedSpanMs > maxBreakdownWindowMs
    ? new Date(untilDate.getTime() - maxBreakdownWindowMs).toISOString()
    : sinceStr;

  const analyticsNode = useDailyGroups
    ? `httpRequests1dGroups(limit: 120, filter: { date_geq: "${sinceStr.split('T')[0]}", date_leq: "${untilStr.split('T')[0]}" }) {
          sum { requests, pageViews, bytes, threats, cachedRequests, cachedBytes }
          uniq { uniques }
          dimensions { date }
        }`
    : `httpRequests1hGroups(limit: 168, filter: { datetime_geq: "${sinceStr}", datetime_leq: "${untilStr}" }) {
          sum { requests, pageViews, bytes, threats, cachedRequests, cachedBytes }
          uniq { uniques }
          dimensions { datetime }
        }`;

  const analyticsQuery = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        ${analyticsNode}
      }
    }
  }`;

  try {
    const analyticsResult = await executeCloudflareGraphql(c, analyticsQuery);
    const analyticsZone = analyticsResult.data?.viewer?.zones?.[0];
    const requestGroups = useDailyGroups ? (analyticsZone?.httpRequests1dGroups ?? []) : (analyticsZone?.httpRequests1hGroups ?? []);

    const buildBreakdownQuery = (breakdownSince: string) => {
      const breakdownFilter = `filter: { AND: [{ datetime_geq: "${breakdownSince}", datetime_leq: "${untilStr}" }, { requestSource: "eyeball" }] }`;

      return `{
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            topPaths: httpRequestsAdaptiveGroups(${breakdownFilter}, limit: 10, orderBy: [sum_edgeResponseBytes_DESC]) {
              sum { visits, edgeResponseBytes }
              dimensions { metric: clientRequestPath }
            }
            topCountries: httpRequestsAdaptiveGroups(${breakdownFilter}, limit: 10, orderBy: [sum_visits_DESC]) {
              sum { visits, edgeResponseBytes }
              dimensions { metric: clientCountryName }
            }
          }
        }
      }`;
    };

    let topPaths: GraphqlGroup[] = [];
    let topCountries: GraphqlGroup[] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const breakdownResult = await executeCloudflareGraphql(c, buildBreakdownQuery(topBreakdownSince));
        const breakdownZone = breakdownResult.data?.viewer?.zones?.[0];
        topPaths = breakdownZone?.topPaths ?? [];
        topCountries = breakdownZone?.topCountries ?? [];
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch analytics breakdowns';
        const rangeLimitMs = getGraphqlRangeLimitMs(message);

        if (!rangeLimitMs) {
          break;
        }

        const clampedSince = new Date(untilDate.getTime() - rangeLimitMs).toISOString();
        if (clampedSince >= topBreakdownSince) {
          break;
        }

        topBreakdownSince = clampedSince;
      }
    }

    return c.json({ success: true, data: buildAnalyticsSnapshot(domain.id, zoneId, range, requestGroups, topPaths, topCountries) });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch analytics',
        },
      },
      502,
    );
  }
});