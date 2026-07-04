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

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanCompanyPayload(data: Partial<CompanyPayload>): CompanyPayload {
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
    const db = createDb(c.env.DB);

    const conditions = [eq(companies.organizationId, orgId)];
    if (search) conditions.push(like(companies.name, `%${search}%`));
    if (status) conditions.push(eq(companies.status, status));

    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db.query.companies.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [desc(companies.createdAt)],
      }),
      db.select({ count: sql<number>`count(*)` }).from(companies).where(and(...conditions)),
    ]);

    return c.json({
      success: true,
      data: buildPaginatedResult(rows, page, limit, countResult[0]?.count ?? 0),
    });
  },
);

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
  const data = cleanCompanyPayload(c.req.valid('json'));
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
  const data = cleanCompanyPayload(c.req.valid('json'));
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