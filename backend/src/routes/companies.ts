import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { companies } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { CompanySchema } from '@sparqplug/types';
import { generateId, buildPaginatedResult } from '../lib/utils';
import { z } from 'zod';

export const companiesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
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
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
