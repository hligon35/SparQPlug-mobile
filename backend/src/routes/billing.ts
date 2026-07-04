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
import { BillingLabelSchema, CreateInvoiceSchema } from '@sparqplug/types';

export const billingRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
billingRouter.use('*', authMiddleware);

const SYNC_RESOURCES = ['customers', 'invoices', 'subscriptions'] as const;
const SyncBillingSchema = z.object({ resources: z.array(z.enum(SYNC_RESOURCES)).optional() });

function getStripe(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

function serializeMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

function shouldSyncOrganization(metadata: Stripe.Metadata | null | undefined, organizationId: string) {
  const metadataOrganizationId = metadata?.organizationId;
  return !metadataOrganizationId || metadataOrganizationId === organizationId;
}

function toIsoString(timestamp: number | null | undefined) {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : null;
}

function normalizeLabel(label: string | null | undefined) {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

function mapInvoiceStatus(status: Stripe.Invoice.Status | null | undefined): 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' {
  switch (status) {
    case 'open':
    case 'paid':
    case 'void':
    case 'uncollectible':
      return status;
    case 'draft':
    default:
      return 'draft';
  }
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused' {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    case 'paused':
      return status;
    default:
      return 'incomplete';
  }
}

function getSubscriptionPlanName(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  if (!firstItem) return 'Stripe Subscription';
  const nickname = firstItem.price.nickname?.trim();
  if (nickname) return nickname;
  return firstItem.price.id;
}

function getSubscriptionInterval(subscription: Stripe.Subscription): 'month' | 'year' | 'week' | 'day' {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  if (interval === 'month' || interval === 'year' || interval === 'week' || interval === 'day') return interval;
  return 'month';
}

async function syncCustomerRecord(db: ReturnType<typeof createDb>, organizationId: string, customer: Stripe.Customer) {
  if (customer.deleted || !shouldSyncOrganization(customer.metadata, organizationId)) return null;

  const existingCustomer = await db.query.stripeCustomers.findFirst({ where: eq(stripeCustomers.stripeCustomerId, customer.id) });
  const metadata = serializeMetadata(customer.metadata);
  const values = {
    organizationId,
    stripeCustomerId: customer.id,
    contactId: existingCustomer?.contactId ?? metadata.contactId ?? null,
    companyId: existingCustomer?.companyId ?? metadata.companyId ?? null,
    email: customer.email ?? existingCustomer?.email ?? `${customer.id}@stripe.local`,
    name: customer.name ?? existingCustomer?.name ?? customer.email ?? customer.id,
    phone: customer.phone ?? existingCustomer?.phone ?? null,
    currency: customer.currency ?? existingCustomer?.currency ?? 'usd',
    balance: customer.balance ?? existingCustomer?.balance ?? 0,
    delinquent: customer.delinquent ?? existingCustomer?.delinquent ?? false,
    metadata,
    updatedAt: new Date().toISOString(),
  };

  if (existingCustomer) {
    await db.update(stripeCustomers).set(values).where(eq(stripeCustomers.id, existingCustomer.id));
    return existingCustomer.id;
  }

  const id = generateId();
  await db.insert(stripeCustomers).values({ id, ...values });
  return id;
}

async function ensureCustomerRecord(db: ReturnType<typeof createDb>, stripe: Stripe, organizationId: string, customerRef: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customerRef) return null;
  const stripeCustomerId = typeof customerRef === 'string' ? customerRef : customerRef.id;
  const existingCustomer = await db.query.stripeCustomers.findFirst({
    where: and(eq(stripeCustomers.organizationId, organizationId), eq(stripeCustomers.stripeCustomerId, stripeCustomerId)),
  });
  if (existingCustomer) return existingCustomer;

  const hydratedCustomer = typeof customerRef === 'string' ? await stripe.customers.retrieve(customerRef) : customerRef;
  if ('deleted' in hydratedCustomer && hydratedCustomer.deleted) return null;

  const syncedCustomerId = await syncCustomerRecord(db, organizationId, hydratedCustomer);
  if (!syncedCustomerId) return null;
  return db.query.stripeCustomers.findFirst({ where: and(eq(stripeCustomers.organizationId, organizationId), eq(stripeCustomers.id, syncedCustomerId)) });
}

