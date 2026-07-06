import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { authRouter } from './routes/auth';
import { bootstrapRouter } from './routes/bootstrap';
import { contactsRouter } from './routes/contacts';
import { companiesRouter } from './routes/companies';
import { opportunitiesRouter } from './routes/opportunities';
import { activitiesRouter } from './routes/activities';
import { tasksRouter } from './routes/tasks';
import { billingRouter } from './routes/billing';
import { documentsRouter } from './routes/documents';
import { analyticsRouter } from './routes/analytics';
import { searchRouter } from './routes/search';
import { notificationsRouter } from './routes/notifications';
import { settingsRouter } from './routes/settings';
import { webhooksRouter } from './routes/webhooks';
import { realtimeRouter } from './routes/realtime';
import { servicesRouter } from './routes/services';
import { passwordLockersRouter } from './routes/password-lockers';
import { RealtimeDurableObject } from './durable-objects/realtime';
import { RecordLockDurableObject } from './durable-objects/record-lock';
import { createDb } from './db';
import { stripeInvoices, stripeSubscriptions } from './db/schema';
import { authMiddleware } from './middleware/auth';

export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  EMAIL_QUEUE: Queue;
  REALTIME_DO: DurableObjectNamespace;
  RECORD_LOCK_DO: DurableObjectNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  FIREBASE_SERVICE_ACCOUNT: string;
  FIREBASE_API_KEY: string;
  JWT_SECRET: string;
  PASSWORD_LOCKER_KEY?: string;
  CLOUDFLARE_ANALYTICS_TOKEN: string;
  BOOTSTRAP_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_NAME: string;
  ADMIN_ORG_NAME: string;
  ENVIRONMENT: string;
};

export type Variables = {
  userId: string;
  organizationId: string;
  userRole: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const LabelSchema = z.object({ label: z.string().max(120).optional().nullable() });

function normalizeLabel(label: string | null | undefined) {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

async function ensureBillingLabelColumns(db: D1Database) {
  try {
    await db.prepare('ALTER TABLE stripe_invoices ADD COLUMN label text').run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (!message.includes('duplicate column') && !message.includes('already exists')) throw error;
  }

  try {
    await db.prepare('ALTER TABLE stripe_subscriptions ADD COLUMN label text').run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (!message.includes('duplicate column') && !message.includes('already exists')) throw error;
  }
}

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://app.sparqplug.io',
        'https://sparqplug.io',
        'https://sparqplug.getsparqd.com',
        'https://sparqplug-web.pages.dev',
      ];
      if (allowed.includes(origin ?? '')) return origin;
      if (origin?.endsWith('.sparqplug-web.pages.dev')) return origin;
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
    exposeHeaders: ['X-Request-Id'],
  }),
);
app.use('/api/v1/companies/:id/logo', async (c, next) => {
  await next();
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  c.res.headers.set('Access-Control-Allow-Origin', '*');
});
app.use('*', secureHeaders());

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'sparqplug-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// ─── Direct Billing Label Saves ───────────────────────────────────────────────

app.patch('/api/v1/billing/invoices/:id/label', authMiddleware, zValidator('json', LabelSchema), async (c) => {
  await ensureBillingLabelColumns(c.env.DB);
  const orgId = c.get('organizationId');
  const { label } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const invoice = await db.query.stripeInvoices.findFirst({ where: and(eq(stripeInvoices.id, c.req.param('id')), eq(stripeInvoices.organizationId, orgId)) });
  if (!invoice) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } }, 404);

  await db.update(stripeInvoices).set({ label: normalizeLabel(label), updatedAt: new Date().toISOString() }).where(and(eq(stripeInvoices.id, invoice.id), eq(stripeInvoices.organizationId, orgId)));
  const updated = await db.query.stripeInvoices.findFirst({ where: and(eq(stripeInvoices.id, invoice.id), eq(stripeInvoices.organizationId, orgId)), with: { customer: true } });
  return c.json({ success: true, data: updated });
});

app.patch('/api/v1/billing/subscriptions/:id/label', authMiddleware, zValidator('json', LabelSchema), async (c) => {
  await ensureBillingLabelColumns(c.env.DB);
  const orgId = c.get('organizationId');
  const { label } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const subscription = await db.query.stripeSubscriptions.findFirst({ where: and(eq(stripeSubscriptions.id, c.req.param('id')), eq(stripeSubscriptions.organizationId, orgId)) });
  if (!subscription) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);

  await db.update(stripeSubscriptions).set({ label: normalizeLabel(label), updatedAt: new Date().toISOString() }).where(and(eq(stripeSubscriptions.id, subscription.id), eq(stripeSubscriptions.organizationId, orgId)));
  const updated = await db.query.stripeSubscriptions.findFirst({ where: and(eq(stripeSubscriptions.id, subscription.id), eq(stripeSubscriptions.organizationId, orgId)), with: { customer: true } });
  return c.json({ success: true, data: updated });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.route('/api/v1/auth', authRouter);
app.route('/api/bootstrap', bootstrapRouter);
app.route('/api/v1/contacts', contactsRouter);
app.route('/api/v1/companies', companiesRouter);
app.route('/api/v1/opportunities', opportunitiesRouter);
app.route('/api/v1/activities', activitiesRouter);
app.route('/api/v1/tasks', tasksRouter);
app.route('/api/v1/billing', billingRouter);
app.route('/api/v1/documents', documentsRouter);
app.route('/api/v1/analytics', analyticsRouter);
app.route('/api/v1/search', searchRouter);
app.route('/api/v1/notifications', notificationsRouter);
app.route('/api/v1/settings', settingsRouter);
app.route('/api/v1/services', servicesRouter);
app.route('/api/v1/password-lockers', passwordLockersRouter);
app.route('/api/v1/realtime', realtimeRouter);
app.route('/webhooks', webhooksRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[API Error]', err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Internal server error',
      },
    },
    500,
  );
});

export { RealtimeDurableObject, RecordLockDurableObject };
export default app;