import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { contacts } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { ContactSchema } from '@sparqplug/types';
import { generateId, buildPagination } from '../lib/utils';
import { z } from 'zod';

export const contactsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

contactsRouter.use('*', authMiddleware);

// ─── List Contacts ────────────────────────────────────────────────────────────

contactsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(25),
      search: z.string().optional(),
      status: z.string().optional(),
      companyId: z.string().optional(),
      ownerId: z.string().optional(),
      sort: z.string().default('created_at'),
      dir: z.enum(['asc', 'desc']).default('desc'),
    }),
  ),
  async (c) => {
    const orgId = c.get('organizationId');
    const { page, limit, search, status, companyId, ownerId, sort, dir } = c.req.valid('query');
    const db = createDb(c.env.DB);

    const conditions = [eq(contacts.organizationId, orgId)];
    if (search) conditions.push(like(contacts.firstName, `%${search}%`));
    if (status) conditions.push(eq(contacts.status, status as typeof contacts.status._type));
    if (companyId) conditions.push(eq(contacts.companyId, companyId));
    if (ownerId) conditions.push(eq(contacts.ownerId, ownerId));

    const offset = (page - 1) * limit;
    const orderFn = dir === 'desc' ? desc : asc;

    const [rows, countResult] = await Promise.all([
      db.query.contacts.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [orderFn(contacts.createdAt)],
        with: { company: true },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(and(...conditions)),
    ]);

    const total = countResult[0]?.count ?? 0;

    return c.json({
      success: true,
      data: rows,
      meta: buildPagination(page, limit, total),
    });
  },
);

// ─── Get Contact ──────────────────────────────────────────────────────────────

contactsRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, c.req.param('id')), eq(contacts.organizationId, orgId)),
    with: {
      company: true,
    },
  });

  if (!contact) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } },
      404,
    );
  }

  return c.json({ success: true, data: contact });
});

// ─── Create Contact ───────────────────────────────────────────────────────────

contactsRouter.post('/', zValidator('json', ContactSchema), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const id = generateId();
  await db.insert(contacts).values({
    id,
    organizationId: orgId,
    createdBy: userId,
    ...data,
  });

  const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
  return c.json({ success: true, data: contact }, 201);
});

// ─── Update Contact ───────────────────────────────────────────────────────────

contactsRouter.patch('/:id', zValidator('json', ContactSchema.partial()), async (c) => {
  const orgId = c.get('organizationId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, c.req.param('id')), eq(contacts.organizationId, orgId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } },
      404,
    );
  }

  await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(contacts.id, c.req.param('id')));

  const updated = await db.query.contacts.findFirst({ where: eq(contacts.id, c.req.param('id')) });
  return c.json({ success: true, data: updated });
});

// ─── Delete Contact ───────────────────────────────────────────────────────────

contactsRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);

  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, c.req.param('id')), eq(contacts.organizationId, orgId)),
  });

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } },
      404,
    );
  }

  await db.delete(contacts).where(eq(contacts.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
