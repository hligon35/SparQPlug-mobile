import { z } from 'zod';
import type { BaseEntity } from './common';

// ─── Stripe Customer ──────────────────────────────────────────────────────────

export interface StripeCustomer extends BaseEntity {
  stripeCustomerId: string;
  contactId?: string | null;
  companyId?: string | null;
  email: string;
  name: string;
  phone?: string | null;
  currency: string;
  balance: number;
  delinquent: boolean;
  organizationId: string;
  metadata: Record<string, string>;
}

// ─── Stripe Invoice ───────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  currency: string;
  taxRate?: number;
  discountPercent?: number;
}

export interface StripeInvoice extends BaseEntity {
  stripeInvoiceId: string;
  customerId: string;
  customer?: StripeCustomer;
  status: InvoiceStatus;
  number: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lineItems: InvoiceLineItem[];
  dueDate?: string | null;
  paidAt?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  pdfUrl?: string | null;
  hostedUrl?: string | null;
  organizationId: string;
}

// ─── Stripe Subscription ──────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export interface StripeSubscription extends BaseEntity {
  stripeSubscriptionId: string;
  customerId: string;
  customer?: StripeCustomer;
  status: SubscriptionStatus;
  planName: string;
  planId: string;
  quantity: number;
  currency: string;
  amount: number;
  interval: 'month' | 'year' | 'week' | 'day';
  intervalCount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt?: string | null;
  canceledAt?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  organizationId: string;
  metadata: Record<string, string>;
}

// ─── Revenue Metrics ──────────────────────────────────────────────────────────

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  netMrrGrowth: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  failedPayments: number;
  averageRevenuePerUser: number;
  customerLifetimeValue: number;
  churnRate: number;
}

// ─── Invoice Builder ──────────────────────────────────────────────────────────

export const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Description required'),
        quantity: z.number().positive().default(1),
        unitAmount: z.number().positive('Amount must be positive'),
        taxRate: z.number().min(0).max(100).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1, 'At least one line item required'),
  dueDate: z.string().optional(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  autoSend: z.boolean().default(false),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
