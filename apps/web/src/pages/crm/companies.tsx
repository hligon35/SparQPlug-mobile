import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Globe, Users, Trash2, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, Company } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function CompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', website: '', size: '' });
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', {
        search: search || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Company deleted', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to delete company', variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Company created', variant: 'success' });
      setShowCreate(false);
      setForm({ name: '', industry: '', website: '', size: '' });
    },
    onError: () => toast({ title: 'Failed to create company', variant: 'destructive' }),
  });

  const companies = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Company
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search companies…"
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Industry</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Website</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Added</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
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
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No companies found</td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/crm/companies/${company.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[160px]">{company.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{company.industry ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {company.website ? (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        <Globe className="h-3 w-3" />
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">{formatRelative(company.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => navigate(`/crm/companies/${company.id}`)} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete ${company.name}?`)) deleteMutation.mutate(company.id); }} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Company">
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company name *</label>
            <input required autoFocus className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Inc." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Industry</label>
              <select className={inputClass} value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
                <option value="">— Select —</option>
                {['Software & Technology','SaaS','E-Commerce','Healthcare','Finance & Fintech','Legal','Real Estate','Marketing & Advertising','Education','Manufacturing','Retail','Consulting','Media & Entertainment','Non-Profit','Government','Other'].map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company size</label>
              <select className={inputClass} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}>
                <option value="">— Select —</option>
                {['1-10','11-50','51-200','201-500','500+'].map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Website</label>
            <input type="url" className={inputClass} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://acme.com" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Company'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
