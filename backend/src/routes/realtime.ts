import { Hono } from 'hono';
import type { Bindings, Variables } from '../index';

export const realtimeRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── WebSocket Upgrade ────────────────────────────────────────────────────────

realtimeRouter.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  const orgId = c.req.query('orgId') ?? 'default';
  const doId = c.env.REALTIME_DO.idFromName(orgId);
  const stub = c.env.REALTIME_DO.get(doId);

  return stub.fetch(c.req.raw);
});
