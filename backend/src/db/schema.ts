import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
};

const id = {
  id: text('id').primaryKey(),
};

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = sqliteTable('organizations', {
  ...id,
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  plan: text('plan', { enum: ['starter', 'professional', 'enterprise'] })
    .notNull()
    .default('starter'),
  settings: text('settings', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  stripeCustomerId: text('stripe_customer_id'),
  ...timestamps,
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    ...id,
    firebaseUid: text('firebase_uid').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ['admin', 'manager', 'sales', 'accounting', 'read_only'] })
      .notNull()
      .default('read_only'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['active', 'invited', 'suspended'] })
      .notNull()
      .default('active'),
    permissions: text('permissions', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    preferences: text('preferences', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    lastLoginAt: text('last_login_at'),
    ...timestamps,
  },
  (t) => ({
    firebaseUidIdx: uniqueIndex('users_firebase_uid_idx').on(t.firebaseUid),
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    orgIdx: index('users_org_idx').on(t.organizationId),
  }),
);

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = sqliteTable(
  'contacts',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    mobile: text('mobile'),
    title: text('title'),
    department: text('department'),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status', {
      enum: ['active', 'inactive', 'lead', 'prospect', 'customer'],
    })
      .notNull()
      .default('lead'),
    source: text('source'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    address: text('address', { mode: 'json' }).$type<Record<string, string>>(),
    notes: text('notes'),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    avatarUrl: text('avatar_url'),
    lastActivityAt: text('last_activity_at'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('contacts_org_idx').on(t.organizationId),
    emailIdx: index('contacts_email_idx').on(t.email),
    companyIdx: index('contacts_company_idx').on(t.companyId),
    ownerIdx: index('contacts_owner_idx').on(t.ownerId),
    statusIdx: index('contacts_status_idx').on(t.status),
  }),
);

// ─── Companies ────────────────────────────────────────────────────────────────

export const companies = sqliteTable(
  'companies',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    size: text('size'),
    revenue: real('revenue'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status', {
      enum: ['active', 'inactive', 'prospect', 'customer', 'churned'],
    })
      .notNull()
      .default('prospect'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    address: text('address', { mode: 'json' }).$type<Record<string, string>>(),
    notes: text('notes'),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    logoUrl: text('logo_url'),
    lastActivityAt: text('last_activity_at'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('companies_org_idx').on(t.organizationId),
    nameIdx: index('companies_name_idx').on(t.name),
    domainIdx: index('companies_domain_idx').on(t.domain),
    ownerIdx: index('companies_owner_idx').on(t.ownerId),
  }),
);

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunities = sqliteTable(
  'opportunities',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
    stage: text('stage', {
      enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    })
      .notNull()
      .default('prospecting'),
    value: real('value').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    probability: integer('probability').notNull().default(20),
    expectedCloseDate: text('expected_close_date'),
    source: text('source'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    notes: text('notes'),
    customFields: text('custom_fields', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    lastActivityAt: text('last_activity_at'),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('opportunities_org_idx').on(t.organizationId),
    stageIdx: index('opportunities_stage_idx').on(t.stage),
    ownerIdx: index('opportunities_owner_idx').on(t.ownerId),
    contactIdx: index('opportunities_contact_idx').on(t.contactId),
    companyIdx: index('opportunities_company_idx').on(t.companyId),
  }),
);

// ─── Activities ───────────────────────────────────────────────────────────────

export const activities = sqliteTable(
  'activities',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up'],
    }).notNull(),
    subject: text('subject').notNull(),
    description: text('description'),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scheduledAt: text('scheduled_at'),
    completedAt: text('completed_at'),
    duration: integer('duration'),
    outcome: text('outcome'),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('activities_org_idx').on(t.organizationId),
    typeIdx: index('activities_type_idx').on(t.type),
    contactIdx: index('activities_contact_idx').on(t.contactId),
    ownerIdx: index('activities_owner_idx').on(t.ownerId),
  }),
);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
  'tasks',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ['todo', 'in_progress', 'completed', 'cancelled'] })
      .notNull()
      .default('todo'),
    priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
      .notNull()
      .default('medium'),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, {
      onDelete: 'set null',
    }),
    dueDate: text('due_date'),
    completedAt: text('completed_at'),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('tasks_org_idx').on(t.organizationId),
    statusIdx: index('tasks_status_idx').on(t.status),
    assigneeIdx: index('tasks_assignee_idx').on(t.assigneeId),
    dueDateIdx: index('tasks_due_date_idx').on(t.dueDate),
  }),
);

