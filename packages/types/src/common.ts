import { z } from 'zod';

// ─── Pagination ──────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(25),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  cursor?: string;
}

// ─── Sort & Filter ────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterGroup {
  logic: 'and' | 'or';
  conditions: Array<FilterCondition | FilterGroup>;
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'dropdown'
  | 'multi_select'
  | 'email'
  | 'phone'
  | 'url'
  | 'boolean'
  | 'tags'
  | 'relationship';

export interface CustomFieldOption {
  id: string;
  label: string;
  color?: string;
  order: number;
}

export interface CustomField {
  id: string;
  organizationId: string;
  entity: 'contact' | 'company' | 'opportunity' | 'activity';
  name: string;
  key: string;
  type: CustomFieldType;
  required: boolean;
  hidden: boolean;
  order: number;
  options?: CustomFieldOption[];
  relationEntity?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Common Entity Fields ─────────────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';

// ─── User Roles ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'sales' | 'accounting' | 'read_only';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 5,
  manager: 4,
  sales: 3,
  accounting: 2,
  read_only: 1,
};

// ─── Module Permissions ───────────────────────────────────────────────────────

export type Module =
  | 'dashboard'
  | 'crm'
  | 'analytics'
  | 'billing'
  | 'documents'
  | 'automations'
  | 'administration'
  | 'settings';

export type Permission = 'read' | 'write' | 'delete' | 'admin';

export interface ModulePermission {
  module: Module;
  permissions: Permission[];
}
