import { z } from 'zod';
import type { BaseEntity, Address, CustomField } from './common';

// ─── Contact ──────────────────────────────────────────────────────────────────

export const ContactSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'lead', 'prospect', 'customer']).default('lead'),
  source: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type ContactInput = z.infer<typeof ContactSchema>;

export interface Contact extends BaseEntity {
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  title?: string | null;
  department?: string | null;
  companyId?: string | null;
  company?: Company | null;
  ownerId?: string | null;
  status: 'active' | 'inactive' | 'lead' | 'prospect' | 'customer';
  source?: string | null;
  tags: string[];
  address?: Address;
  notes?: string | null;
  customFields: Record<string, unknown>;
  organizationId: string;
  lastActivityAt?: string;
  avatarUrl?: string;
}

// ─── Company ──────────────────────────────────────────────────────────────────

export const CompanySchema = z.object({
  name: z.string().min(1, 'Company name required'),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z
    .enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .optional()
    .nullable(),
  revenue: z.number().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'prospect', 'customer', 'churned']).default('prospect'),
  tags: z.array(z.string()).default([]),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CompanyInput = z.infer<typeof CompanySchema>;

export interface Company extends BaseEntity {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  revenue?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  ownerId?: string | null;
  status: 'active' | 'inactive' | 'prospect' | 'customer' | 'churned';
  tags: string[];
  address?: Address;
  notes?: string | null;
  customFields: Record<string, unknown>;
  organizationId: string;
  contactCount: number;
  logoUrl?: string;
  lastActivityAt?: string;
}

// ─── Opportunity ──────────────────────────────────────────────────────────────

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export const OpportunitySchema = z.object({
  name: z.string().min(1, 'Opportunity name required'),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  stage: z
    .enum([
      'prospecting',
      'qualification',
      'proposal',
      'negotiation',
      'closed_won',
      'closed_lost',
    ])
    .default('prospecting'),
  value: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  probability: z.number().min(0).max(100).default(20),
  expectedCloseDate: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type OpportunityInput = z.infer<typeof OpportunitySchema>;

export interface Opportunity extends BaseEntity {
  name: string;
  contactId?: string | null;
  contact?: Contact | null;
  companyId?: string | null;
  company?: Company | null;
  ownerId?: string | null;
  stage: OpportunityStage;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string | null;
  source?: string | null;
  tags: string[];
  notes?: string | null;
  customFields: Record<string, unknown>;
  organizationId: string;
  lastActivityAt?: string;
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task' | 'demo' | 'follow_up';

export interface Activity extends BaseEntity {
  type: ActivityType;
  subject: string;
  description?: string | null;
  contactId?: string | null;
  contact?: Contact | null;
  companyId?: string | null;
  company?: Company | null;
  opportunityId?: string | null;
  opportunity?: Opportunity | null;
  ownerId: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  outcome?: string | null;
  organizationId: string;
}

// ─── Password Locker ─────────────────────────────────────────────────────────

export const PasswordLockerServiceSchema = z.enum([
  'facebook',
  'google',
  'instagram',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'shopify',
  'wordpress',
  'other',
]);

export type PasswordLockerService = z.infer<typeof PasswordLockerServiceSchema>;

export const PasswordLockerSchema = z.object({
  label: z.string().min(1, 'Label is required').max(120),
  service: PasswordLockerServiceSchema.default('other'),
  username: z.string().max(120).optional().nullable(),
  accountEmail: z.string().email().max(254).optional().nullable(),
  loginUrl: z.string().url().max(2048).optional().nullable(),
  password: z.string().min(1, 'Password is required').max(2048),
  notes: z.string().max(4000).optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
});

export type PasswordLockerInput = z.infer<typeof PasswordLockerSchema>;

export interface PasswordLocker extends BaseEntity {
  organizationId: string;
  label: string;
  service: PasswordLockerService;
  username?: string | null;
  accountEmail?: string | null;
  loginUrl?: string | null;
  notes?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}

export interface PasswordReveal {
  id: string;
  password: string;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface Task extends BaseEntity {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  organizationId: string;
}

// ─── Note ─────────────────────────────────────────────────────────────────────

export interface Note extends BaseEntity {
  content: string;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  organizationId: string;
  isPinned: boolean;
}

// ─── CRM View ─────────────────────────────────────────────────────────────────

export type CRMViewType = 'table' | 'kanban' | 'list' | 'calendar';
export type CRMEntity = 'contacts' | 'companies' | 'opportunities' | 'activities';

export interface SavedView {
  id: string;
  name: string;
  entity: CRMEntity;
  viewType: CRMViewType;
  filters: unknown;
  sort: unknown;
  columns: string[];
  isDefault: boolean;
  isShared: boolean;
  organizationId: string;
  createdBy: string;
  createdAt: string;
}

export type { CustomField };