async function syncInvoiceRecord(db: ReturnType<typeof createDb>, stripe: Stripe, organizationId: string, invoice: Stripe.Invoice) {
  if (!shouldSyncOrganization(invoice.metadata, organizationId)) return null;
  const customer = await ensureCustomerRecord(db, stripe, organizationId, invoice.customer);
  if (!customer) return null;

  const existingInvoice = await db.query.stripeInvoices.findFirst({ where: eq(stripeInvoices.stripeInvoiceId, invoice.id) });
  const lineItems = (invoice.lines?.data ?? []).map((line) => ({
    id: line.id,
    description: line.description ?? 'Stripe line item',
    quantity: line.quantity ?? 1,
    unitAmount: (line.price?.unit_amount ?? line.amount ?? 0) / 100,
    amount: (line.amount ?? 0) / 100,
    currency: line.currency ?? invoice.currency ?? customer.currency,
  }));

  const values = {
    organizationId,
    stripeInvoiceId: invoice.id,
    customerId: customer.id,
    status: mapInvoiceStatus(invoice.status),
    number: invoice.number ?? existingInvoice?.number ?? null,
    label: existingInvoice?.label ?? null,
    currency: invoice.currency ?? existingInvoice?.currency ?? customer.currency,
    subtotal: invoice.subtotal ?? existingInvoice?.subtotal ?? 0,
    tax: invoice.tax ?? existingInvoice?.tax ?? 0,
    discount: invoice.total_discount_amounts?.reduce((sum, item) => sum + item.amount, 0) ?? existingInvoice?.discount ?? 0,
    total: invoice.total ?? existingInvoice?.total ?? 0,
    amountPaid: invoice.amount_paid ?? existingInvoice?.amountPaid ?? 0,
    amountDue: invoice.amount_remaining ?? invoice.amount_due ?? existingInvoice?.amountDue ?? 0,
    lineItems: lineItems.length > 0 ? lineItems : existingInvoice?.lineItems ?? [],
    dueDate: toIsoString(invoice.due_date) ?? existingInvoice?.dueDate ?? null,
    paidAt: toIsoString(invoice.status_transitions?.paid_at) ?? existingInvoice?.paidAt ?? null,
    periodStart: toIsoString(invoice.period_start) ?? existingInvoice?.periodStart ?? null,
    periodEnd: toIsoString(invoice.period_end) ?? existingInvoice?.periodEnd ?? null,
    pdfUrl: invoice.invoice_pdf ?? existingInvoice?.pdfUrl ?? null,
    hostedUrl: invoice.hosted_invoice_url ?? existingInvoice?.hostedUrl ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (existingInvoice) {
    await db.update(stripeInvoices).set(values).where(eq(stripeInvoices.id, existingInvoice.id));
    return existingInvoice.id;
  }

  const id = generateId();
  await db.insert(stripeInvoices).values({ id, ...values });
  return id;
}

async function syncSubscriptionRecord(db: ReturnType<typeof createDb>, stripe: Stripe, organizationId: string, subscription: Stripe.Subscription) {
  if (!shouldSyncOrganization(subscription.metadata, organizationId)) return null;
  const customer = await ensureCustomerRecord(db, stripe, organizationId, subscription.customer);
  if (!customer) return null;

  const existingSubscription = await db.query.stripeSubscriptions.findFirst({ where: eq(stripeSubscriptions.stripeSubscriptionId, subscription.id) });
  const firstItem = subscription.items.data[0];
  const values = {
    organizationId,
    stripeSubscriptionId: subscription.id,
    customerId: customer.id,
    status: mapSubscriptionStatus(subscription.status),
    planName: getSubscriptionPlanName(subscription),
    label: existingSubscription?.label ?? null,
    planId: firstItem?.price.id ?? existingSubscription?.planId ?? subscription.id,
    quantity: firstItem?.quantity ?? existingSubscription?.quantity ?? 1,
    currency: firstItem?.price.currency ?? existingSubscription?.currency ?? customer.currency,
    amount: firstItem?.price.unit_amount ?? existingSubscription?.amount ?? 0,
    interval: getSubscriptionInterval(subscription),
    intervalCount: firstItem?.price.recurring?.interval_count ?? existingSubscription?.intervalCount ?? 1,
    currentPeriodStart: toIsoString(subscription.current_period_start) ?? existingSubscription?.currentPeriodStart ?? new Date().toISOString(),
    currentPeriodEnd: toIsoString(subscription.current_period_end) ?? existingSubscription?.currentPeriodEnd ?? new Date().toISOString(),
    cancelAt: toIsoString(subscription.cancel_at) ?? existingSubscription?.cancelAt ?? null,
    canceledAt: toIsoString(subscription.canceled_at) ?? existingSubscription?.canceledAt ?? null,
    trialStart: toIsoString(subscription.trial_start) ?? existingSubscription?.trialStart ?? null,
    trialEnd: toIsoString(subscription.trial_end) ?? existingSubscription?.trialEnd ?? null,
    metadata: serializeMetadata(subscription.metadata),
    updatedAt: new Date().toISOString(),
  };

  if (existingSubscription) {
    await db.update(stripeSubscriptions).set(values).where(eq(stripeSubscriptions.id, existingSubscription.id));
    return existingSubscription.id;
  }

  const id = generateId();
  await db.insert(stripeSubscriptions).values({ id, ...values });
  return id;
}

billingRouter.post('/sync', zValidator('json', SyncBillingSchema), async (c) => {
  const organizationId = c.get('organizationId');
  const { resources } = c.req.valid('json');
  const selectedResources = resources?.length ? resources : [...SYNC_RESOURCES];
  const db = createDb(c.env.DB);
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  const synced = { customers: 0, invoices: 0, subscriptions: 0 };

  if (selectedResources.includes('customers')) {
    for await (const customer of stripe.customers.list({ limit: 100 })) {
      if (customer.deleted) continue;
      const syncedCustomerId = await syncCustomerRecord(db, organizationId, customer);
      if (syncedCustomerId) synced.customers += 1;
    }
  }

  if (selectedResources.includes('invoices')) {
    for await (const invoice of stripe.invoices.list({ limit: 100 })) {
      const syncedInvoiceId = await syncInvoiceRecord(db, stripe, organizationId, invoice);
      if (syncedInvoiceId) synced.invoices += 1;
    }
  }

  if (selectedResources.includes('subscriptions')) {
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      const syncedSubscriptionId = await syncSubscriptionRecord(db, stripe, organizationId, subscription);
      if (syncedSubscriptionId) synced.subscriptions += 1;
    }
  }

  return c.json({ success: true, data: { synced } });
});

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
  const stripeCustomer = await stripe.customers.create({
    email: data.email,
    name: data.name,
    phone: data.phone,
    metadata: {
      organizationId: orgId,
      source: 'sparqplug',
      ...(data.contactId ? { contactId: data.contactId } : {}),
      ...(data.companyId ? { companyId: data.companyId } : {}),
    },
  });
  const id = generateId();
  await db.insert(stripeCustomers).values({ id, organizationId: orgId, stripeCustomerId: stripeCustomer.id, ...data, currency: 'usd', balance: 0, delinquent: false, metadata: {} });
  const customer = await db.query.stripeCustomers.findFirst({ where: eq(stripeCustomers.id, id) });
  return c.json({ success: true, data: customer }, 201);
});

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
    metadata: { organizationId: orgId, source: 'sparqplug', localCustomerId: customer.id },
  });

  for (const item of data.lineItems) {
    await stripe.invoiceItems.create({ customer: customer.stripeCustomerId, invoice: stripeInvoice.id, description: item.description, quantity: item.quantity, unit_amount: Math.round(item.unitAmount * 100) });
  }

  const id = generateId();
  const total = data.lineItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  await db.insert(stripeInvoices).values({ id, organizationId: orgId, stripeInvoiceId: stripeInvoice.id, customerId: data.customerId, status: 'draft', number: stripeInvoice.number ?? null, label: normalizeLabel(data.notes), currency: data.currency, subtotal: Math.round(total * 100), tax: 0, discount: 0, total: Math.round(total * 100), amountPaid: 0, amountDue: Math.round(total * 100), lineItems: data.lineItems, dueDate: data.dueDate, hostedUrl: stripeInvoice.hosted_invoice_url });

  const invoice = await db.query.stripeInvoices.findFirst({ where: eq(stripeInvoices.id, id), with: { customer: true } });
  return c.json({ success: true, data: invoice }, 201);
});

