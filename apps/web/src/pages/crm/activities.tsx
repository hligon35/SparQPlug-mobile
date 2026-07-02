import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, Calendar, FileText, CheckSquare, Activity, Plus } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { normalizeActivityPayload, type ActivityFormValues } from '@/lib/form-utils';
import type { ApiResponse, PaginatedResponse, Activity as ActivityType, ActivityType as AT, Company, Contact } from '@sparqplug/types';

const ACTIVITY_ICONS: Record<AT, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare,
  demo: Activity,
  follow_up: Activity,
};

const ACTIVITY_COLORS: Record<AT, string> = {
  call: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  email: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  meeting: 'bg-green-500/15 text-green-600 dark:text-green-400',
  note: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  task: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  demo: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  follow_up: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
};

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const ACTIVITY_TYPES: AT[] = ['call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up'];
const initialForm: ActivityFormValues = { type: 'call', subject: '', description: '', scheduledAt: '', contactId: '', companyId: '' };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ActivityFormValues>(initialForm);
  const { data, isLoading } = useQuery({
    queryKey: ['activities', { page: 1 }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<ActivityType>>>('/activities', { limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ActivityFormValues) => api.post('/activities', normalizeActivityPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({ title: 'Activity logged', variant: 'success' });
      setShowCreate(false);
      setForm(initialForm);
    },
    onError: (error) =>
      toast({
        title: 'Failed to log activity',
        description: getErrorMessage(error, 'Review the activity details and try again.'),
        variant: 'destructive',
      }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
    enabled: showCreate,
  });
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { limit: 200 }),
    enabled: showCreate,
  });
  const companiesList = companiesData?.data?.items ?? [];
  const contactsList = contactsData?.data?.items ?? [];

  const activities = data?.data?.items ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Activities</h1>
          <p className="text-sm text-muted-foreground">Recent interactions and events</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Log Activity
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-12 text-center text-muted-foreground">
          No activities yet
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-4 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] ?? Activity;
              const colorClass = ACTIVITY_COLORS[activity.type] ?? 'bg-muted text-muted-foreground';
              return (
                <div key={activity.id} className="flex gap-4 relative">
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 z-10', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 rounded-lg border border-border bg-card p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground capitalize">{activity.type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground shrink-0">{formatDateTime(activity.createdAt)}</p>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="Log Activity">
        <form onSubmit={(e) => { e.preventDefault(); if (!createMutation.isPending) createMutation.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select aria-label="Activity type" className={inputClass} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AT, subject: f.subject || e.target.value.replace('_', ' ') }))}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Scheduled at</label>
              <input type="datetime-local" title="Scheduled activity time" className={inputClass} value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Subject *</label>
            <input required className={inputClass} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Follow-up call" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <select aria-label="Activity contact" className={inputClass} value={form.contactId} onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}>
                <option value="">— None —</option>
                {contactsList.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <select aria-label="Activity company" className={inputClass} value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}>
                <option value="">— None —</option>
                {companiesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What happened?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Logging…' : 'Log Activity'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
