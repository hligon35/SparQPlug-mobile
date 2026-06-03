import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { PasswordLockerSchema } from '@sparqplug/types';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { companies, contacts, passwordLockers } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { buildPagination, generateId } from '../lib/utils';
import { decryptSecret, encryptSecret } from '../lib/secrets';

export const passwordLockersRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

passwordLockersRouter.use('*', authMiddleware);

function getLockerSecret(c: { env: Bindings }): string {
  return c.env.PASSWORD_LOCKER_KEY ?? c.env.JWT_SECRET;
}

function sanitizeLocker(locker: typeof passwordLockers.$inferSelect) {
  return {
    id: locker.id,
    organizationId: locker.organizationId,
    label: locker.label,
    service: locker.service,
    username: locker.username,
    accountEmail: locker.accountEmail,
    loginUrl: locker.loginUrl,
    notes: locker.notes,
    contactId: locker.contactId,
    companyId: locker.companyId,
    createdBy: locker.createdBy,
    createdAt: locker.createdAt,
    updatedAt: locker.updatedAt,
  };
}

passwordLockersRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(25),
      search: z.string().optional(),
      service: z.string().optional(),
      contactId: z.string().optional(),
      companyId: z.string().optional(),
    }),
  ),
  async (c) => {
    const orgId = c.get('organizationId');
    const { page, limit, search, service, contactId, companyId } = c.req.valid('query');
    const db = createDb(c.env.DB);

    const conditions = [eq(passwordLockers.organizationId, orgId)];
    if (service) conditions.push(eq(passwordLockers.service, service));
    if (contactId) conditions.push(eq(passwordLockers.contactId, contactId));
    if (companyId) conditions.push(eq(passwordLockers.companyId, companyId));
    if (search) {
      const textSearch = `%${search}%`;
      const searchCondition = or(
        like(passwordLockers.label, textSearch),
        like(passwordLockers.service, textSearch),
        like(passwordLockers.username, textSearch),
        like(passwordLockers.accountEmail, textSearch),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      db.query.passwordLockers.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [desc(passwordLockers.updatedAt)],
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(passwordLockers)
        .where(and(...conditions)),
    ]);

    return c.json({
      success: true,
      data: rows.map(sanitizeLocker),
      meta: buildPagination(page, limit, countResult[0]?.count ?? 0),
    });
  },
);

passwordLockersRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const locker = await db.query.passwordLockers.findFirst({
    where: and(eq(passwordLockers.id, c.req.param('id')), eq(passwordLockers.organizationId, orgId)),
  });

  if (!locker) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Password entry not found' } },
      404,
    );
  }

  const [contact, company] = await Promise.all([
    locker.contactId
      ? db.query.contacts.findFirst({
          where: and(eq(contacts.id, locker.contactId), eq(contacts.organizationId, orgId)),
        })
      : Promise.resolve(null),
    locker.companyId
      ? db.query.companies.findFirst({
          where: and(eq(companies.id, locker.companyId), eq(companies.organizationId, orgId)),
        })
      : Promise.resolve(null),
  ]);

  return c.json({
    success: true,
    data: {
      ...sanitizeLocker(locker),
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      companyName: company?.name ?? null,
    },
  });
});