// ─── Notes ────────────────────────────────────────────────────────────────────

export const notes = sqliteTable(
  'notes',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, {
      onDelete: 'cascade',
    }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('notes_org_idx').on(t.organizationId),
    contactIdx: index('notes_contact_idx').on(t.contactId),
  }),
);

// ─── Password Lockers ────────────────────────────────────────────────────────

export const passwordLockers = sqliteTable(
  'password_lockers',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    service: text('service').notNull().default('other'),
    username: text('username'),
    accountEmail: text('account_email'),
    loginUrl: text('login_url'),
    passwordEncrypted: text('password_encrypted').notNull(),
    passwordIv: text('password_iv').notNull(),
    notes: text('notes'),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('password_lockers_org_idx').on(t.organizationId),
    serviceIdx: index('password_lockers_service_idx').on(t.service),
    contactIdx: index('password_lockers_contact_idx').on(t.contactId),
    companyIdx: index('password_lockers_company_idx').on(t.companyId),
  }),
);

// ─── Custom Fields ────────────────────────────────────────────────────────────

export const customFields = sqliteTable(
  'custom_fields',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entity: text('entity', {
      enum: ['contact', 'company', 'opportunity', 'activity'],
    }).notNull(),
    name: text('name').notNull(),
    key: text('key').notNull(),
    type: text('type', {
      enum: [
        'text',
        'long_text',
        'number',
        'currency',
        'date',
        'datetime',
        'dropdown',
        'multi_select',
        'email',
        'phone',
        'url',
        'boolean',
        'tags',
        'relationship',
      ],
    }).notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    order: integer('order').notNull().default(0),
    options: text('options', { mode: 'json' }).$type<unknown[]>(),
    relationEntity: text('relation_entity'),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgEntityIdx: index('custom_fields_org_entity_idx').on(t.organizationId, t.entity),
    uniqueKeyIdx: uniqueIndex('custom_fields_unique_key_idx').on(t.organizationId, t.entity, t.key),
  }),
);

// ─── Documents ────────────────────────────────────────────────────────────────

export const folders = sqliteTable(
  'folders',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    path: text('path').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
    permissions: text('permissions', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('folders_org_idx').on(t.organizationId),
    parentIdx: index('folders_parent_idx').on(t.parentId),
  }),
);

export const documents = sqliteTable(
  'documents',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    originalName: text('original_name').notNull(),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    extension: text('extension').notNull(),
    r2Key: text('r2_key').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    description: text('description'),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    lockedBy: text('locked_by').references(() => users.id),
    lockedAt: text('locked_at'),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, {
      onDelete: 'set null',
    }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    currentVersion: integer('current_version').notNull().default(1),
    permissions: text('permissions', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('documents_org_idx').on(t.organizationId),
    folderIdx: index('documents_folder_idx').on(t.folderId),
    ownerIdx: index('documents_owner_idx').on(t.ownerId),
    mimeTypeIdx: index('documents_mime_type_idx').on(t.mimeType),
  }),
);

export const documentVersions = sqliteTable(
  'document_versions',
  {
    ...id,
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    r2Key: text('r2_key').notNull(),
    size: integer('size').notNull(),
    uploadedBy: text('uploaded_by').notNull(),
    changeNote: text('change_note'),
    ...timestamps,
  },
  (t) => ({
    docIdx: index('doc_versions_doc_idx').on(t.documentId),
  }),
);

// ─── Stripe ───────────────────────────────────────────────────────────────────

export const stripeCustomers = sqliteTable(
  'stripe_customers',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    currency: text('currency').notNull().default('usd'),
    balance: integer('balance').notNull().default(0),
    delinquent: integer('delinquent', { mode: 'boolean' }).notNull().default(false),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
    ...timestamps,
  },
  (t) => ({
    stripeIdIdx: uniqueIndex('stripe_customers_stripe_id_idx').on(t.stripeCustomerId),
    orgIdx: index('stripe_customers_org_idx').on(t.organizationId),
    emailIdx: index('stripe_customers_email_idx').on(t.email),
  }),
);

