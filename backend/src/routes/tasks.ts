import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { tasks } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId, buildPagination } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const tasksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
tasksRouter.use('*', authMiddleware);

tasksRouter.get('/', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(25), status: z.string().optional(), priority: z.string().optional(), assigneeId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit, status, priority, assigneeId } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(tasks.organizationId, orgId)];
  if (status) conditions.push(eq(tasks.status, status as typeof tasks.status._type));
  if (priority) conditions.push(eq(tasks.priority, priority as typeof tasks.priority._type));
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.query.tasks.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(tasks.createdAt)] }),
    db.select({ count: sql<number>`count(*)` }).from(tasks).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: rows, meta: buildPagination(page, limit, countResult[0]?.count ?? 0) });
});

tasksRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const task = await db.query.tasks.findFirst({ where: and(eq(tasks.id, c.req.param('id')), eq(tasks.organizationId, orgId)) });
  if (!task) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  return c.json({ success: true, data: task });
});

tasksRouter.post('/', async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = await c.req.json();
  const db = createDb(c.env.DB);
  const id = generateId();
  await db.insert(tasks).values({ id, organizationId: orgId, createdBy: userId, ...data });
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  return c.json({ success: true, data: task }, 201);
});

tasksRouter.patch('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const data = await c.req.json();
  const db = createDb(c.env.DB);
  const existing = await db.query.tasks.findFirst({ where: and(eq(tasks.id, c.req.param('id')), eq(tasks.organizationId, orgId)) });
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  await db.update(tasks).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(tasks.id, c.req.param('id')));
  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, c.req.param('id')) });
  return c.json({ success: true, data: updated });
});

tasksRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const existing = await db.query.tasks.findFirst({ where: and(eq(tasks.id, c.req.param('id')), eq(tasks.organizationId, orgId)) });
  if (!existing) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  await db.delete(tasks).where(eq(tasks.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
