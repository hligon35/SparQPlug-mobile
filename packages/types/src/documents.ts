import { z } from 'zod';
import type { BaseEntity } from './common';

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface Folder extends BaseEntity {
  name: string;
  parentId?: string | null;
  path: string;
  organizationId: string;
  ownerId: string;
  isShared: boolean;
  permissions: FolderPermission[];
  documentCount: number;
  size: number;
}

export interface FolderPermission {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
}

// ─── Document ─────────────────────────────────────────────────────────────────

export type DocumentMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'video/mp4'
  | 'video/quicktime'
  | 'text/plain'
  | 'text/csv'
  | string;

export interface Document extends BaseEntity {
  name: string;
  originalName: string;
  folderId?: string | null;
  folder?: Folder | null;
  mimeType: DocumentMimeType;
  size: number;
  extension: string;
  r2Key: string;
  r2Url?: string;
  thumbnailUrl?: string;
  tags: string[];
  description?: string | null;
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  organizationId: string;
  ownerId: string;
  versions: DocumentVersion[];
  currentVersion: number;
  permissions: DocumentPermission[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  r2Key: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  changeNote?: string;
}

export interface DocumentPermission {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export const UploadDocumentSchema = z.object({
  name: z.string().min(1, 'File name required'),
  folderId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

export interface PresignedUploadUrl {
  uploadUrl: string;
  r2Key: string;
  expiresAt: number;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

export type PreviewType = 'pdf' | 'image' | 'video' | 'text' | 'office' | 'unsupported';

export function getPreviewType(mimeType: string): PreviewType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return 'text';
  if (
    mimeType.includes('officedocument') ||
    mimeType.includes('msword') ||
    mimeType.includes('ms-excel')
  )
    return 'office';
  return 'unsupported';
}
