import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Mail, Phone, Trash2, Eye } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/page-shell';
import { ResponsiveDataView } from '@/components/data/responsive-data-view';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeContactPayload, type ContactFormValues } from '@/lib/form-utils';
import type { ApiResponse, PaginatedResponse, Contact, Company, ContactInput } from '@sparqplug/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  inactive: 'bg-muted text-muted-foreground',
  lead: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  customer: 'bg-primary/15 text-primary',
  prospect: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const initialForm: ContactFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  status: 'lead',
  companyId: '',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function renderStatusBadge(status: Contact['status']) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_COLORS[status] ?? STATUS_COLORS['inactive'],
      )}
    >
      {status}
    </span>
  );
}

export function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ContactFormValues>(initialForm);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', {
        search: search || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact deleted', variant: 'success' });
      setContactToDelete(null);
    },
    onError: (error) =>
      toast({
        title: 'Failed to delete contact',
        description: getErrorMessage(error, 'The contact could not be deleted.'),
        variant: 'destructive',
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ContactInput) => api.post('/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact created', variant: 'success' });
      setShowCreate(false);
      setForm(initialForm);
    },
    onError: (error) =>
      toast({
        title: 'Failed to create contact',
        description: getErrorMessage(error, 'Review the contact details and try again.'),
        variant: 'destructive',
      }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
    enabled: showCreate,
  });
  const companiesList = companiesData?.data?.items ?? [];

  const contacts = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const deletePendingId = deleteMutation.isPending ? deleteMutation.variables : undefined;

  function openDeleteDialog(contact: Contact) {
    setContactToDelete(contact);
  }

  function handleDeleteConfirm() {
    if (!contactToDelete || deleteMutation.isPending) {
      return;
    }

    deleteMutation.mutate(contactToDelete.id);
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (createMutation.isPending) {
      return;
    }

    createMutation.mutate(normalizeContactPayload(form));
  }

  const desktopTable = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Email</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">Added</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No contacts found
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-semibold text-primary">
                          {contact.firstName[0]}
                          {contact.lastName[0]}
                        </span>
                      </div>
                      <span className="max-w-[180px] truncate font-medium text-foreground">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="hidden max-w-[220px] truncate px-4 py-3 text-muted-foreground md:table-cell">
                    {contact.email}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {contact.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">{renderStatusBadge(contact.status)}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">
                    {formatRelative(contact.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Email ${contact.firstName} ${contact.lastName}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`View ${contact.firstName} ${contact.lastName}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteDialog(contact)}
                        disabled={deletePendingId === contact.id}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                        aria-label={`Delete ${contact.firstName} ${contact.lastName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const mobileCards = (
    <div className="space-y-3">
      {isLoading ? (
        Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No contacts found
        </div>
      ) : (
        contacts.map((contact) => (
          <article key={contact.id} className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {contact.firstName} {contact.lastName}
                </h2>
                <p className="text-xs text-muted-foreground">Added {formatRelative(contact.createdAt)}</p>
              </div>
              {renderStatusBadge(contact.status)}
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              {contact.email && <p className="truncate">{contact.email}</p>}
              <p>{contact.phone ?? 'No phone number'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  aria-label={`Email ${contact.firstName} ${contact.lastName}`}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  aria-label={`Call ${contact.firstName} ${contact.lastName}`}
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              )}
              <button
                type="button"
                onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                aria-label={`View ${contact.firstName} ${contact.lastName}`}
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              <button
                type="button"
                onClick={() => openDeleteDialog(contact)}
                disabled={deletePendingId === contact.id}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                aria-label={`Delete ${contact.firstName} ${contact.lastName}`}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );

  return (
    <>
      <PageShell
        title="Contacts"
        description={`${total} total contacts`}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Contact
          </button>
        }
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search contacts…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <ResponsiveDataView items={contacts} renderMobile={() => mobileCards} renderDesktop={() => desktopTable} />

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 rounded border border-border px-3 text-xs transition-colors hover:bg-muted disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 rounded border border-border px-3 text-xs transition-colors hover:bg-muted disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </PageShell>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Contact">
        <form
          onSubmit={handleCreateSubmit}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">First name *</label>
              <input required className={inputClass} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jane" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Last name *</label>
              <input required className={inputClass} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email *</label>
            <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select aria-label="Contact status" className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContactFormValues['status'] }))}>
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="customer">Customer</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Job title</label>
              <input list="job-titles" className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="CEO" />
              <datalist id="job-titles">
                {['CEO','CTO','CFO','COO','VP Sales','VP Engineering','Product Manager','Account Executive','Sales Manager','Marketing Manager','Developer','Designer','HR Manager','Operations Manager','Founder'].map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <select aria-label="Associated company" className={inputClass} value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}>
                <option value="">— None —</option>
                {companiesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 rounded-md border border-border px-4 text-sm transition-colors hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {createMutation.isPending ? 'Creating contact…' : 'Create Contact'}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(contactToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setContactToDelete(null);
          }
        }}
        title="Delete contact"
        {...(contactToDelete
          ? {
              description: `Delete ${contactToDelete.firstName} ${contactToDelete.lastName}? This action cannot be undone.`,
            }
          : {})}
        confirmLabel="Delete contact"
        cancelLabel="Keep contact"
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
