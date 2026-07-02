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

function getCompanyLogoStorageKey(organizationId: string, companyId: string) {
  return `company-logos/${organizationId}/${companyId}`;
}

function buildCompanyLogoUrl(c: Context<{ Bindings: Bindings; Variables: Variables }>, companyId: string) {
  const requestUrl = new URL(c.req.url);
  return `${requestUrl.origin}/api/v1/companies/${companyId}/logo?v=${Date.now()}`;
}

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

companiesRouter.post('/', zValidator('json', CompanySchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const id = generateId();
  await db.insert(companies).values({ id, organizationId: orgId, ownerId: userId, ...data });
  const company = await db.query.companies.findFirst({ where: eq(companies.id, id) });
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
  const updated = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
  return c.json({ success: true, data: updated });
});

companiesRouter.patch('/:id', zValidator('json', CompanySchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const existing = await db.query.companies.findFirst({
    where: and(eq(companies.id, c.req.param('id')), eq(companies.organizationId, orgId)),
  });

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } }, 404);
  }

  await db.update(companies).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(companies.id, c.req.param('id')));
  const updated = await db.query.companies.findFirst({ where: eq(companies.id, c.req.param('id')) });
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

  await db.delete(companies).where(eq(companies.id, c.req.param('id')));
  await c.env.STORAGE.delete(getCompanyLogoStorageKey(orgId, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
