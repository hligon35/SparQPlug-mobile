import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, RefreshCw, Pencil } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, StripeSubscription, SubscriptionStatus } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  trialing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  past_due: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  canceled: 'bg-muted text-muted-foreground',
  unpaid: 'bg-destructive/15 text-destructive',
  incomplete: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  incomplete_expired: 'bg-muted text-muted-foreground',
  paused: 'bg-muted text-muted-foreground',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getSubscriptionLabel(subscription: StripeSubscription) {
  return subscription.label || subscription.planName || subscription.stripeSubscriptionId;
}

export function BillingSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [editingSubscription, setEditingSubscription] = useState<StripeSubscription | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['billing-subscriptions'],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<StripeSubscription>>>('/billing/subscriptions'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<ApiResponse<{ synced: { customers: number; invoices: number; subscriptions: number } }>>('/billing/sync', { resources: ['customers', 'subscriptions'] }),
    onSuccess: async (response) => {
      const syncedSubscriptions = response.data?.synced.subscriptions ?? 0;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-customers'] }),
      ]);
      toast({
        title: 'Stripe sync complete',
        description: `Imported ${syncedSubscriptions} subscriptions from Stripe.`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Stripe sync failed',
        description: getErrorMessage(error, 'The backend could not read Stripe subscriptions.'),
        variant: 'destructive',
      }),
  });

  const updateLabelMutation = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => api.patch<ApiResponse<StripeSubscription>>(`/billing/subscriptions/${id}`, { label }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      toast({ title: 'Subscription label saved', variant: 'success' });
      setEditingSubscription(null);
      setEditLabel('');
    },
    onError: (error) =>
      toast({
        title: 'Failed to save subscription label',
        description: getErrorMessage(error, 'The subscription label could not be updated.'),
        variant: 'destructive',
      }),
  });

  const subs = data?.data?.items ?? [];

  function openEditDialog(subscription: StripeSubscription) {
    setEditingSubscription(subscription);
    setEditLabel(subscription.label ?? getSubscriptionLabel(subscription));
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSubscription || updateLabelMutation.isPending) return;
    updateLabelMutation.mutate({ id: editingSubscription.id, label: editLabel });
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">{subs.length} synced subscriptions</p>
        </div>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync Stripe'}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subscription</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Interval</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Renews</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (<td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-3/4" /></td>))}</tr>
              ))
            ) : subs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No subscriptions found. Use Sync Stripe to import existing Stripe subscriptions.</td></tr>
            ) : (
              subs.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{getSubscriptionLabel(sub)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{sub.stripeSubscriptionId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_COLORS[sub.status])}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                    {formatCurrency(sub.amount / 100, sub.currency)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground capitalize">{sub.interval}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => openEditDialog(sub)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                      Label
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editingSubscription)} onOpenChange={(open) => { if (!open) setEditingSubscription(null); }} title="Edit subscription label">
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display label</label>
            <input autoFocus className={inputClass} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Client hosting plan" />
            <p className="text-xs text-muted-foreground">This label is saved in SparQPlug and will not be overwritten by Stripe sync.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditingSubscription(null)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={updateLabelMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {updateLabelMutation.isPending ? 'Saving…' : 'Save Label'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}