import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { services, clientServices, serviceExpenseLogs, companies } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/utils';

export const servicesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
servicesRouter.use('*', authMiddleware);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  category: z.enum(['hosting', 'email', 'auth', 'storage', 'database', 'cdn', 'payments', 'analytics', 'communications', 'productivity', 'other']).default('other'),
  billingType: z.enum(['fixed', 'per_seat', 'usage']),
  unitCostCents: z.number().int().min(0).default(0),
  defaultMarkupPct: z.number().min(0).max(1000).default(0),
  currency: z.string().default('USD'),
  billingCycle: z.enum(['monthly', 'annual', 'one_time']).default('monthly'),
  logoUrl: z.string().url().optional().nullable(),
  url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const ClientServiceSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  overrideCostCents: z.number().int().min(0).optional().nullable(),
  billedAmountCents: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const ExpenseLogSchema = z.object({
  serviceId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  actualCostCents: z.number().int().min(0),
  invoiceRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(
    z.object({
      companyId: z.string(),
      pct: z.number().min(0).max(100),
      billedAmountCents: z.number().int().min(0),
    }),
  ).default([]),
});

const NetworkOpsRemoteTestsSchema = z.object({
  vpnDomain: z.string().min(3),
  piholeDomain: z.string().min(3),
});

type RemoteTestStatus = 'pass' | 'fail' | 'warn';

type RemoteNetworkTest = {
  id: string;
  label: string;
  status: RemoteTestStatus;
  detail: string;
  durationMs: number;
  source: 'backend';
};

function normalizeDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runRemoteTest(
  id: string,
  label: string,
  fn: () => Promise<{ status: RemoteTestStatus; detail: string }>,
): Promise<RemoteNetworkTest> {
  const startedAt = Date.now();

  try {
    const result = await fn();
    return {
      id,
      label,
      status: result.status,
      detail: result.detail,
      durationMs: Math.max(1, Date.now() - startedAt),
      source: 'backend',
    };
  } catch (err) {
    return {
      id,
      label,
      status: 'fail',
      detail: err instanceof Error ? err.message : 'Test failed due to an unknown error.',
      durationMs: Math.max(1, Date.now() - startedAt),
      source: 'backend',
    };
  }
}

// ─── Service Catalog CRUD ─────────────────────────────────────────────────────

servicesRouter.get('/network-ops/remote-tests', zValidator('query', NetworkOpsRemoteTestsSchema), async (c) => {
  const { vpnDomain, piholeDomain } = c.req.valid('query');
  const cleanVpnDomain = normalizeDomain(vpnDomain);
  const cleanPiHoleDomain = normalizeDomain(piholeDomain);
  const requestOrigin = new URL(c.req.url).origin;

  const tests: RemoteNetworkTest[] = [];

  tests.push(await runRemoteTest('api-health', 'Backend health endpoint', async () => {
    const response = await fetchWithTimeout(`${requestOrigin}/health`, { method: 'GET' }, 6000);
    if (!response.ok) {
      return { status: 'fail', detail: `Health endpoint returned HTTP ${response.status}.` };
    }
    return { status: 'pass', detail: `Health endpoint responded HTTP ${response.status}.` };
  }));

  tests.push(await runRemoteTest('vpn-public-dns', 'VPN public DNS lookup', async () => {
    const params = new URLSearchParams({ name: cleanVpnDomain, type: 'A' }).toString();
    const response = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?${params}`, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
    }, 7000);

    if (!response.ok) {
      return { status: 'fail', detail: `DNS lookup request failed with HTTP ${response.status}.` };
    }

    const payload = await response.json() as { Answer?: Array<{ type?: number; data?: string }>; Status?: number };
    const ips = (payload.Answer ?? [])
      .filter((answer) => answer.type === 1 && typeof answer.data === 'string')
      .map((answer) => (answer.data ?? '').trim())
      .filter(Boolean);

    if (ips.length === 0) {
      return { status: 'fail', detail: 'No public A records found for VPN domain.' };
    }

    return { status: 'pass', detail: `Resolved A records: ${ips.join(', ')}` };
  }));

  tests.push(await runRemoteTest('backend-egress-ip', 'Backend public egress IP', async () => {
    const response = await fetchWithTimeout('https://api.ipify.org', { method: 'GET' }, 6000);
    if (!response.ok) {
      return { status: 'warn', detail: `Could not retrieve egress IP (HTTP ${response.status}).` };
    }
    const ip = (await response.text()).trim();
    return { status: ip ? 'pass' : 'warn', detail: ip ? `Backend egress IP: ${ip}` : 'No IP text returned by provider.' };
  }));

  tests.push(await runRemoteTest('pihole-public-exposure', 'Pi-hole public exposure check', async () => {
    try {
      const response = await fetchWithTimeout(`http://${cleanPiHoleDomain}/admin/login`, {
        method: 'GET',
        redirect: 'manual',
      }, 5000);

      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return {
          status: 'warn',
          detail: `Pi-hole admin appears reachable from the public internet (HTTP ${response.status}).`,
        };
      }

      return {
        status: 'pass',
        detail: `Pi-hole admin not publicly reachable with a successful response (HTTP ${response.status}).`,
      };
    } catch {
      return {
        status: 'pass',
        detail: 'Pi-hole admin is not publicly reachable from backend context (expected for private setup).',
      };
    }
  }));

  return c.json({
    success: true,
    data: {
      executedAt: new Date().toISOString(),
      tests,
    },
  });
});

