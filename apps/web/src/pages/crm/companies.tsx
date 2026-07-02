import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Globe, Users, Trash2, Eye } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/page-shell';
import { ResponsiveDataView } from '@/components/data/responsive-data-view';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeCompanyPayload, prefillUrlField, type CompanyFormValues } from '@/lib/form-utils';
import type { ApiResponse, PaginatedResponse, Company, CompanyInput } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const initialForm: CompanyFormValues = { name: '', industry: '', website: '', size: '' };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function CompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CompanyFormValues>(initialForm);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
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
      setCompanyToDelete(null);
    },
    onError: (error) =>
      toast({
        title: 'Failed to delete company',
        description: getErrorMessage(error, 'The company could not be deleted.'),
        variant: 'destructive',
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyInput) => api.post('/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({ title: 'Company created', variant: 'success' });
      setShowCreate(false);
      setForm(initialForm);
    },
    onError: (error) =>
      toast({
        title: 'Failed to create company',
        description: getErrorMessage(error, 'Review the company details and try again.'),
        variant: 'destructive',
      }),
  });

  const companies = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const deletePendingId = deleteMutation.isPending ? deleteMutation.variables : undefined;

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (createMutation.isPending) {
      return;
    }

    createMutation.mutate(normalizeCompanyPayload(form));
  }

  function handleDeleteConfirm() {
    if (!companyToDelete || deleteMutation.isPending) {
      return;
    }

    deleteMutation.mutate(companyToDelete.id);
  }

  const desktopTable = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Industry</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Website</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">Added</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    </td>
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
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => navigate(`/crm/companies/${company.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="max-w-[180px] truncate font-medium text-foreground">{company.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{company.industry ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">{formatRelative(company.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/crm/companies/${company.id}`)}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`View ${company.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompanyToDelete(company)}
                        disabled={deletePendingId === company.id}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                        aria-label={`Delete ${company.name}`}
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
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No companies found
        </div>
      ) : (
        companies.map((company) => (
          <article key={company.id} className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="truncate text-base font-semibold text-foreground">{company.name}</h2>
                <p className="text-xs text-muted-foreground">Added {formatRelative(company.createdAt)}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{company.industry ?? 'No industry set'}</p>
              <p>{company.size ? `${company.size} employees` : 'No company size set'}</p>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate(`/crm/companies/${company.id}`)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                aria-label={`View ${company.name}`}
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  aria-label={`Open website for ${company.name}`}
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              )}
              <button
                type="button"
                onClick={() => setCompanyToDelete(company)}
                disabled={deletePendingId === company.id}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                aria-label={`Delete ${company.name}`}
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
        title="Companies"
        description={`${total} total companies`}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Company
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
            placeholder="Search companies…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <ResponsiveDataView items={companies} renderMobile={() => mobileCards} renderDesktop={() => desktopTable} />

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-9 rounded border border-border px-3 text-xs transition-colors hover:bg-muted disabled:opacity-40">Prev</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-9 rounded border border-border px-3 text-xs transition-colors hover:bg-muted disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </PageShell>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Company">
        <form
          onSubmit={handleCreateSubmit}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company name *</label>
            <input required autoFocus className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Inc." />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Industry</label>
              <select aria-label="Company industry" className={inputClass} value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
                <option value="">— Select —</option>
                {['Software & Technology','SaaS','E-Commerce','Healthcare','Finance & Fintech','Legal','Real Estate','Marketing & Advertising','Education','Manufacturing','Retail','Consulting','Media & Entertainment','Non-Profit','Government','Other'].map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company size</label>
              <select aria-label="Company size" className={inputClass} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value as CompanyFormValues['size'] }))}>
                <option value="">— Select —</option>
                {['1-10','11-50','51-200','201-500','501-1000','1000+'].map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Website</label>
            <input type="url" className={inputClass} value={form.website} onFocus={() => setForm((f) => ({ ...f, website: prefillUrlField(f.website) }))} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://acme.com" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating company…' : 'Create Company'}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(companyToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setCompanyToDelete(null);
          }
        }}
        title="Delete company"
        {...(companyToDelete ? { description: `Delete ${companyToDelete.name}? This action cannot be undone.` } : {})}
        confirmLabel="Delete company"
        cancelLabel="Keep company"
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
