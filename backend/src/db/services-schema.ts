import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { organizations, companies } from './schema';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
};

const id = {
  id: text('id').primaryKey(),
};

export const services = sqliteTable(
  'services',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    category: text('category', {
      enum: ['hosting', 'email', 'auth', 'storage', 'database', 'cdn', 'payments', 'analytics', 'communications', 'productivity', 'other'],
    }).notNull().default('other'),
    billingType: text('billing_type', { enum: ['fixed', 'per_seat', 'usage'] }).notNull().default('fixed'),
    unitCostCents: integer('unit_cost_cents').notNull().default(0),
    defaultMarkupPct: real('default_markup_pct').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    billingCycle: text('billing_cycle', { enum: ['monthly', 'annual', 'one_time'] }).notNull().default('monthly'),
    logoUrl: text('logo_url'),
    url: text('url'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('services_org_idx').on(t.organizationId),
    categoryIdx: index('services_category_idx').on(t.category),
  }),
);

export const clientServices = sqliteTable(
  'client_services',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    overrideCostCents: integer('override_cost_cents'),
    billedAmountCents: integer('billed_amount_cents').notNull().default(0),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    startDate: text('start_date'),
    endDate: text('end_date'),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('client_services_org_idx').on(t.organizationId),
    companyIdx: index('client_services_company_idx').on(t.companyId),
    serviceIdx: index('client_services_service_idx').on(t.serviceId),
  }),
);

export const serviceExpenseLogs = sqliteTable(
  'service_expense_logs',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    actualCostCents: integer('actual_cost_cents').notNull().default(0),
    invoiceRef: text('invoice_ref'),
    notes: text('notes'),
    allocations: text('allocations', { mode: 'json' }).$type<Array<{ companyId: string; pct: number; billedAmountCents: number }>>().notNull().default([]),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('svc_expense_logs_org_idx').on(t.organizationId),
    serviceIdx: index('svc_expense_logs_service_idx').on(t.serviceId),
    periodIdx: index('svc_expense_logs_period_idx').on(t.period),
  }),
);