servicesRouter.get('/', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.organizationId, orgId))
    .orderBy(desc(services.createdAt));
  return c.json({ success: true, data: rows });
});

servicesRouter.post('/', zValidator('json', ServiceSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  const row = { id: generateId(), organizationId: orgId, createdBy: userId, ...body };
  await db.insert(services).values(row);
  return c.json({ success: true, data: row }, 201);
});

servicesRouter.put('/:id', zValidator('json', ServiceSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { id } = c.req.param();
  const body = c.req.valid('json');

  await db
    .update(services)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(and(eq(services.id, id), eq(services.organizationId, orgId)));
  const row = await db.query.services.findFirst({ where: and(eq(services.id, id), eq(services.organizationId, orgId)) });
  return c.json({ success: true, data: row });
});

servicesRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { id } = c.req.param();
  await db.delete(services).where(and(eq(services.id, id), eq(services.organizationId, orgId)));
  return c.json({ success: true });
});

// ─── Client Service Assignments ───────────────────────────────────────────────

// GET /services/clients/:companyId  — all services for a company
servicesRouter.get('/clients/:companyId', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { companyId } = c.req.param();

  const rows = await db
    .select({
      assignment: clientServices,
      service: services,
    })
    .from(clientServices)
    .innerJoin(services, eq(clientServices.serviceId, services.id))
    .where(and(eq(clientServices.organizationId, orgId), eq(clientServices.companyId, companyId)))
    .orderBy(desc(clientServices.createdAt));

  return c.json({ success: true, data: rows });
});

// POST /services/clients/:companyId
servicesRouter.post('/clients/:companyId', zValidator('json', ClientServiceSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const { companyId } = c.req.param();
  const body = c.req.valid('json');

  const row = { id: generateId(), organizationId: orgId, companyId, createdBy: userId, ...body };
  await db.insert(clientServices).values(row);
  return c.json({ success: true, data: row }, 201);
});

servicesRouter.put('/clients/:assignmentId', zValidator('json', ClientServiceSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { assignmentId } = c.req.param();
  const body = c.req.valid('json');

  await db
    .update(clientServices)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(and(eq(clientServices.id, assignmentId), eq(clientServices.organizationId, orgId)));
  return c.json({ success: true });
});

servicesRouter.delete('/clients/:assignmentId', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { assignmentId } = c.req.param();
  await db.delete(clientServices).where(and(eq(clientServices.id, assignmentId), eq(clientServices.organizationId, orgId)));
  return c.json({ success: true });
});

// ─── Expense Logs (usage-based) ───────────────────────────────────────────────

// GET /services/expenses?period=2026-05
servicesRouter.get(
  '/expenses',
  zValidator('query', z.object({ period: z.string().optional(), serviceId: z.string().optional() })),
  async (c) => {
    const orgId = c.get('organizationId');
    const db = createDb(c.env.DB);
    const { period, serviceId } = c.req.valid('query');

    const conditions = [eq(serviceExpenseLogs.organizationId, orgId)];
    if (period) conditions.push(eq(serviceExpenseLogs.period, period));
    if (serviceId) conditions.push(eq(serviceExpenseLogs.serviceId, serviceId));

    const rows = await db
      .select({ log: serviceExpenseLogs, service: services })
      .from(serviceExpenseLogs)
      .innerJoin(services, eq(serviceExpenseLogs.serviceId, services.id))
      .where(and(...conditions))
      .orderBy(desc(serviceExpenseLogs.period));

    return c.json({ success: true, data: rows });
  },
);

