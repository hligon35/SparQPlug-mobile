import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../index';
import { verifyFirebaseToken } from '../lib/firebase';
import { createDb } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authMiddleware: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      401,
    );
  }

  const token = authorization.slice(7);

  try {
    const firebaseUser = await verifyFirebaseToken(token, c.env.FIREBASE_SERVICE_ACCOUNT);

    if (!firebaseUser) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        401,
      );
    }

    const db = createDb(c.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUser.uid),
    });

    if (!user) {
      return c.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        401,
      );
    }

    c.set('userId', user.id);
    c.set('organizationId', user.organizationId);
    c.set('userRole', user.role);

    return next();
  } catch (err) {
    console.error('[Auth Middleware]', err);
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication failed' } },
      401,
    );
  }
};