export const stripeInvoices = sqliteTable(
  'stripe_invoices',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripeInvoiceId: text('stripe_invoice_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => stripeCustomers.id),
    status: text('status', {
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
    })
      .notNull()
      .default('draft'),
    number: text('number'),
    currency: text('currency').notNull().default('usd'),
    subtotal: integer('subtotal').notNull().default(0),
    tax: integer('tax').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull().default(0),
    amountPaid: integer('amount_paid').notNull().default(0),
    amountDue: integer('amount_due').notNull().default(0),
    lineItems: text('line_items', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    dueDate: text('due_date'),
    paidAt: text('paid_at'),
    periodStart: text('period_start'),
    periodEnd: text('period_end'),
    pdfUrl: text('pdf_url'),
    hostedUrl: text('hosted_url'),
    ...timestamps,
  },
  (t) => ({
    stripeIdIdx: uniqueIndex('stripe_invoices_stripe_id_idx').on(t.stripeInvoiceId),
    orgIdx: index('stripe_invoices_org_idx').on(t.organizationId),
    customerIdx: index('stripe_invoices_customer_idx').on(t.customerId),
    statusIdx: index('stripe_invoices_status_idx').on(t.status),
  }),
);

export const stripeSubscriptions = sqliteTable(
  'stripe_subscriptions',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => stripeCustomers.id),
    status: text('status', {
      enum: [
        'active',
        'trialing',
        'past_due',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'unpaid',
        'paused',
      ],
    })
      .notNull()
      .default('active'),
    planName: text('plan_name').notNull(),
    planId: text('plan_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    currency: text('currency').notNull().default('usd'),
    amount: integer('amount').notNull().default(0),
    interval: text('interval', { enum: ['month', 'year', 'week', 'day'] }).notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    currentPeriodStart: text('current_period_start').notNull(),
    currentPeriodEnd: text('current_period_end').notNull(),
    cancelAt: text('cancel_at'),
    canceledAt: text('canceled_at'),
    trialStart: text('trial_start'),
    trialEnd: text('trial_end'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
    ...timestamps,
  },
  (t) => ({
    stripeIdIdx: uniqueIndex('stripe_subs_stripe_id_idx').on(t.stripeSubscriptionId),
    orgIdx: index('stripe_subs_org_idx').on(t.organizationId),
    customerIdx: index('stripe_subs_customer_idx').on(t.customerId),
    statusIdx: index('stripe_subs_status_idx').on(t.status),
  }),
);

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  owner: one(users, {
    fields: [contacts.ownerId],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
  contacts: many(contacts),
  opportunities: many(opportunities),
  stripeCustomers: many(stripeCustomers),
}));

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  contact: one(contacts, {
    fields: [opportunities.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [opportunities.companyId],
    references: [companies.id],
  }),
  owner: one(users, {
    fields: [opportunities.ownerId],
    references: [users.id],
  }),
}));

export const stripeCustomersRelations = relations(stripeCustomers, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [stripeCustomers.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [stripeCustomers.companyId],
    references: [companies.id],
  }),
  invoices: many(stripeInvoices),
  subscriptions: many(stripeSubscriptions),
}));

export const stripeInvoicesRelations = relations(stripeInvoices, ({ one }) => ({
  customer: one(stripeCustomers, {
    fields: [stripeInvoices.customerId],
    references: [stripeCustomers.id],
  }),
}));

export const stripeSubscriptionsRelations = relations(stripeSubscriptions, ({ one }) => ({
  customer: one(stripeCustomers, {
    fields: [stripeSubscriptions.customerId],
    references: [stripeCustomers.id],
  }),
}));

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsDomains = sqliteTable(
  'analytics_domains',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    zoneId: text('zone_id').notNull(),
    status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('analytics_domains_org_idx').on(t.organizationId),
    zoneIdIdx: uniqueIndex('analytics_domains_zone_id_idx').on(t.organizationId, t.zoneId),
  }),
);