servicesRouter.post('/expenses', zValidator('json', ExpenseLogSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  const row = { id: generateId(), organizationId: orgId, createdBy: userId, ...body };
  await db.insert(serviceExpenseLogs).values(row);
  return c.json({ success: true, data: row }, 201);
});

servicesRouter.put('/expenses/:id', zValidator('json', ExpenseLogSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { id } = c.req.param();
  const body = c.req.valid('json');

  await db
    .update(serviceExpenseLogs)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(and(eq(serviceExpenseLogs.id, id), eq(serviceExpenseLogs.organizationId, orgId)));
  return c.json({ success: true });
});

servicesRouter.delete('/expenses/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const { id } = c.req.param();
  await db.delete(serviceExpenseLogs).where(and(eq(serviceExpenseLogs.id, id), eq(serviceExpenseLogs.organizationId, orgId)));
  return c.json({ success: true });
});

// ─── Profitability Summary ────────────────────────────────────────────────────
// GET /services/profitability?period=2026-05

servicesRouter.get(
  '/profitability',
  zValidator('query', z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() })),
  async (c) => {
    const orgId = c.get('organizationId');
    const db = createDb(c.env.DB);
    const period = c.req.valid('query').period ?? new Date().toISOString().slice(0, 7);

    // Fixed/per_seat: sum cost & billed per company
    const fixedRows = await db
      .select({
        companyId: clientServices.companyId,
        companyName: companies.name,
        costCents: sql<number>`sum(coalesce(${clientServices.overrideCostCents}, ${services.unitCostCents}) * ${clientServices.quantity})`,
        billedCents: sql<number>`sum(${clientServices.billedAmountCents})`,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .innerJoin(companies, eq(clientServices.companyId, companies.id))
      .where(and(
        eq(clientServices.organizationId, orgId),
        eq(clientServices.isActive, true),
      ))
      .groupBy(clientServices.companyId, companies.name);

    // Usage-based: read allocations for period
    const expenseLogs = await db
      .select()
      .from(serviceExpenseLogs)
      .where(and(eq(serviceExpenseLogs.organizationId, orgId), eq(serviceExpenseLogs.period, period)));

    // Aggregate usage cost by company from allocations
    const usageCostByCompany: Record<string, number> = {};
    const usageBilledByCompany: Record<string, number> = {};
    for (const log of expenseLogs) {
      for (const alloc of log.allocations) {
        usageCostByCompany[alloc.companyId] = (usageCostByCompany[alloc.companyId] ?? 0)
          + Math.round(log.actualCostCents * alloc.pct / 100);
        usageBilledByCompany[alloc.companyId] = (usageBilledByCompany[alloc.companyId] ?? 0)
          + alloc.billedAmountCents;
      }
    }

    // Merge fixed + usage per company
    const companyMap: Record<string, { companyId: string; companyName: string; costCents: number; billedCents: number }> = {};
    for (const row of fixedRows) {
      companyMap[row.companyId] = {
        companyId: row.companyId,
        companyName: row.companyName,
        costCents: row.costCents ?? 0,
        billedCents: row.billedCents ?? 0,
      };
    }
    for (const [companyId, cost] of Object.entries(usageCostByCompany)) {
      if (companyMap[companyId]) {
        companyMap[companyId].costCents += cost;
        companyMap[companyId].billedCents += usageBilledByCompany[companyId] ?? 0;
      } else {
        // Fetch company name
        const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
        companyMap[companyId] = {
          companyId,
          companyName: company?.name ?? 'Unknown',
          costCents: cost,
          billedCents: usageBilledByCompany[companyId] ?? 0,
        };
      }
    }

    const summary = Object.values(companyMap).map((c) => ({
      ...c,
      marginCents: c.billedCents - c.costCents,
      marginPct: c.billedCents > 0 ? Math.round((c.billedCents - c.costCents) / c.billedCents * 100) : 0,
    })).sort((a, b) => b.marginCents - a.marginCents);

    const totalCost = summary.reduce((s, r) => s + r.costCents, 0);
    const totalBilled = summary.reduce((s, r) => s + r.billedCents, 0);

    return c.json({
      success: true,
      data: {
        period,
        summary,
        totals: {
          costCents: totalCost,
          billedCents: totalBilled,
          marginCents: totalBilled - totalCost,
          marginPct: totalBilled > 0 ? Math.round((totalBilled - totalCost) / totalBilled * 100) : 0,
        },
      },
    });
  },
);
