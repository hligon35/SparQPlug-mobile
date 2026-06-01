import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Mail, Phone, Trash2, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, Contact, Company } from '@sparqplug/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  inactive: 'bg-muted text-muted-foreground',
  lead: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  customer: 'bg-primary/15 text-primary',
};

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function ContactsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', status: 'lead', companyId: '' });
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
    },
    onError: () => toast({ title: 'Failed to delete contact', variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: 'Contact created', variant: 'success' });
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', status: 'lead', companyId: '' });
    },
    onError: () => toast({ title: 'Failed to create contact', variant: 'destructive' }),
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

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search contacts…"
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Added</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
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
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </span>
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[140px]">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground truncate max-w-[180px]">
                    {contact.email}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {contact.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_COLORS[contact.status] ?? STATUS_COLORS['inactive'])}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                    {formatRelative(contact.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Send email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="View contact"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${contact.firstName} ${contact.lastName}?`)) {
                            deleteMutation.mutate(contact.id);
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Contact">
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="lead">Lead</option>
                <option value="active">Active</option>
                <option value="customer">Customer</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Job title</label>
              <input list="job-titles" className={inputClass} value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="CEO" />
              <datalist id="job-titles">
                {['CEO','CTO','CFO','COO','VP Sales','VP Engineering','Product Manager','Account Executive','Sales Manager','Marketing Manager','Developer','Designer','HR Manager','Operations Manager','Founder'].map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <select className={inputClass} value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}>
                <option value="">— None —</option>
                {companiesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Contact'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
