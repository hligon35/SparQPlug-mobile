import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, StripeCustomer } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function BillingCustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['billing-customers', { search, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<StripeCustomer>>>('/billing/customers', {
        search: search || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const customers = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/billing/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-customers'] });
      toast({ title: 'Customer created', variant: 'success' });
      setShowCreate(false);
      setForm({ name: '', email: '' });
    },
    onError: () => toast({ title: 'Failed to create customer', variant: 'destructive' }),
  });

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing Customers</h1>
          <p className="text-sm text-muted-foreground">{total} customers</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Customer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search customers…"
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Stripe ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No customers found</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-foreground">{c.name ?? c.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{c.stripeCustomerId}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{formatRelative(c.createdAt)}</td>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Billing Customer">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Inc." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email *</label>
            <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="billing@acme.com" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
