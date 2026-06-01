import { z } from 'zod';
import type { ThemeMode, UserRole, ModulePermission } from './common';

// ─── Organization Settings ────────────────────────────────────────────────────

export const OrganizationSettingsSchema = z.object({
  name: z.string().min(2, 'Organization name required'),
  timezone: z.string().default('America/New_York'),
  currency: z.string().default('USD'),
  dateFormat: z.string().default('MM/DD/YYYY'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  defaultLanguage: z.string().default('en'),
  logoUrl: z.string().url().optional().nullable(),
});

export type OrganizationSettingsInput = z.infer<typeof OrganizationSettingsSchema>;

// ─── User Settings ────────────────────────────────────────────────────────────

export const UserSettingsSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  avatarUrl: z.string().url().optional().nullable(),
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    inApp: z.boolean().default(true),
  }),
  timezone: z.string().optional(),
  language: z.string().default('en'),
});

export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;

// ─── API Key ──────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  organizationId: string;
  createdBy: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

// ─── Integration Config ───────────────────────────────────────────────────────

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  zoneIds: string[];
}

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// ─── User Management ──────────────────────────────────────────────────────────

export const InviteUserSchema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(2, 'Name required'),
  role: z.enum(['admin', 'manager', 'sales', 'accounting', 'read_only']),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  permissions: ModulePermission[];
  status: 'active' | 'invited' | 'suspended';
  lastLoginAt?: string;
  joinedAt: string;
}

export type { ThemeMode };
