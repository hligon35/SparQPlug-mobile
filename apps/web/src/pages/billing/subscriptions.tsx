import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, RefreshCw } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import type { ApiResponse, PaginatedResponse, StripeSubscription, SubscriptionStatus } from '@sparqplug/types';

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

export function BillingSubscriptionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['billing-subscriptions'],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<StripeSubscription>>>('/billing/subscriptions'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post<ApiResponse<{ synced: { customers: number; invoices: number; subscriptions: number } }>>('/billing/sync', { resources: ['customers', 'subscriptions'] }),
    onSuccess: (response) => {
      const syncedSubscriptions = response.data?.synced.subscriptions ?? 0;
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-customers'] });
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

  const subs = data?.data?.items ?? [];

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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="px-4 py-3"><div className="h-4 rounded bg-muted animate-pulse w-3/4" /></td>))}</tr>
              ))
            ) : subs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No subscriptions found. Use Sync Stripe to import existing Stripe subscriptions.</td></tr>
            ) : (
              subs.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-foreground">{sub.stripeSubscriptionId}</span>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
