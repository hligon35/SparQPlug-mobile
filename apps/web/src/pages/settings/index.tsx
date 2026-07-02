import { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, Key, User, Server, Plus, Pencil, Trash2, ExternalLink, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth-store';
import { normalizeUrlField, prefillUrlField, sanitizeDecimalInput, sanitizeIntegerInput } from '@/lib/form-utils';
import type { ApiResponse, Organization, TeamMember, ApiKey } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

type Section = 'organization' | 'team' | 'api-keys' | 'profile' | 'services';

const NAV: { label: string; value: Section; icon: React.ElementType }[] = [
  { label: 'Organization', value: 'organization', icon: Building2 },
  { label: 'Team', value: 'team', icon: Users },
  { label: 'Services', value: 'services', icon: Server },
  { label: 'API Keys', value: 'api-keys', icon: Key },
  { label: 'Profile', value: 'profile', icon: User },
];

// ─── Organization section ─────────────────────────────────────────────────────
function OrganizationSection() {
  const { organization } = useAuthStore();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Organization</h2>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
            <p className="text-sm text-foreground">{organization?.name ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug</label>
            <p className="text-sm font-mono text-foreground">{organization?.slug ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</label>
            <p className="text-sm text-foreground capitalize">{organization?.plan ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team section ─────────────────────────────────────────────────────────────
function TeamSection() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'member' });

  const { data, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<ApiResponse<TeamMember[]>>('/settings/team'),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: typeof inviteForm) => api.post('/settings/team/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Invitation sent', variant: 'success' });
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'member' });
    },
    onError: () => toast({ title: 'Failed to send invitation', variant: 'destructive' }),
  });

  const members = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
        <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
              </div>
            </div>
          ))
        ) : members.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">No team members yet</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">{m.name?.[0] ?? m.email[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{m.name ?? m.email}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
            </div>
          ))
        )}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite} title="Invite Team Member">
        <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(inviteForm); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email *</label>
            <input required type="email" className={inputClass} value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input className={inputClass} value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <select aria-label="Invite member role" className={inputClass} value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowInvite(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={inviteMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
} 

// ─── API Keys section ─────────────────────────────────────────────────────────
function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiResponse<ApiKey[]>>('/settings/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => api.post<ApiResponse<{ key: string; apiKey: ApiKey }>>('/settings/api-keys', { name: n }),
    onSuccess: (res) => {
      setNewKey(res.data?.key ?? null);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API key created', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to create API key', variant: 'destructive' }),
  });

  const keys = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">API Keys</h2>

      {newKey && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">Key created — copy it now, it won't be shown again</p>
          <code className="block font-mono text-xs bg-background rounded border border-border px-3 py-2 text-foreground break-all">{newKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: 'Copied to clipboard' }); }} className="text-xs text-primary hover:underline">Copy</button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. Production)"
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          onClick={() => name && createMutation.mutate(name)}
          disabled={!name || createMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating…' : 'Create Key'}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-5 py-4"><div className="h-4 bg-muted animate-pulse rounded w-1/3" /></div>
          ))
        ) : keys.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">No API keys yet</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-5 py-4">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{k.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{k.keyPrefix}••••••••</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {k.lastUsedAt ? `Last used ${formatDate(k.lastUsedAt)}` : 'Never used'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────
function ProfileSection() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Profile</h2>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-semibold text-primary">{user?.name?.[0] ?? '?'}</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Services Catalog section ─────────────────────────────────────────────────

type ServiceCategory = 'hosting' | 'email' | 'auth' | 'storage' | 'database' | 'cdn' | 'payments' | 'analytics' | 'communications' | 'productivity' | 'other';

interface Service {
  id: string;
  name: string;
  provider: string;
  category: ServiceCategory;
  billingType: 'fixed' | 'per_seat' | 'usage';
  unitCostCents: number;
  defaultMarkupPct: number;
  billingCycle: 'monthly' | 'annual' | 'one_time';
  url?: string | null;
  isActive: boolean;
}

const CATEGORIES: ServiceCategory[] = ['hosting', 'email', 'auth', 'storage', 'database', 'cdn', 'payments', 'analytics', 'communications', 'productivity', 'other'];
const BILLING_TYPES = ['fixed', 'per_seat', 'usage'] as const;
const CYCLES = ['monthly', 'annual', 'one_time'] as const;

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  hosting: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  email: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  auth: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  storage: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  database: 'bg-green-500/10 text-green-600 dark:text-green-400',
  cdn: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  payments: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  analytics: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  communications: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  productivity: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  other: 'bg-muted text-muted-foreground',
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  fixed: 'Flat rate',
  per_seat: 'Per seat',
  usage: 'Usage-based',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const EMPTY_SERVICE = {
  name: '', provider: '', category: 'other' as ServiceCategory,
  billingType: 'fixed' as const, unitCostCents: '', defaultMarkupPct: '',
  billingCycle: 'monthly' as const, url: '', notes: '', isActive: true,
};

type ServiceForm = {
  name: string;
  provider: string;
  category: ServiceCategory;
  billingType: 'fixed' | 'per_seat' | 'usage';
  unitCostCents: string;
  defaultMarkupPct: string;
  billingCycle: 'monthly' | 'annual' | 'one_time';
  url: string;
  notes: string;
  isActive: boolean;
};

function ServicesSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>({ ...EMPTY_SERVICE });

  const { data, isLoading } = useQuery({
    queryKey: ['services-catalog'],
    queryFn: () => api.get<{ success: boolean; data: Service[] }>('/services'),
  });

  const services = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/services', {
      ...body,
      unitCostCents: Math.round(Number(body.unitCostCents || '0') * 100),
      defaultMarkupPct: Number(body.defaultMarkupPct || '0'),
      url: normalizeUrlField(body.url),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-catalog'] });
      setShowForm(false);
      setForm({ ...EMPTY_SERVICE });
      toast({ title: 'Service added', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to add service', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) =>
      api.put(`/services/${id}`, {
        ...body,
        unitCostCents: Math.round(Number(body.unitCostCents || '0') * 100),
        defaultMarkupPct: Number(body.defaultMarkupPct || '0'),
        url: normalizeUrlField(body.url),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-catalog'] });
      setEditing(null);
      toast({ title: 'Service updated', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to update service', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-catalog'] });
      toast({ title: 'Service removed' });
    },
  });

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name, provider: s.provider, category: s.category,
      billingType: s.billingType, unitCostCents: (s.unitCostCents / 100).toFixed(2),
      defaultMarkupPct: String(s.defaultMarkupPct), billingCycle: s.billingCycle,
      url: s.url ?? '', notes: '', isActive: s.isActive,
    });
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeForm = showForm || editing !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Services Catalog</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Third-party services you use to service clients</p>
        </div>
        {!activeForm && (
          <button
            onClick={() => { setShowForm(true); setEditing(null); setForm({ ...EMPTY_SERVICE }); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Service
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {activeForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{editing ? 'Edit Service' : 'New Service'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['name', 'provider'] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground capitalize">{field}</label>
                <input
                  type="text"
                  title={field}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={field === 'name' ? 'Cloudflare Workers' : 'Cloudflare'}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                aria-label="Service category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ServiceCategory }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Billing Type</label>
              <select
                aria-label="Service billing type"
                value={form.billingType}
                onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value as typeof form.billingType }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {BILLING_TYPES.map((t) => <option key={t} value={t}>{BILLING_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            {form.billingType !== 'usage' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Unit Cost ($){form.billingType === 'per_seat' ? ' / seat' : ''}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.unitCostCents}
                  onChange={(e) => setForm((f) => ({ ...f, unitCostCents: sanitizeDecimalInput(e.target.value) }))}
                  placeholder="0.00"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Default Markup %</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.defaultMarkupPct}
                onChange={(e) => setForm((f) => ({ ...f, defaultMarkupPct: sanitizeIntegerInput(e.target.value) }))}
                placeholder="0"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Billing Cycle</label>
              <select
                aria-label="Service billing cycle"
                value={form.billingCycle}
                onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as typeof form.billingCycle }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Service URL (optional)</label>
              <input
                type="url"
                value={form.url}
                onFocus={() => setForm((f) => ({ ...f, url: prefillUrlField(f.url) }))}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://console.cloud.google.com"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => editing ? updateMutation.mutate({ id: editing.id, body: form }) : createMutation.mutate(form)}
              disabled={!form.name || !form.provider || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving…' : editing ? 'Update' : 'Add Service'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/5" />
              </div>
            </div>
          ))
        ) : services.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No services yet — add the tools you use to service clients</p>
          </div>
        ) : (
          services.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Server className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[s.category]}`}>
                    {s.category}
                  </span>
                  {!s.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs text-muted-foreground">{s.provider}</p>
                  <span className="text-xs text-muted-foreground">·</span>
                  <p className="text-xs text-muted-foreground">{BILLING_TYPE_LABELS[s.billingType]}</p>
                  {s.billingType !== 'usage' && s.unitCostCents > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs text-muted-foreground">{formatCents(s.unitCostCents)}/{s.billingCycle === 'annual' ? 'yr' : s.billingCycle === 'one_time' ? 'once' : 'mo'}{s.billingType === 'per_seat' ? '/seat' : ''}</p>
                    </>
                  )}
                  {s.defaultMarkupPct > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">{s.defaultMarkupPct}% markup</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" title={`Open ${s.name}`} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button type="button" title={`Edit ${s.name}`} onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" title={`Delete ${s.name}`} onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { section } = useParams<{ section?: Section }>();
  const activeSection: Section = section ?? 'organization';

  const SECTION_MAP: Record<Section, React.ReactNode> = {
    organization: <OrganizationSection />,
    team: <TeamSection />,
    services: <ServicesSection />,
    'api-keys': <ApiKeysSection />,
    profile: <ProfileSection />,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Side nav */}
        <nav className="sm:w-48 shrink-0">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.value}>
                <NavLink
                  to={`/settings/${item.value}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full',
                      (isActive || activeSection === item.value)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {SECTION_MAP[activeSection] ?? <OrganizationSection />}
        </div>
      </div>
    </div>
  );
}
