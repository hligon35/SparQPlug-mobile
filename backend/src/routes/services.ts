import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Bindings, Variables } from '../index';
import { createDb, services, clientServices, serviceExpenseLogs, companies } from '../db';
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

async function runRemoteNetworkTests(vpnDomain: string, piholeDomain: string): Promise<RemoteNetworkTest[]> {
  const started = Date.now();
  const vpnHost = normalizeDomain(vpnDomain);
  const piholeHost = normalizeDomain(piholeDomain);
  const tests: RemoteNetworkTest[] = [];

  try {
    const response = await fetchWithTimeout(`https://${vpnHost}`, { method: 'HEAD' });
    tests.push({
      id: 'vpn-head',
      label: 'VPN endpoint reachable',
      status: response.ok ? 'pass' : 'warn',
      detail: `https://${vpnHost} returned HTTP ${response.status}.`,
      durationMs: Date.now() - started,
      source: 'backend',
    });
  } catch (error) {
    tests.push({
      id: 'vpn-head',
      label: 'VPN endpoint reachable',
      status: 'fail',
      detail: error instanceof Error ? error.message : `Could not reach https://${vpnHost}.`,
      durationMs: Date.now() - started,
      source: 'backend',
    });
  }

  try {
    const response = await fetchWithTimeout(`https://${piholeHost}/admin/`, { method: 'HEAD' });
    tests.push({
      id: 'pihole-admin',
      label: 'Pi-hole admin reachable',
      status: response.ok || response.status === 401 || response.status === 403 ? 'pass' : 'warn',
      detail: `https://${piholeHost}/admin/ returned HTTP ${response.status}.`,
      durationMs: Date.now() - started,
      source: 'backend',
    });
  } catch (error) {
    tests.push({
      id: 'pihole-admin',
      label: 'Pi-hole admin reachable',
      status: 'fail',
      detail: error instanceof Error ? error.message : `Could not reach https://${piholeHost}/admin/.`,
      durationMs: Date.now() - started,
      source: 'backend',
    });
  }

  return tests;
}

servicesRouter.post('/network-ops/test-remote', zValidator('json', NetworkOpsRemoteTestsSchema), async (c) => {
  const { vpnDomain, piholeDomain } = c.req.valid('json');
  const results = await runRemoteNetworkTests(vpnDomain, piholeDomain);
  return c.json({ success: true, data: { results, testedAt: new Date().toISOString() } });
});

// ─── Service Catalog ──────────────────────────────────────────────────────────

servicesRouter.get('/', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const rows = await db.query.services.findMany({
    where: eq(services.organizationId, orgId),
    orderBy: [desc(services.createdAt)],
  });
  return c.json({ success: true, data: rows });
});

servicesRouter.post('/', zValidator('json', ServiceSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const id = generateId();

  await db.insert(services).values({ id, organizationId: orgId, createdBy: userId, ...data });
  const service = await db.query.services.findFirst({ where: eq(services.id, id) });
  return c.json({ success: true, data: service }, 201);
});

servicesRouter.put('/:id', zValidator('json', ServiceSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const service = await db.query.services.findFirst({ where: and(eq(services.id, c.req.param('id')), eq(services.organizationId, orgId)) });
  if (!service) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } }, 404);
  await db.update(services).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(services.id, service.id));
  const updated = await db.query.services.findFirst({ where: eq(services.id, service.id) });
  return c.json({ success: true, data: updated });
});

servicesRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const service = await db.query.services.findFirst({ where: and(eq(services.id, c.req.param('id')), eq(services.organizationId, orgId)) });
  if (!service) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } }, 404);
  await db.update(services).set({ isActive: false, updatedAt: new Date().toISOString() }).where(eq(services.id, service.id));
  return c.json({ success: true, data: { id: service.id } });
});

// ─── Client Service Assignments ───────────────────────────────────────────────

servicesRouter.get('/clients/:companyId', async (c) => {
  const orgId = c.get('organizationId');
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ assignment: clientServices, service: services })
    .from(clientServices)
    .innerJoin(services, eq(clientServices.serviceId, services.id))
    .where(and(eq(clientServices.organizationId, orgId), eq(clientServices.companyId, companyId)));
  return c.json({ success: true, data: rows });
});

servicesRouter.post('/clients/:companyId', zValidator('json', ClientServiceSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const companyId = c.req.param('companyId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const company = await db.query.companies.findFirst({ where: and(eq(companies.id, companyId), eq(companies.organizationId, orgId)) });
  if (!company) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);

  const service = await db.query.services.findFirst({ where: and(eq(services.id, data.serviceId), eq(services.organizationId, orgId)) });
  if (!service) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } }, 404);

  const id = generateId();
  await db.insert(clientServices).values({ id, organizationId: orgId, companyId, createdBy: userId, ...data });
  const assignment = await db.query.clientServices.findFirst({ where: eq(clientServices.id, id) });
  return c.json({ success: true, data: assignment }, 201);
});

servicesRouter.put('/clients/:assignmentId', zValidator('json', ClientServiceSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const assignment = await db.query.clientServices.findFirst({ where: and(eq(clientServices.id, c.req.param('assignmentId')), eq(clientServices.organizationId, orgId)) });
  if (!assignment) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } }, 404);
  await db.update(clientServices).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(clientServices.id, assignment.id));
  const updated = await db.query.clientServices.findFirst({ where: eq(clientServices.id, assignment.id) });
  return c.json({ success: true, data: updated });
});

