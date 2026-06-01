import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { users, organizations, apiKeys } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { OrganizationSettingsSchema, UserSettingsSchema, InviteUserSchema } from '@sparqplug/types';
import { z } from 'zod';

export const settingsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
settingsRouter.use('*', authMiddleware);

// ─── Organization ─────────────────────────────────────────────────────────────

settingsRouter.get('/organization', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
  return c.json({ success: true, data: org });
});

settingsRouter.patch('/organization', zValidator('json', OrganizationSettingsSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  await db.update(organizations).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(organizations.id, orgId));
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
  return c.json({ success: true, data: org });
});

// ─── User Profile ─────────────────────────────────────────────────────────────

settingsRouter.get('/profile', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return c.json({ success: true, data: user });
});

settingsRouter.patch('/profile', zValidator('json', UserSettingsSchema.partial()), async (c) => {
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  await db.update(users).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return c.json({ success: true, data: user });
});

// ─── Team Members ─────────────────────────────────────────────────────────────

settingsRouter.get('/team', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const members = await db.query.users.findMany({ where: eq(users.organizationId, orgId) });
  return c.json({ success: true, data: members });
});

settingsRouter.post('/team/invite', zValidator('json', InviteUserSchema), async (c) => {
  // In production: send email invitation via queue
  const data = c.req.valid('json');
  return c.json({ success: true, data: { message: `Invitation sent to ${data.email}` } });
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

settingsRouter.get('/api-keys', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const keys = await db.query.apiKeys.findMany({ where: eq(apiKeys.organizationId, orgId) });
  // Never return the actual key hash
  return c.json({ success: true, data: keys.map(k => ({ ...k, keyHash: undefined })) });
});

settingsRouter.post('/api-keys', zValidator('json', z.object({ name: z.string().min(1), scopes: z.array(z.string()).default([]) })), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const { name, scopes } = c.req.valid('json');
  const db = createDb(c.env.DB);

  // Generate a secure API key
  const rawKey = `spq_${generateId()}${generateId()}`;
  const keyPrefix = rawKey.substring(0, 12);

  // Hash the key for storage
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const id = generateId();
  await db.insert(apiKeys).values({ id, organizationId: orgId, name, keyHash, keyPrefix, scopes, createdBy: userId });

  return c.json({ success: true, data: { id, name, key: rawKey, keyPrefix, scopes } }, 201);
});

settingsRouter.delete('/api-keys/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  await db.delete(apiKeys).where(eq(apiKeys.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
