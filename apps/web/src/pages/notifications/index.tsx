import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { PageShell } from '@/components/layout/page-shell';
import { toast } from '@/components/ui/toaster';
import { formatRelative, cn } from '@/lib/utils';
import type { ApiResponse, Notification } from '@sparqplug/types';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

const TYPE_LABELS: Record<Notification['type'], string> = {
  invoice_paid: 'Invoice Paid',
  invoice_failed: 'Invoice Failed',
  invoice_overdue: 'Invoice Overdue',
  new_contact: 'New Contact',
  task_assigned: 'Task Assigned',
  task_due: 'Task Due',
  document_uploaded: 'Document Uploaded',
  document_shared: 'Document Shared',
  subscription_updated: 'Subscription Updated',
  subscription_canceled: 'Subscription Canceled',
  subscription_trial_ending: 'Trial Ending',
  mention: 'Mention',
  system: 'System',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<ApiResponse<Notification[]>>('/notifications'),
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const markReadMutation = useMutation({
    mutationFn: async (notification: Notification) => {
      if (!notification.isRead) {
        await api.post(`/notifications/${notification.id}/read`);
      }

      return notification;
    },
    onSuccess: (notification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'topbar'] });

      if (notification.actionUrl?.startsWith('/')) {
        navigate(notification.actionUrl);
      }
    },
    onError: (error) =>
      toast({
        title: 'Failed to update notification',
        description: getErrorMessage(error, 'The notification could not be marked as read.'),
        variant: 'destructive',
      }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'topbar'] });
      toast({ title: 'All notifications marked as read', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Failed to mark notifications as read',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      }),
  });

  return (
    <PageShell
      title="Notifications"
      description={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Everything is caught up'}
      actions={
        <button
          type="button"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending || notifications.length === 0 || unreadCount === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          {markAllReadMutation.isPending ? 'Updating…' : 'Mark all read'}
        </button>
      }
    >
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-3 px-4 py-4 sm:px-5">
                <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <BellOff className="h-8 w-8 opacity-40" />
            <div>
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="mt-1">When billing, documents, or tasks trigger alerts, they will show up here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => markReadMutation.mutate(notification)}
                className={cn(
                  'flex w-full flex-col gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:px-5',
                  !notification.isRead && 'bg-primary/5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', !notification.isRead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{TYPE_LABELS[notification.type]}</p>
                    </div>
                  </div>
                  {!notification.isRead && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{formatRelative(notification.createdAt)}</span>
                  <span>{notification.actionUrl ? 'Open related record' : notification.isRead ? 'Read' : 'Unread'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}