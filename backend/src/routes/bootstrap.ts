import { Hono } from 'hono';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { users, organizations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '../lib/utils';

export const bootstrapRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── POST /api/bootstrap ──────────────────────────────────────────────────────
// One-time setup: creates the Firebase account + seeds the admin user in D1.
// Protected by BOOTSTRAP_SECRET env var and disabled in production.
// Bootstrap is for local development or tightly controlled setup only.
//
// curl -X POST http://localhost:8787/api/bootstrap \
//   -H "Content-Type: application/json" \
//   -d '{"secret":"<BOOTSTRAP_SECRET>"}'

bootstrapRouter.post('/', async (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  const body = await c.req.json<{ secret?: string }>();

  const expectedSecret = (c.env as unknown as Record<string, string>)['BOOTSTRAP_SECRET'];
  if (!expectedSecret || body.secret !== expectedSecret) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const adminEmail = (c.env as unknown as Record<string, string>)['ADMIN_EMAIL'];
  const adminPassword = (c.env as unknown as Record<string, string>)['ADMIN_PASSWORD'];
  const adminName = (c.env as unknown as Record<string, string>)['ADMIN_NAME'] ?? 'Admin';
  const orgName = (c.env as unknown as Record<string, string>)['ADMIN_ORG_NAME'] ?? 'SparQPlug';
  const firebaseApiKey = (c.env as unknown as Record<string, string>)['FIREBASE_API_KEY'];

  if (!adminEmail || !adminPassword || !firebaseApiKey) {
    return c.json(
      {
        success: false,
        error: 'Missing required env vars: ADMIN_EMAIL, ADMIN_PASSWORD, FIREBASE_API_KEY',
      },
      400,
    );
  }

  const db = createDb(c.env.DB);

  // Check if admin already seeded
  const existing = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });
  if (existing) {
    return c.json({ success: false, error: 'Admin user already exists' }, 409);
  }

  // Create Firebase account via Identity Toolkit REST API
  const signUpRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true }),
    },
  );

  if (!signUpRes.ok) {
    const err = await signUpRes.json<{ error?: { message?: string } }>();
    return c.json(
      { success: false, error: `Firebase signup failed: ${err?.error?.message ?? 'unknown'}` },
      400,
    );
  }

  const firebaseData = await signUpRes.json<{ localId: string }>();
  const firebaseUid = firebaseData.localId;

  // Seed org + admin user in D1
  const orgId = generateId();
  const userId = generateId();
  const orgSlug = orgName.toLowerCase().replace(/\s+/g, '-');

  await db.insert(organizations).values({
    id: orgId,
    name: orgName,
    slug: orgSlug,
    plan: 'professional',
    settings: {},
  });

  await db.insert(users).values({
    id: userId,
    firebaseUid,
    email: adminEmail,
    name: adminName,
    organizationId: orgId,
    role: 'admin',
    status: 'active',
    permissions: {},
    preferences: { theme: 'dark' },
  });

  return c.json({
    success: true,
    data: {
      message: 'Admin user created. You can now log in with your credentials.',
      email: adminEmail,
      organizationId: orgId,
      userId,
    },
  });
});