billingRouter.patch('/invoices/:id', zValidator('json', BillingLabelSchema), async (c) => {
  const orgId = c.get('organizationId');
  const { label } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const invoice = await db.query.stripeInvoices.findFirst({ where: and(eq(stripeInvoices.id, c.req.param('id')), eq(stripeInvoices.organizationId, orgId)) });
  if (!invoice) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);

  await db.update(stripeInvoices).set({ label: normalizeLabel(label), updatedAt: new Date().toISOString() }).where(eq(stripeInvoices.id, invoice.id));
  const updated = await db.query.stripeInvoices.findFirst({ where: eq(stripeInvoices.id, invoice.id), with: { customer: true } });
  return c.json({ success: true, data: updated });
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

billingRouter.patch('/subscriptions/:id', zValidator('json', BillingLabelSchema), async (c) => {
  const orgId = c.get('organizationId');
  const { label } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const subscription = await db.query.stripeSubscriptions.findFirst({ where: and(eq(stripeSubscriptions.id, c.req.param('id')), eq(stripeSubscriptions.organizationId, orgId)) });
  if (!subscription) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);

  await db.update(stripeSubscriptions).set({ label: normalizeLabel(label), updatedAt: new Date().toISOString() }).where(eq(stripeSubscriptions.id, subscription.id));
  const updated = await db.query.stripeSubscriptions.findFirst({ where: eq(stripeSubscriptions.id, subscription.id), with: { customer: true } });
  return c.json({ success: true, data: updated });
});

billingRouter.get('/metrics', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const [activeSubsResult, trialingResult, pastDueResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)`, total: sql<number>`sum(amount)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'active'))),
    db.select({ count: sql<number>`count(*)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'trialing'))),
    db.select({ count: sql<number>`count(*)` }).from(stripeSubscriptions).where(and(eq(stripeSubscriptions.organizationId, orgId), eq(stripeSubscriptions.status, 'past_due'))),
  ]);
  const mrr = (activeSubsResult[0]?.total ?? 0) / 100;
  return c.json({ success: true, data: { mrr, arr: mrr * 12, activeSubscriptions: activeSubsResult[0]?.count ?? 0, trialingSubscriptions: trialingResult[0]?.count ?? 0, pastDueSubscriptions: pastDueResult[0]?.count ?? 0 } });
});

billingRouter.get('/revenue-metrics', async (c) => {
  return billingRouter.fetch(new Request(new URL('/metrics', c.req.url), { method: 'GET', headers: c.req.raw.headers }), c.env, c.executionCtx);
});