export const analyticsSnapshots = sqliteTable(
  'analytics_snapshots',
  {
    ...id,
    domainId: text('domain_id')
      .notNull()
      .references(() => analyticsDomains.id, { onDelete: 'cascade' }),
    zoneId: text('zone_id').notNull(),
    metrics: text('metrics', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    trafficTimeseries: text('traffic_timeseries', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    topPages: text('top_pages', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    topCountries: text('top_countries', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    securityEvents: text('security_events', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
    dateFilter: text('date_filter', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    capturedAt: text('captured_at').notNull(),
    ...timestamps,
  },
  (t) => ({
    domainIdx: index('analytics_snapshots_domain_idx').on(t.domainId),
    capturedAtIdx: index('analytics_snapshots_captured_at_idx').on(t.capturedAt),
  }),
);

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = sqliteTable(
  'notifications',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
    actionUrl: text('action_url'),
    readAt: text('read_at'),
    ...timestamps,
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId),
    isReadIdx: index('notifications_is_read_idx').on(t.isRead),
    orgIdx: index('notifications_org_idx').on(t.organizationId),
  }),
);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    entityLabel: text('entity_label').notNull(),
    changes: text('changes', { mode: 'json' }).$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('audit_logs_org_idx').on(t.organizationId),
    userIdx: index('audit_logs_user_idx').on(t.userId),
    entityIdx: index('audit_logs_entity_idx').on(t.entity, t.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  }),
);

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable(
  'api_keys',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdBy: text('created_by').notNull(),
    lastUsedAt: text('last_used_at'),
    expiresAt: text('expires_at'),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('api_keys_org_idx').on(t.organizationId),
    keyHashIdx: uniqueIndex('api_keys_key_hash_idx').on(t.keyHash),
  }),
);

// ─── Saved Views ──────────────────────────────────────────────────────────────

export const savedViews = sqliteTable(
  'saved_views',
  {
    ...id,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    entity: text('entity', {
      enum: ['contacts', 'companies', 'opportunities', 'activities'],
    }).notNull(),
    viewType: text('view_type', { enum: ['table', 'kanban', 'list', 'calendar'] })
      .notNull()
      .default('table'),
    filters: text('filters', { mode: 'json' }).$type<unknown>(),
    sort: text('sort', { mode: 'json' }).$type<unknown>(),
    columns: text('columns', { mode: 'json' }).$type<string[]>().notNull().default([]),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgEntityIdx: index('saved_views_org_entity_idx').on(t.organizationId, t.entity),
  }),
);

// ─── Services Catalog ─────────────────────────────────────────────────────────
// Global catalog of third-party services used to service clients

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
    billingType: text('billing_type', { enum: ['fixed', 'per_seat', 'usage'] })
      .notNull()
      .default('fixed'),
    // For fixed/per_seat: unit cost in cents (e.g. 1200 = $12.00)
    unitCostCents: integer('unit_cost_cents').notNull().default(0),
    // Default markup percentage (e.g. 25 = 25%)
    defaultMarkupPct: real('default_markup_pct').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    billingCycle: text('billing_cycle', { enum: ['monthly', 'annual', 'one_time'] })
      .notNull()
      .default('monthly'),
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

// ─── Client Service Assignments ───────────────────────────────────────────────
// Fixed/per_seat services assigned to a specific company

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
    // Quantity (seats, units) — for per_seat billing
    quantity: integer('quantity').notNull().default(1),
    // Override cost (if different from catalog) in cents
    overrideCostCents: integer('override_cost_cents'),
    // What we bill the client in cents
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

// ─── Service Expense Logs ─────────────────────────────────────────────────────
// Monthly usage-based expense logs — actual invoiced amounts per billing period

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
    // Billing period: YYYY-MM (e.g. "2026-05")
    period: text('period').notNull(),
    // Total actual bill for this period in cents
    actualCostCents: integer('actual_cost_cents').notNull().default(0),
    // Optional invoice reference
    invoiceRef: text('invoice_ref'),
    notes: text('notes'),
    // Allocations split across companies: [{ companyId, pct, billedAmountCents }]
    allocations: text('allocations', { mode: 'json' })
      .$type<{ companyId: string; pct: number; billedAmountCents: number }[]>()
      .notNull()
      .default([]),
    createdBy: text('created_by').notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index('svc_expense_logs_org_idx').on(t.organizationId),
    serviceIdx: index('svc_expense_logs_service_idx').on(t.serviceId),
    periodIdx: index('svc_expense_logs_period_idx').on(t.period),
  }),
);