passwordLockersRouter.post('/', zValidator('json', PasswordLockerSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const payload = c.req.valid('json');

  if (payload.contactId) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, payload.contactId), eq(contacts.organizationId, orgId)),
    });
    if (!contact) {
      return c.json(
        { success: false, error: { code: 'INVALID_CONTACT', message: 'Selected contact does not exist' } },
        400,
      );
    }
  }

  if (payload.companyId) {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, payload.companyId), eq(companies.organizationId, orgId)),
    });
    if (!company) {
      return c.json(
        { success: false, error: { code: 'INVALID_COMPANY', message: 'Selected company does not exist' } },
        400,
      );
    }
  }

  const { encrypted, iv } = await encryptSecret(payload.password, getLockerSecret(c), orgId);
  const id = generateId();

  await db.insert(passwordLockers).values({
    id,
    organizationId: orgId,
    label: payload.label,
    service: payload.service,
    username: payload.username ?? null,
    accountEmail: payload.accountEmail ?? null,
    loginUrl: payload.loginUrl ?? null,
    passwordEncrypted: encrypted,
    passwordIv: iv,
    notes: payload.notes ?? null,
    contactId: payload.contactId ?? null,
    companyId: payload.companyId ?? null,
    createdBy: userId,
    updatedBy: userId,
  });

  const created = await db.query.passwordLockers.findFirst({ where: eq(passwordLockers.id, id) });
  return c.json({ success: true, data: created ? sanitizeLocker(created) : null }, 201);
});

passwordLockersRouter.patch('/:id', zValidator('json', PasswordLockerSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const payload = c.req.valid('json');
  const db = createDb(c.env.DB);

  const existing = await db.query.passwordLockers.findFirst({
    where: and(eq(passwordLockers.id, c.req.param('id')), eq(passwordLockers.organizationId, orgId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Password entry not found' } },
      404,
    );
  }

  if (payload.contactId) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, payload.contactId), eq(contacts.organizationId, orgId)),
    });
    if (!contact) {
      return c.json(
        { success: false, error: { code: 'INVALID_CONTACT', message: 'Selected contact does not exist' } },
        400,
      );
    }
  }

  if (payload.companyId) {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, payload.companyId), eq(companies.organizationId, orgId)),
    });
    if (!company) {
      return c.json(
        { success: false, error: { code: 'INVALID_COMPANY', message: 'Selected company does not exist' } },
        400,
      );
    }
  }

  const updateValues: Partial<typeof passwordLockers.$inferInsert> = {
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  if (payload.label !== undefined) updateValues.label = payload.label;
  if (payload.service !== undefined) updateValues.service = payload.service;
  if (payload.username !== undefined) updateValues.username = payload.username;
  if (payload.accountEmail !== undefined) updateValues.accountEmail = payload.accountEmail;
  if (payload.loginUrl !== undefined) updateValues.loginUrl = payload.loginUrl;
  if (payload.notes !== undefined) updateValues.notes = payload.notes;
  if (payload.contactId !== undefined) updateValues.contactId = payload.contactId;
  if (payload.companyId !== undefined) updateValues.companyId = payload.companyId;

  if (payload.password !== undefined) {
    const { encrypted, iv } = await encryptSecret(payload.password, getLockerSecret(c), orgId);
    updateValues.passwordEncrypted = encrypted;
    updateValues.passwordIv = iv;
  }

  await db.update(passwordLockers).set(updateValues).where(eq(passwordLockers.id, c.req.param('id')));

  const updated = await db.query.passwordLockers.findFirst({ where: eq(passwordLockers.id, c.req.param('id')) });
  return c.json({ success: true, data: updated ? sanitizeLocker(updated) : null });
});

passwordLockersRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const existing = await db.query.passwordLockers.findFirst({
    where: and(eq(passwordLockers.id, c.req.param('id')), eq(passwordLockers.organizationId, orgId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Password entry not found' } },
      404,
    );
  }

  await db.delete(passwordLockers).where(eq(passwordLockers.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});

passwordLockersRouter.post('/:id/reveal', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const existing = await db.query.passwordLockers.findFirst({
    where: and(eq(passwordLockers.id, c.req.param('id')), eq(passwordLockers.organizationId, orgId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Password entry not found' } },
      404,
    );
  }

  const password = await decryptSecret(
    existing.passwordEncrypted,
    existing.passwordIv,
    getLockerSecret(c),
    orgId,
  );

  c.header('Cache-Control', 'no-store, max-age=0');
  c.header('Pragma', 'no-cache');
  return c.json({ success: true, data: { id: existing.id, password } });
});
