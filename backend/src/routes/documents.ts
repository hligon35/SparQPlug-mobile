import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { documents, folders, documentVersions } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { generateId, buildPagination } from '../lib/utils';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const documentsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
documentsRouter.use('*', authMiddleware);

// ─── Folders ──────────────────────────────────────────────────────────────────

documentsRouter.get('/folders', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const rows = await db.query.folders.findMany({ where: eq(folders.organizationId, orgId), orderBy: [desc(folders.name)] });
  return c.json({ success: true, data: rows });
});

documentsRouter.post('/folders', zValidator('json', z.object({ name: z.string().min(1), parentId: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const { name, parentId } = c.req.valid('json');
  const db = createDb(c.env.DB);

  let path = `/${name}`;
  if (parentId) {
    const parent = await db.query.folders.findFirst({ where: eq(folders.id, parentId) });
    if (parent) path = `${parent.path}/${name}`;
  }

  const id = generateId();
  await db.insert(folders).values({ id, organizationId: orgId, name, parentId, path, ownerId: userId, isShared: false, permissions: [], createdBy: userId });
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, id) });
  return c.json({ success: true, data: folder }, 201);
});

// ─── Documents ────────────────────────────────────────────────────────────────

documentsRouter.get('/', zValidator('query', z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(25), folderId: z.string().optional(), search: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const { page, limit, folderId } = c.req.valid('query');
  const db = createDb(c.env.DB);
  const conditions = [eq(documents.organizationId, orgId)];
  if (folderId) conditions.push(eq(documents.folderId, folderId));
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.query.documents.findMany({ where: and(...conditions), limit, offset, orderBy: [desc(documents.createdAt)] }),
    db.select({ count: sql<number>`count(*)` }).from(documents).where(and(...conditions)),
  ]);
  return c.json({ success: true, data: rows, meta: buildPagination(page, limit, countResult[0]?.count ?? 0) });
});

// ─── Presigned Upload URL ─────────────────────────────────────────────────────

documentsRouter.post('/upload-url', zValidator('json', z.object({ name: z.string().min(1), mimeType: z.string().min(1), size: z.number().positive(), folderId: z.string().optional() })), async (c) => {
  const { name, mimeType } = c.req.valid('json');
  const r2Key = `uploads/${generateId()}/${name}`;

  const signedUrl = await c.env.STORAGE.createMultipartUpload(r2Key);

  return c.json({
    success: true,
    data: {
      uploadId: signedUrl.uploadId,
      r2Key,
      // Note: actual presigned URLs require R2 custom domain or presigned URL generation
      uploadUrl: `/api/v1/documents/upload/${encodeURIComponent(r2Key)}`,
    },
  });
});

// ─── Complete Upload ──────────────────────────────────────────────────────────

documentsRouter.post('/complete-upload', zValidator('json', z.object({ r2Key: z.string().min(1), name: z.string().min(1), originalName: z.string().min(1), mimeType: z.string().min(1), size: z.number().positive(), folderId: z.string().optional(), tags: z.array(z.string()).default([]), description: z.string().optional() })), async (c) => {
  const orgId = c.get('organizationId');
  const userId = c.get('userId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const extension = data.originalName.split('.').pop() ?? '';
  const id = generateId();
  await db.insert(documents).values({ id, organizationId: orgId, ...data, extension, r2Key: data.r2Key, ownerId: userId, currentVersion: 1, permissions: [], isLocked: false, createdBy: userId });

  const versionId = generateId();
  await db.insert(documentVersions).values({ id: versionId, documentId: id, version: 1, r2Key: data.r2Key, size: data.size, uploadedBy: userId });

  const document = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  return c.json({ success: true, data: document }, 201);
});

documentsRouter.get('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, c.req.param('id')), eq(documents.organizationId, orgId)) });
  if (!doc) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);

  // Generate signed URL for download
  const obj = await c.env.STORAGE.get(doc.r2Key);
  if (!obj) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found in storage' } }, 404);

  return c.json({ success: true, data: { ...doc, downloadUrl: `/api/v1/documents/${doc.id}/download` } });
});

documentsRouter.get('/:id/download', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, c.req.param('id')), eq(documents.organizationId, orgId)) });
  if (!doc) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);

  const obj = await c.env.STORAGE.get(doc.r2Key);
  if (!obj) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found in storage' } }, 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${doc.originalName}"`,
      'Content-Length': String(doc.size),
    },
  });
});

documentsRouter.delete('/:id', async (c) => {
  const orgId = c.get('organizationId');
  const db = createDb(c.env.DB);
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, c.req.param('id')), eq(documents.organizationId, orgId)) });
  if (!doc) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  await c.env.STORAGE.delete(doc.r2Key);
  await db.delete(documents).where(eq(documents.id, c.req.param('id')));
  return c.json({ success: true, data: { id: c.req.param('id') } });
});
