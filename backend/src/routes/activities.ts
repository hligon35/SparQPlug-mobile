import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { activities } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId, buildPagination } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const activitiesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
activitiesRouter.use('*', authMiddleware);

activitiesRouter.get('/', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(25), contactId: z.string().optional(), companyId: z.string().optional(), type: z.enum(['call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up']).optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit, contactId, companyId, type } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(activities.organizationId, orgId)];
  if (contactId) conditions.push(eq(activities.contactId, contactId));
  if (companyId) conditions.push(eq(activities.companyId, companyId));
  if (type) conditions.push(eq(activities.type, type));
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.query.activities.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(activities.createdAt)] }),
    db.select({ count: sql<number>`count(*)` }).from(activities).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: rows, meta: buildPagination(page, limit, countResult[0]?.count ?? 0) });
});

activitiesRouter.post('/', async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = await c.req.json();
  const db = createDb(c.env.DB);
  const id = generateId();
  await db.insert(activities).values({ id, organizationId: orgId, ownerId: userId, createdBy: userId, ...data });
  const activity = await db.query.activities.findFirst({ where: eq(activities.id, id) });
  return c.json({ success: true, data: activity }, 201);
});

activitiesRouter.patch('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const data = await c.req.json();
  const db = createDb(c.env.DB);
  const existing = await db.query.activities.findFirst({ where: and(eq(activities.id, c.req.param('id')), eq(activities.organizationId, orgId)) });
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Activity not found' } }, 404);
  await db.update(activities).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(activities.id, c.req.param('id')));
  const updated = await db.query.activities.findFirst({ where: eq(activities.id, c.req.param('id')) });
  return c.json({ success: true, data: updated });
});

activitiesRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const existing = await db.query.activities.findFirst({ where: and(eq(activities.id, c.req.param('id')), eq(activities.organizationId, orgId)) });
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Activity not found' } }, 404);
  await db.delete(activities).where(eq(activities.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
