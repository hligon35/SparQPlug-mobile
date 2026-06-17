import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { stripeCustomers, stripeInvoices, stripeSubscriptions } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId, buildPaginatedResult } from '../lib/utils';
import { z } from 'zod';
import { CreateInvoiceSchema } from '@sparqplug/types';

export const billingRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
billingRouter.use('*', authMiddleware);

function getStripe(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

// ─── Customers ────────────────────────────────────────────────────────────────

billingRouter.get('/customers', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(200).default(25), search: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const offset = (page - 1) * limit;
  const conditions = [eq(stripeCustomers.organizationId, orgId)];
  const [rows, countResult] = await Promise.all([
    db.query.stripeCustomers.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(stripeCustomers.createdAt)] }),
    db.select({ count: sql<number>`count(*)` }).from(stripeCustomers).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: buildPaginatedResult(rows, page, limit, countResult[0]?.count ?? 0) });
});

billingRouter.get('/customers/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const customer = await db.query.stripeCustomers.findFirst({ where: and(eq(stripeCustomers.id, c.req.param('id')), eq(stripeCustomers.organizationId, orgId)) });
  if (!customer) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  return c.json({ success: true, data: customer });
});

billingRouter.post('/customers', zValidator('json', z.object({ email: z.string().email(), name: z.string().min(1), phone: z.string().optional(), contactId: z.string().optional(), companyId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  const stripeCustomer = await stripe.customers.create({ email: data.email, name: data.name, phone: data.phone });
  const id = generateId();
  await db.insert(stripeCustomers).values({ id, organizationId: orgId, stripeCustomerId: stripeCustomer.id, ...data, currency: 'usd', balance: 0, delinquent: false, metadata: {} });
  const customer = await db.query.stripeCustomers.findFirst({ where: eq(stripeCustomers.id, id) });
  return c.json({ success: true, data: customer }, 201);
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

billingRouter.get('/invoices', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(200).default(25), status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(), customerId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit, status, customerId } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(stripeInvoices.organizationId, orgId)];
  if (status) conditions.push(eq(stripeInvoices.status, status));
  if (customerId) conditions.push(eq(stripeInvoices.customerId, customerId));
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.query.stripeInvoices.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(stripeInvoices.createdAt)], with: { customer: true } }),
    db.select({ count: sql<number>`count(*)` }).from(stripeInvoices).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: buildPaginatedResult(rows, page, limit, countResult[0]?.count ?? 0) });
});

billingRouter.post('/invoices', zValidator('json', CreateInvoiceSchema), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);

  const customer = await db.query.stripeCustomers.findFirst({ where: and(eq(stripeCustomers.id, data.customerId), eq(stripeCustomers.organizationId, orgId)) });
  if (!customer) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);

  const stripeInvoice = await stripe.invoices.create({
    customer: customer.stripeCustomerId,
    currency: data.currency,
    due_date: data.dueDate ? Math.floor(new Date(data.dueDate).getTime() / 1000) : undefined,
    auto_advance: data.autoSend,
  });

  for (const item of data.lineItems) {
    await stripe.invoiceItems.create({ customer: customer.stripeCustomerId, invoice: stripeInvoice.id, description: item.description, quantity: item.quantity, unit_amount: Math.round(item.unitAmount * 100) });
  }

  const id = generateId();
  const total = data.lineItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  await db.insert(stripeInvoices).values({ id, organizationId: orgId, stripeInvoiceId: stripeInvoice.id, customerId: data.customerId, status: 'draft', currency: data.currency, subtotal: Math.round(total * 100), tax: 0, discount: 0, total: Math.round(total * 100), amountPaid: 0, amountDue: Math.round(total * 100), lineItems: data.lineItems, dueDate: data.dueDate, hostedUrl: stripeInvoice.hosted_invoice_url });

  const invoice = await db.query.stripeInvoices.findFirst({ where: eq(stripeInvoices.id, id) });
  return c.json({ success: true, data: invoice }, 201);
});

billingRouter.post('/invoices/:id/send', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  const invoice = await db.query.stripeInvoices.findFirst({ where: and(eq(stripeInvoices.id, c.req.param('id')), eq(stripeInvoices.organizationId, orgId)) });
  if (!invoice) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
  await stripe.invoices.sendInvoice(invoice.stripeInvoiceId);
  await db.update(stripeInvoices).set({ status: 'open', updatedAt: new Date().toISOString() }).where(eq(stripeInvoices.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id'), status: 'open' } });
});

billingRouter.post('/invoices/:id/void', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  const invoice = await db.query.stripeInvoices.findFirst({ where: and(eq(stripeInvoices.id, c.req.param('id')), eq(stripeInvoices.organizationId, orgId)) });
  if (!invoice) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);
  await stripe.invoices.voidInvoice(invoice.stripeInvoiceId);
  await db.update(stripeInvoices).set({ status: 'void', updatedAt: new Date().toISOString() }).where(eq(stripeInvoices.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id'), status: 'void' } });
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

billingRouter.get('/subscriptions', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(200).default(25), status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused']).optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit, status } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(stripeSubscriptions.organizationId, orgId)];
  if (status) conditions.push(eq(stripeSubscriptions.status, status));
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.query.stripeSubscriptions.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(stripeSubscriptions.createdAt)], with: { customer: true } }),
    db.select({ count: sql<number>`count(*)` }).from(stripeSubscriptions).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: buildPaginatedResult(rows, page, limit, countResult[0]?.count ?? 0) });
});

// ─── Revenue Metrics ──────────────────────────────────────────────────────────

billingRouter.get('/metrics', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const [activeSubsResult, trialingResult, pastDueResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)`, total: sql<number>`sum(amount)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'active'))),
    db.select({ count: sql<number>`count(*)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'trialing'))),
    db.select({ count: sql<number>`count(*)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'past_due'))),
  ]);

  const mrr = (activeSubsResult[0]?.total ?? 0) / 100;
  return c.json({
    success: true,
    data: {
      mrr,
      arr: mrr * 12,
      activeSubscriptions: activeSubsResult[0]?.count ?? 0,
      trialingSubscriptions: trialingResult[0]?.count ?? 0,
      pastDueSubscriptions: pastDueResult[0]?.count ?? 0,
    },
  });
});

billingRouter.get('/revenue-metrics', async (c) => {
  return billingRouter.fetch(new Request(new URL('/metrics', c.req.url), { method: 'GET', headers: c.req.raw.headers }), c.env, c.executionCtx);
});
