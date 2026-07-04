import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { users, organizations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyFirebaseToken } from '../lib/firebase';
import { generateId } from '../lib/utils';

export const authRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function slugifyOrganizationName(name: string, fallback: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || fallback;
}

// ─── Verify Firebase Token & Upsert User ─────────────────────────────────────

authRouter.post(
  '/session',
  zValidator(
    'json',
    z.object({
      idToken: z.string().min(1, 'ID token required'),
      organizationName: z.string().trim().min(1).max(120).optional(),
    }),
  ),
  async (c) => {
    const { idToken, organizationName } = c.req.valid('json');
    const db = createDb(c.env.DB);

    // Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(idToken, c.env.FIREBASE_SERVICE_ACCOUNT);
    if (!firebaseUser) {
      return c.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid ID token' } },
        401,
      );
    }

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUser.uid),
    });

    if (!user) {
      // New user — check if they need an org created
      const orgId = generateId();
      const userId = generateId();
      const fallbackOrgName = firebaseUser.email?.split('@')[1] ?? 'My Organization';
      const orgName = organizationName?.trim() || fallbackOrgName;

      await db.insert(organizations).values({
        id: orgId,
        name: orgName,
        slug: slugifyOrganizationName(orgName, orgId),
        plan: 'starter',
        settings: {},
      });

      await db.insert(users).values({
        id: userId,
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        name: firebaseUser.displayName ?? firebaseUser.email ?? 'User',
        organizationId: orgId,
        role: 'admin',
        status: 'active',
        permissions: {},
        preferences: { theme: 'dark' },
      });

      user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
    }

    if (!user) {
      return c.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        404,
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    });

    return c.json({
      success: true,
      data: { user, organization: org },
    });
  },
);

// ─── Get Current User ─────────────────────────────────────────────────────────

authRouter.get('/me', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      401,
    );
  }

  const db = createDb(c.env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
      404,
    );
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.organizationId),
  });

  return c.json({ success: true, data: { user, organization: org } });
});