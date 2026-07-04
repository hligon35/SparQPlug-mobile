import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, RefreshCw, Pencil } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { normalizeBillingInvoicePayload, sanitizeDecimalInput, type BillingInvoiceFormValues } from '@/lib/form-utils';
import type { ApiResponse, PaginatedResponse, StripeInvoice, InvoiceStatus, StripeCustomer } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  paid: 'bg-green-500/15 text-green-600 dark:text-green-400',
  void: 'bg-muted text-muted-foreground line-through',
  uncollectible: 'bg-destructive/15 text-destructive',
};
const initialForm: BillingInvoiceFormValues = {
  customerId: '',
  description: '',
  amount: '',
  currency: 'usd',
  dueDate: '',
  notes: '',
  autoSend: false,
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getInvoiceLabel(invoice: StripeInvoice) {
  return invoice.label || invoice.number || invoice.lineItems?.[0]?.description || invoice.stripeInvoiceId;
}

export function BillingInvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<BillingInvoiceFormValues>(initialForm);
  const [editingInvoice, setEditingInvoice] = useState<StripeInvoice | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['billing-invoices', { page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<StripeInvoice>>>('/billing/invoices', { page, limit: LIMIT }),
  });

  const invoices = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const createMutation = useMutation({
    mutationFn: (data: BillingInvoiceFormValues) => api.post('/billing/invoices', normalizeBillingInvoicePayload(data)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast({ title: 'Invoice created', variant: 'success' });
      setShowCreate(false);
      setForm(initialForm);
    },
    onError: (error) =>
      toast({
        title: 'Failed to create invoice',
        description: getErrorMessage(error, 'Review the invoice details and try again.'),
        variant: 'destructive',
      }),
  });

  const updateLabelMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => api.patch<ApiResponse<StripeInvoice>>(`/billing/invoices/${id}/label`, { label }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast({ title: 'Invoice label saved', variant: 'success' });
      setEditingInvoice(null);
      setEditLabel('');
    },
    onError: (error) =>
      toast({
        title: 'Failed to save invoice label',
        description: getErrorMessage(error, 'The invoice label could not be updated.'),
        variant: 'destructive',
      }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<ApiResponse<{ synced: { customers: number; invoices: number; subscriptions: number } }>>('/billing/sync', { resources: ['customers', 'invoices'] }),
    onSuccess: async (response) => {
      const syncedInvoices = response.data?.synced.invoices ?? 0;
      const syncedCustomers = response.data?.synced.customers ?? 0;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-customers'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-customers-list'] }),
      ]);
      toast({
        title: 'Stripe sync complete',
        description: `Imported ${syncedInvoices} invoices and ${syncedCustomers} customers from Stripe.`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Stripe sync failed',
        description: getErrorMessage(error, 'The backend could not read Stripe invoices.'),
        variant: 'destructive',
      }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['billing-customers-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<StripeCustomer>>>('/billing/customers', { limit: 200 }),
    enabled: showCreate,
  });
  const customersList = customersData?.data?.items ?? [];

  function openEditDialog(invoice: StripeInvoice) {
    setEditingInvoice(invoice);
    setEditLabel(invoice.label ?? getInvoiceLabel(invoice));
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingInvoice || updateLabelMutation.isPending) return;
    updateLabelMutation.mutate({ id: editingInvoice.id, label: editLabel });
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">{total} invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing…' : 'Sync Stripe'}
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Due Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No invoices found. Use Sync Stripe to import existing Stripe invoices.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{getInvoiceLabel(inv)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{inv.stripeInvoiceId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_COLORS[inv.status])}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                    {formatCurrency(inv.amountDue / 100, inv.currency)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {formatDate(inv.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => openEditDialog(inv)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                      Label
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Invoice">
        <form onSubmit={(e) => { e.preventDefault(); if (!createMutation.isPending) createMutation.mutate(form); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Customer *</label>
            <select required aria-label="Invoice customer" className={inputClass} value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
              <option value="">— Select customer —</option>
              {customersList.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Line item *</label>
              <input required className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Monthly retainer" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount ($) *</label>
              <input required type="text" inputMode="decimal" className={inputClass} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: sanitizeDecimalInput(e.target.value) }))} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select aria-label="Invoice currency" className={inputClass} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {['usd', 'eur', 'gbp', 'cad', 'aud'].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Due date</label>
              <input type="date" title="Invoice due date" className={inputClass} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Invoice label</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Internal label shown in SparQPlug"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.autoSend} onChange={(e) => setForm((f) => ({ ...f, autoSend: e.target.checked }))} /> Auto-send invoice</label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">{createMutation.isPending ? 'Creating…' : 'Create Invoice'}</button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editingInvoice)} onOpenChange={(open) => { if (!open) setEditingInvoice(null); }} title="Edit invoice label">
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display label</label>
            <input autoFocus className={inputClass} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Acme monthly retainer" />
            <p className="text-xs text-muted-foreground">This label is saved in SparQPlug and will not be overwritten by Stripe sync.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditingInvoice(null)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={updateLabelMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {updateLabelMutation.isPending ? 'Saving…' : 'Save Label'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}