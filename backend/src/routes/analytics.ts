import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { analyticsDomains } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const analyticsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
analyticsRouter.use('*', authMiddleware);

// ─── Domains ──────────────────────────────────────────────────────────────────

analyticsRouter.get('/domains', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const domains = await db.query.analyticsDomains.findMany({ where: eq(analyticsDomains.organizationId, orgId) });
  return c.json({ success: true, data: domains });
});

analyticsRouter.post('/domains', zValidator('json', z.object({ name: z.string().min(1), zoneId: z.string().min(1) })), async (c) => {
  const orgId = c.get('organizationId');
  const { name, zoneId } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const id = generateId();
  await db.insert(analyticsDomains).values({ id, organizationId: orgId, name, zoneId, status: 'active' });
  const domain = await db.query.analyticsDomains.findFirst({ where: eq(analyticsDomains.id, id) });
  return c.json({ success: true, data: domain }, 201);
});

// ─── Fetch Analytics from Cloudflare ─────────────────────────────────────────

analyticsRouter.get('/zones/:zoneId', zValidator('query', z.object({ since: z.string().optional(), until: z.string().optional(), range: z.string().default('24h') })), async (c) => {
  const zoneId = c.req.param('zoneId');
  const { since, until, range } = c.req.valid('query');

  // Calculate date range
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

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequests1hGroups(limit: 168, filter: { datetime_geq: "${sinceStr}", datetime_leq: "${untilStr}" }) {
          sum { requests, pageViews, bytes, threats, cachedRequests, cachedBytes }
          uniq { uniques }
          dimensions { datetime }
        }
        topCountries: httpRequests1dGroups(limit: 30, filter: { date_geq: "${sinceStr.split('T')[0]}", date_leq: "${untilStr.split('T')[0]}" }) {
          sum { requests, bytes }
          dimensions { clientCountryName }
        }
      }
    }
  }`;

  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.CLOUDFLARE_ANALYTICS_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!resp.ok) {
    return c.json({ success: false, error: { code: 'ANALYTICS_ERROR', message: 'Failed to fetch analytics' } }, 502);
  }

  const result = await resp.json() as Record<string, unknown>;
  return c.json({ success: true, data: result });
});
