import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { normalizeUrlField, prefillUrlField } from '@/lib/form-utils';
import { formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type {
  ApiResponse,
  Company,
  Contact,
  PaginatedResponse,
  PasswordLocker,
  PasswordLockerService,
  PasswordReveal,
} from '@sparqplug/types';

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const SERVICE_OPTIONS: Array<{ value: PasswordLockerService; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'other', label: 'Other' },
];

const SERVICE_COLORS: Record<PasswordLockerService, string> = {
  facebook: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  google: 'bg-red-500/15 text-red-600 dark:text-red-400',
  instagram: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  linkedin: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  x: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  tiktok: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  youtube: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  shopify: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  wordpress: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  other: 'bg-muted text-muted-foreground',
};

const EMPTY_FORM = {
  label: '',
  service: 'other' as PasswordLockerService,
  username: '',
  accountEmail: '',
  loginUrl: '',
  password: '',
  notes: '',
  contactId: '',
  companyId: '',
};

function serviceLabel(service: PasswordLockerService): string {
  return SERVICE_OPTIONS.find((item) => item.value === service)?.label ?? 'Other';
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export function PasswordLockersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<PasswordLockerService | ''>('');
  const [page, setPage] = useState(1);
  const [showDialog, setShowDialog] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [editingLocker, setEditingLocker] = useState<PasswordLocker | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [revealedById, setRevealedById] = useState<Record<string, string>>({});
  const revealTimers = useRef<Record<string, number>>({});
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['password-lockers', { search, serviceFilter, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<PasswordLocker>>>('/password-lockers', {
        search: search || undefined,
        service: serviceFilter || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { limit: 200 }),
    enabled: showDialog,
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
    enabled: showDialog,
  });

  const contacts = contactsData?.data?.items ?? [];
  const companies = companiesData?.data?.items ?? [];
  const contactsById = useMemo(
    () => new Map(contacts.map((item) => [item.id, `${item.firstName} ${item.lastName}`])),
    [contacts],
  );
  const companiesById = useMemo(
    () => new Map(companies.map((item) => [item.id, item.name])),
    [companies],
  );

  const lockers = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const createMutation = useMutation({
    mutationFn: (payload: typeof EMPTY_FORM) =>
      api.post('/password-lockers', {
        label: payload.label.trim(),
        service: payload.service,
        username: payload.username.trim() || null,
        accountEmail: payload.accountEmail.trim() || null,
        loginUrl: normalizeUrlField(payload.loginUrl) ?? null,
        password: payload.password,
        notes: payload.notes.trim() || null,
        contactId: payload.contactId || null,
        companyId: payload.companyId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      toast({ title: 'Password entry created', variant: 'success' });
      setShowDialog(false);
      setEditingLocker(null);
      setForm(EMPTY_FORM);
      setShowFormPassword(false);
    },
    onError: () => toast({ title: 'Failed to create password entry', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof EMPTY_FORM }) =>
      api.patch(`/password-lockers/${id}`, {
        label: payload.label.trim(),
        service: payload.service,
        username: payload.username.trim() || null,
        accountEmail: payload.accountEmail.trim() || null,
        loginUrl: normalizeUrlField(payload.loginUrl) ?? null,
        notes: payload.notes.trim() || null,
        contactId: payload.contactId || null,
        companyId: payload.companyId || null,
        ...(payload.password ? { password: payload.password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      toast({ title: 'Password entry updated', variant: 'success' });
      setShowDialog(false);
      setEditingLocker(null);
      setForm(EMPTY_FORM);
      setShowFormPassword(false);
    },
    onError: () => toast({ title: 'Failed to update password entry', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/password-lockers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-lockers'] });
      toast({ title: 'Password entry deleted', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to delete password entry', variant: 'destructive' }),
  });

  const revealMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<ApiResponse<PasswordReveal>>(`/password-lockers/${id}/reveal`);
      return response.data?.password ?? '';
    },
    onError: () => toast({ title: 'Failed to reveal password', variant: 'destructive' }),
  });

  function openCreateDialog() {
    setEditingLocker(null);
    setForm(EMPTY_FORM);
    setShowFormPassword(false);
    setShowDialog(true);
  }

  function openEditDialog(locker: PasswordLocker) {
    setEditingLocker(locker);
    setForm({
      label: locker.label,
      service: locker.service,
      username: locker.username ?? '',
      accountEmail: locker.accountEmail ?? '',
      loginUrl: locker.loginUrl ?? 'https://',
      password: '',
      notes: locker.notes ?? '',
      contactId: locker.contactId ?? '',
      companyId: locker.companyId ?? '',
    });
    setShowFormPassword(false);
    setShowDialog(true);
  }

  async function handleReveal(id: string) {
    if (revealedById[id]) {
      if (revealTimers.current[id]) window.clearTimeout(revealTimers.current[id]);
      setRevealedById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    const password = await revealMutation.mutateAsync(id);
    if (!password) return;

    setRevealedById((current) => ({ ...current, [id]: password }));
    const timerId = window.setTimeout(() => {
      setRevealedById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 20000);
    revealTimers.current[id] = timerId;
  }

  async function handleCopy(id: string) {
    let value = revealedById[id];
    if (!value) {
      const revealed = await revealMutation.mutateAsync(id);
      if (!revealed) return;
      value = revealed;
      setRevealedById((current) => ({ ...current, [id]: revealed }));
    }

    try {
      await copyText(value);
      toast({ title: 'Password copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Unable to copy password', variant: 'destructive' });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingLocker && !form.password) {
      toast({ title: 'Password is required', variant: 'destructive' });
      return;
    }

    if (editingLocker) {
      updateMutation.mutate({ id: editingLocker.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Password Locker</h1>
          <p className="text-sm text-muted-foreground">{total} encrypted credential entries</p>
        </div>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Password
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search service, label, username…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <select
          aria-label="Filter by service"
          title="Filter by service"
          className={`${inputClass} max-w-[220px]`}
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value as PasswordLockerService | '');
            setPage(1);
          }}
        >
          <option value="">All services</option>
          {SERVICE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entry</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Login</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Related</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Password</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Updated</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : lockers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No password entries found
                </td>
              </tr>
            ) : (
              lockers.map((locker) => {
                const revealedValue = revealedById[locker.id];
                return (
                  <tr key={locker.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <KeyRound className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[180px]">{locker.label}</p>
                          <span className={cn('inline-flex mt-0.5 items-center rounded-full px-2 py-0.5 text-xs font-medium', SERVICE_COLORS[locker.service])}>
                            {serviceLabel(locker.service)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-foreground">{locker.username ?? '—'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                        {locker.accountEmail ?? locker.loginUrl ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      <p className="truncate max-w-[160px]">
                        {locker.contactId ? contactsById.get(locker.contactId) ?? 'Contact' : '—'}
                      </p>
                      <p className="truncate max-w-[160px] text-xs">
                        {locker.companyId ? companiesById.get(locker.companyId) ?? 'Company' : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {revealedValue ? (
                        <span className="text-foreground">{revealedValue}</span>
                      ) : (
                        <span className="text-muted-foreground">••••••••••••</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                      {formatRelative(locker.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            void handleReveal(locker.id);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label={revealedValue ? 'Hide password' : 'Reveal password'}
                        >
                          {revealedValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            void handleCopy(locker.id);
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Copy password"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openEditDialog(locker)}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Edit password entry"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete password entry "${locker.label}"?`)) {
                              deleteMutation.mutate(locker.id);
                            }
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                          aria-label="Delete password entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(nextOpen) => {
          setShowDialog(nextOpen);
          if (!nextOpen) {
            setEditingLocker(null);
            setForm(EMPTY_FORM);
            setShowFormPassword(false);
          }
        }}
        title={editingLocker ? 'Edit Password Entry' : 'New Password Entry'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Label *</label>
              <input
                required
                autoFocus
                className={inputClass}
                value={form.label}
                onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
                placeholder="Client Google Ads"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Service</label>
              <select
                aria-label="Service"
                title="Service"
                className={inputClass}
                value={form.service}
                onChange={(e) =>
                  setForm((current) => ({ ...current, service: e.target.value as PasswordLockerService }))
                }
              >
                {SERVICE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input
                autoComplete="username"
                className={inputClass}
                value={form.username}
                onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                placeholder="client@brand.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Account email</label>
              <input
                type="email"
                className={inputClass}
                value={form.accountEmail}
                onChange={(e) => setForm((current) => ({ ...current, accountEmail: e.target.value }))}
                placeholder="owner@brand.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Login URL</label>
            <input
              type="url"
              className={inputClass}
              value={form.loginUrl}
              onFocus={() => setForm((current) => ({ ...current, loginUrl: prefillUrlField(current.loginUrl) }))}
              onChange={(e) => setForm((current) => ({ ...current, loginUrl: e.target.value }))}
              placeholder="https://accounts.google.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Password {editingLocker ? '(leave blank to keep current)' : '*'}
            </label>
            <div className="relative">
              <input
                autoComplete="current-password"
                type={showFormPassword ? 'text' : 'password'}
                required={!editingLocker}
                className={`${inputClass} pr-10 font-mono`}
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                placeholder={editingLocker ? '••••••••' : 'Enter password'}
              />
              <button
                type="button"
                onClick={() => setShowFormPassword((current) => !current)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showFormPassword ? 'Hide password' : 'Show password'}
              >
                {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <select
                aria-label="Contact"
                title="Contact"
                className={inputClass}
                value={form.contactId}
                onChange={(e) => setForm((current) => ({ ...current, contactId: e.target.value }))}
              >
                <option value="">— None —</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <select
                aria-label="Company"
                title="Company"
                className={inputClass}
                value={form.companyId}
                onChange={(e) => setForm((current) => ({ ...current, companyId: e.target.value }))}
              >
                <option value="">— None —</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="2FA details, recovery notes, or client context"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Passwords are encrypted before storage and only revealed on demand.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving…'
                : editingLocker
                  ? 'Save Changes'
                  : 'Create Entry'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