servicesRouter.delete('/clients/:assignmentId', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const assignment = await db.query.clientServices.findFirst({ where: and(eq(clientServices.id, c.req.param('assignmentId')), eq(clientServices.organizationId, orgId)) });
  if (!assignment) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } }, 404);
  await db.delete(clientServices).where(eq(clientServices.id, assignment.id));
  return c.json({ success: true, data: { id: assignment.id } });
});

// ─── Expense Logs ─────────────────────────────────────────────────────────────

servicesRouter.get('/expenses', zValidator('query', z.object({ period: z.string().optional(), serviceId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { period, serviceId } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(serviceExpenseLogs.organizationId, orgId)];
  if (period) conditions.push(eq(serviceExpenseLogs.period, period));
  if (serviceId) conditions.push(eq(serviceExpenseLogs.serviceId, serviceId));
  const rows = await db.query.serviceExpenseLogs.findMany({ where: and(...conditions), orderBy: [desc(serviceExpenseLogs.period)] });
  return c.json({ success: true, data: rows });
});

servicesRouter.post('/expenses', zValidator('json', ExpenseLogSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const id = generateId();
  await db.insert(serviceExpenseLogs).values({ id, organizationId: orgId, createdBy: userId, ...data });
  const expense = await db.query.serviceExpenseLogs.findFirst({ where: eq(serviceExpenseLogs.id, id) });
  return c.json({ success: true, data: expense }, 201);
});

servicesRouter.put('/expenses/:id', zValidator('json', ExpenseLogSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const expense = await db.query.serviceExpenseLogs.findFirst({ where: and(eq(serviceExpenseLogs.id, c.req.param('id')), eq(serviceExpenseLogs.organizationId, orgId)) });
  if (!expense) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } }, 404);
  await db.update(serviceExpenseLogs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(serviceExpenseLogs.id, expense.id));
  const updated = await db.query.serviceExpenseLogs.findFirst({ where: eq(serviceExpenseLogs.id, expense.id) });
  return c.json({ success: true, data: updated });
});

servicesRouter.delete('/expenses/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const expense = await db.query.serviceExpenseLogs.findFirst({ where: and(eq(serviceExpenseLogs.id, c.req.param('id')), eq(serviceExpenseLogs.organizationId, orgId)) });
  if (!expense) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } }, 404);
  await db.delete(serviceExpenseLogs).where(eq(serviceExpenseLogs.id, expense.id));
  return c.json({ success: true, data: { id: expense.id } });
});

// ─── Profitability ────────────────────────────────────────────────────────────

servicesRouter.get('/profitability', zValidator('query', z.object({ period: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { period } = c.req.valid('query');
  const currentPeriod = period ?? new Date().toISOString().slice(0, 7);
  const db = createDb(c.env.DB);

  const assignments = await db
    .select({ assignment: clientServices, service: services, company: companies })
    .from(clientServices)
    .innerJoin(services, eq(clientServices.serviceId, services.id))
    .innerJoin(companies, eq(clientServices.companyId, companies.id))
    .where(and(eq(clientServices.organizationId, orgId), eq(clientServices.isActive, true)));

  const expenses = await db.query.serviceExpenseLogs.findMany({ where: and(eq(serviceExpenseLogs.organizationId, orgId), eq(serviceExpenseLogs.period, currentPeriod)) });

  const byCompany = new Map<string, { companyName: string; costCents: number; billedCents: number }>();

  for (const row of assignments) {
    const existing = byCompany.get(row.assignment.companyId) ?? { companyName: row.company.name, costCents: 0, billedCents: 0 };
    const baseCost = row.assignment.overrideCostCents ?? row.service.unitCostCents;
    existing.costCents += baseCost * row.assignment.quantity;
    existing.billedCents += row.assignment.billedAmountCents;
    byCompany.set(row.assignment.companyId, existing);
  }

  for (const expense of expenses) {
    for (const allocation of expense.allocations ?? []) {
      const existing = byCompany.get(allocation.companyId) ?? { companyName: 'Unknown Client', costCents: 0, billedCents: 0 };
      existing.costCents += Math.round((expense.actualCostCents * allocation.pct) / 100);
      existing.billedCents += allocation.billedAmountCents;
      byCompany.set(allocation.companyId, existing);
    }
  }

  const summary = Array.from(byCompany.entries()).map(([companyId, value]) => {
    const marginCents = value.billedCents - value.costCents;
    const marginPct = value.billedCents > 0 ? Number(((marginCents / value.billedCents) * 100).toFixed(2)) : 0;
    return { companyId, companyName: value.companyName, costCents: value.costCents, billedCents: value.billedCents, marginCents, marginPct };
  });

  const totals = summary.reduce(
    (acc, row) => {
      acc.costCents += row.costCents;
      acc.billedCents += row.billedCents;
      acc.marginCents += row.marginCents;
      return acc;
    },
    { costCents: 0, billedCents: 0, marginCents: 0, marginPct: 0 },
  );
  totals.marginPct = totals.billedCents > 0 ? Number(((totals.marginCents / totals.billedCents) * 100).toFixed(2)) : 0;

  return c.json({ success: true, data: { period: currentPeriod, summary, totals } });
});
