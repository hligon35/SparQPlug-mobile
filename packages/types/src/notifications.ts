// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationType =
  | 'invoice_paid'
  | 'invoice_failed'
  | 'invoice_overdue'
  | 'new_contact'
  | 'task_assigned'
  | 'task_due'
  | 'document_uploaded'
  | 'document_shared'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_trial_ending'
  | 'mention'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  userId: string;
  organizationId: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  actionUrl?: string;
  createdAt: string;
  readAt?: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'exported'
  | 'shared'
  | 'locked'
  | 'unlocked'
  | 'sent'
  | 'voided';

export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  entityLabel: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
