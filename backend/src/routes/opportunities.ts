import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { opportunities } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { OpportunitySchema } from '@sparqplug/types';
import { generateId, buildPagination } from '../lib/utils';
import { z } from 'zod';

export const opportunitiesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
opportunitiesRouter.use('*', authMiddleware);

opportunitiesRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(25),
      stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).optional(),
      ownerId: z.string().optional(),
      companyId: z.string().optional(),
    }),
  ),
  async (c) => {
    const orgId = c.get('organizationId');
    const { page, limit, stage, ownerId, companyId } = c.req.valid('query');
    const db = createDb(c.env.DB);

    const conditions = [eq(opportunities.organizationId, orgId)];
    if (stage) conditions.push(eq(opportunities.stage, stage));
    if (ownerId) conditions.push(eq(opportunities.ownerId, ownerId));
    if (companyId) conditions.push(eq(opportunities.companyId, companyId));

    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db.query.opportunities.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [desc(opportunities.createdAt)],
        with: { contact: true, company: true },
      }),
      db.select({ count: sql<number>`count(*)` }).from(opportunities).where(and(...conditions)),
    ]);

    return c.json({
      success: true,
      data: rows,
      meta: buildPagination(page, limit, countResult[0]?.count ?? 0),
    });
  },
);

opportunitiesRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const opp = await db.query.opportunities.findFirst({
    where: and(eq(opportunities.id, c.req.param('id')), eq(opportunities.organizationId, orgId)),
    with: { contact: true, company: true },
  });

  if (!opp) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Opportunity not found' } }, 404);
  }

  return c.json({ success: true, data: opp });
});

opportunitiesRouter.post('/', zValidator('json', OpportunitySchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const id = generateId();
  await db.insert(opportunities).values({ id, organizationId: orgId, createdBy: userId, ...data });
  const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, id) });
  return c.json({ success: true, data: opp }, 201);
});

opportunitiesRouter.patch('/:id', zValidator('json', OpportunitySchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const existing = await db.query.opportunities.findFirst({
    where: and(eq(opportunities.id, c.req.param('id')), eq(opportunities.organizationId, orgId)),
  });

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Opportunity not found' } }, 404);
  }

  await db.update(opportunities).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(opportunities.id, c.req.param('id')));
  const updated = await db.query.opportunities.findFirst({ where: eq(opportunities.id, c.req.param('id')) });
  return c.json({ success: true, data: updated });
});

opportunitiesRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const existing = await db.query.opportunities.findFirst({
    where: and(eq(opportunities.id, c.req.param('id')), eq(opportunities.organizationId, orgId)),
  });

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Opportunity not found' } }, 404);
  }

  await db.delete(opportunities).where(eq(opportunities.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
