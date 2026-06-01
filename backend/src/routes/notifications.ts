import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { notifications } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

export const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
notificationsRouter.use('*', authMiddleware);

notificationsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), eq(notifications.organizationId, orgId)),
    orderBy: [desc(notifications.createdAt)],
    limit: 50,
  });
  return c.json({ success: true, data: rows });
});

notificationsRouter.post('/:id/read', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  await db.update(notifications).set({ isRead: true, readAt: new Date().toISOString() }).where(and(eq(notifications.id, c.req.param('id')), eq(notifications.userId, userId)));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});

notificationsRouter.post('/read-all', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  await db.update(notifications).set({ isRead: true, readAt: new Date().toISOString() }).where(eq(notifications.userId, userId));
  return c.json({ success: true, data: { message: 'All notifications marked as read' } });
});
