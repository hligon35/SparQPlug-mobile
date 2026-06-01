import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, StripeInvoice, InvoiceStatus, StripeCustomer } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  paid: 'bg-green-500/15 text-green-600 dark:text-green-400',
  void: 'bg-muted text-muted-foreground line-through',
  uncollectible: 'bg-destructive/15 text-destructive',
};

export function BillingInvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerEmail: '', amountDue: '', currency: 'usd', dueDate: '' });
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
    mutationFn: (data: typeof form) => api.post('/billing/invoices', {
      ...data,
      amountDue: data.amountDue ? Math.round(parseFloat(data.amountDue) * 100) : 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast({ title: 'Invoice created', variant: 'success' });
      setShowCreate(false);
      setForm({ customerEmail: '', amountDue: '', currency: 'usd', dueDate: '' });
    },
    onError: () => toast({ title: 'Failed to create invoice', variant: 'destructive' }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['billing-customers-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<StripeCustomer>>>('/billing/customers', { limit: 200 }),
    enabled: showCreate,
  });
  const customersList = customersData?.data?.items ?? [];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">{total} invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No invoices found</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-foreground">{inv.stripeInvoiceId}</span>
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
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Customer *</label>
            {customersList.length > 0 ? (
              <select required className={inputClass} value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}>
                <option value="">— Select customer —</option>
                {customersList.map((c) => <option key={c.id} value={c.email}>{c.name} ({c.email})</option>)}
              </select>
            ) : (
              <input required type="email" className={inputClass} value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} placeholder="billing@acme.com" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Amount ($) *</label>
              <input required type="number" min="0" step="0.01" className={inputClass} value={form.amountDue} onChange={(e) => setForm((f) => ({ ...f, amountDue: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select className={inputClass} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {['usd', 'eur', 'gbp', 'cad', 'aud'].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Due date</label>
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
