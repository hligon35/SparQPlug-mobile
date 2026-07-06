import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { companies } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import type { Context } from 'hono';
import { CompanySchema } from '@sparqplug/types';
import { generateId, buildPaginatedResult } from '../lib/utils';
import { z } from 'zod';

export const companiesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_COMPANY_LOGO_SIZE = 5 * 1024 * 1024;
const ACCEPTED_COMPANY_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

type CompanyPayload = z.infer<typeof CompanySchema>;
type CompanyUpdatePayload = Partial<CompanyPayload> & { updatedAt?: string };

type CompanyRow = {
  id: string;
  organization_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  revenue: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  owner_id: string | null;
  status: string;
  tags: string | null;
  address: string | null;
  notes: string | null;
  custom_fields: string | null;
  logo_url: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeCount(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function mapCompanyRow(row: CompanyRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    domain: row.domain,
    industry: row.industry,
    size: row.size,
    revenue: row.revenue,
    phone: row.phone,
    email: row.email,
    website: row.website,
    ownerId: row.owner_id,
    status: row.status,
    tags: safeJson<string[]>(row.tags, []),
    address: safeJson<Record<string, string> | undefined>(row.address, undefined),
    notes: row.notes,
    customFields: safeJson<Record<string, unknown>>(row.custom_fields, {}),
    logoUrl: row.logo_url,
    lastActivityAt: row.last_activity_at,
    contactCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanCompanyCreatePayload(data: Partial<CompanyPayload>): CompanyPayload {
  return {
    name: data.name?.trim() ?? '',
    domain: cleanText(data.domain),
    industry: cleanText(data.industry),
    size: data.size ?? null,
    revenue: data.revenue ?? null,
    phone: cleanText(data.phone),
    email: cleanText(data.email),
    website: cleanText(data.website),
    logoUrl: cleanText(data.logoUrl),
    ownerId: cleanText(data.ownerId),
    status: data.status ?? 'prospect',
    tags: Array.isArray(data.tags) ? data.tags : [],
    address: data.address,
    notes: cleanText(data.notes),
    customFields: data.customFields && typeof data.customFields === 'object' ? data.customFields : {},
  };
}

function cleanCompanyUpdatePayload(data: Partial<CompanyPayload>): CompanyUpdatePayload {
  const update: CompanyUpdatePayload = {};

  if (data.name !== undefined) update.name = data.name.trim();
  if (data.domain !== undefined) update.domain = cleanText(data.domain);
  if (data.industry !== undefined) update.industry = cleanText(data.industry);
  if (data.size !== undefined) update.size = data.size;
  if (data.revenue !== undefined) update.revenue = data.revenue;
  if (data.phone !== undefined) update.phone = cleanText(data.phone);
  if (data.email !== undefined) update.email = cleanText(data.email);
  if (data.website !== undefined) update.website = cleanText(data.website);
  if (data.logoUrl !== undefined) update.logoUrl = cleanText(data.logoUrl);
  if (data.ownerId !== undefined) update.ownerId = cleanText(data.ownerId);
  if (data.status !== undefined) update.status = data.status;
  if (data.tags !== undefined) update.tags = Array.isArray(data.tags) ? data.tags : [];
  if (data.address !== undefined) update.address = data.address;
  if (data.notes !== undefined) update.notes = cleanText(data.notes);
  if (data.customFields !== undefined) update.customFields = data.customFields && typeof data.customFields === 'object' ? data.customFields : {};

  return update;
}

function getCompanyLogoStorageKey(organizationId: string, companyId: string) {
  return `company-logos/${organizationId}/${companyId}`;
}

function buildCompanyLogoUrl(c: Context<{ Bindings: Bindings; Variables: Variables }>, companyId: string) {
  const requestUrl = new URL(c.req.url);
  return `${requestUrl.origin}/api/v1/companies/${companyId}/logo?v=${Date.now()}`;
}

// Logo assets are intentionally public so <img src="..."> can load them without
// a bearer token. Organization-scoped company data below this point is protected.
companiesRouter.get('/:id/logo', async (c) => {
  const db = createDb(c.env.DB);

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, c.req.param('id')),
  });

  if (!company?.logoUrl) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company logo not found' } }, 404);
  }

  const object = await c.env.STORAGE.get(getCompanyLogoStorageKey(company.organizationId, company.id));
  if (!object) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company logo not found in storage' } }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
});

companiesRouter.use('*', authMiddleware);

companiesRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(200).default(25),
      search: z.string().optional(),
      status: z.enum(['active', 'inactive', 'prospect', 'customer', 'churned']).optional(),
    }),
  ),
  async (c) => {
    const orgId = c.get('organizationId');
    const { page, limit, search, status } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const clauses = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (search) {
      clauses.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    const whereSql = clauses.join(' AND ');

    try {
      const rowsResult = await c.env.DB.prepare(
        `SELECT id, organization_id, name, domain, industry, size, revenue, phone, email, website, owner_id, status, tags, address, notes, custom_fields, logo_url, last_activity_at, created_at, updated_at
         FROM companies
         WHERE ${whereSql}
         ORDER BY datetime(created_at) DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(...params, limit, offset)
        .all<CompanyRow>();

      const countResult = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM companies WHERE ${whereSql}`)
        .bind(...params)
        .first<{ count: number | string | bigint }>();

      return c.json({
        success: true,
        data: buildPaginatedResult(
          (rowsResult.results ?? []).map(mapCompanyRow),
          page,
          limit,
          normalizeCount(countResult?.count),
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Company list query failed';
      console.error('[Companies list error]', message);
      return c.json({ success: false, error: { code: 'COMPANY_LIST_FAILED', message } }, 500);
    }
  },
);

companiesRouter.get('/debug/persistence', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const [countResult, recent] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(companies).where(eq(companies.organizationId, orgId)),
    db.query.companies.findMany({
      where: eq(companies.organizationId, orgId),
      limit: 10,
      orderBy: [desc(companies.createdAt)],
    }),
  ]);

  return c.json({
    success: true,
    data: {
      organizationId: orgId,
      total: normalizeCount(countResult[0]?.count),
      recent,
    },
  });
});

companiesRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)),
  });

  if (!company) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);
  }

  return c.json({ success: true, data: company });
});

companiesRouter.post('/', zValidator('json', CompanySchema.partial().extend({ name: z.string().min(1, 'Company name required') })), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = cleanCompanyCreatePayload(c.req.valid('json'));
  const db = createDb(c.env.DB);

  const id = generateId();
  await db.insert(companies).values({ id, organizationId: orgId, ...data, ownerId: data.ownerId ?? userId });
  const company = await db.query.companies.findFirst({ where: and(eq(companies.id, id), eq(companies.organizationId, orgId)) });
  return c.json({ success: true, data: company }, 201);
});

companiesRouter.post('/:id/logo', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const company = await db.query.companies.findFirst({
    where: and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)),
  });

  if (!company) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);
  }

  const body = await c.req.parseBody();
  const logo = body['logo'];

  if (!(logo instanceof File)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Logo file is required' } }, 400);
  }

  if (!ACCEPTED_COMPANY_LOGO_TYPES.has(logo.type)) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Logo must be PNG, JPG, WEBP, or SVG' } }, 400);
  }

  if (logo.size > MAX_COMPANY_LOGO_SIZE) {
    return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Logo must be 5MB or smaller' } }, 400);
  }

  const logoStorageKey = getCompanyLogoStorageKey(orgId, company.id);
  await c.env.STORAGE.put(logoStorageKey, await logo.arrayBuffer(), {
    httpMetadata: {
      contentType: logo.type,
    },
  });

  const logoUrl = buildCompanyLogoUrl(c, company.id);
  await db.update(companies).set({ logoUrl, updatedAt: new Date().toISOString() }).where(eq(companies.id, company.id));
  const updated = await db.query.companies.findFirst({ where: and(eq(companies.id, company.id), eq(companies.organizationId, orgId)) });
  return c.json({ success: true, data: updated });
});

companiesRouter.patch('/:id', zValidator('json', CompanySchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = cleanCompanyUpdatePayload(c.req.valid('json'));
  const db = createDb(c.env.DB);

  const existing = await db.query.companies.findFirst({
    where: and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)),
  });

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);
  }

  await db.update(companies).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(companies.id, existing.id), eq(companies.organizationId, orgId)));
  const updated = await db.query.companies.findFirst({ where: and(eq(companies.id, existing.id), eq(companies.organizationId, orgId)) });
  return c.json({ success: true, data: updated });
});

companiesRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const existing = await db.query.companies.findFirst({
    where: and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)),
  });

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);
  }

  await db.delete(companies).where(and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)));
  await c.env.STORAGE.delete(getCompanyLogoStorageKey(orgId, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});