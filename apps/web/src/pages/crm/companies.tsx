import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Globe, Users, Trash2, Eye, Pencil } from 'lucide-react';
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
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

function CompanyAvatar({ company, className = 'h-9 w-9 rounded-lg' }: { company: Pick<Company, 'logoUrl' | 'name'>; className?: string }) {
  if (company.logoUrl) {
    return <img src={company.logoUrl} alt={`${company.name} logo`} className={`${className} shrink-0 object-cover`} />;
  }

  return (
    <div className={`flex shrink-0 items-center justify-center bg-muted ${className}`}>
      <Users className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function CompaniesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormValues>(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const LIMIT = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['companies', { search, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', {
        search: search || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const companies = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  async function refreshCompanyQueries() {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['companies'] }),
      queryClient.invalidateQueries({ queryKey: ['companies-list'] }),
    ]);
  }

  async function uploadCompanyLogo(companyId: string) {
    if (!logoFile) return true;

    const body = new FormData();
    body.append('logo', logoFile);

    try {
      await api.post<ApiResponse<Company>>(`/companies/${companyId}/logo`, body);
      return true;
    } catch (error) {
      toast({
        title: 'Company saved, but logo upload failed',
        description: getErrorMessage(error, 'Try uploading the logo again from Edit Company.'),
        variant: 'destructive',
      });
      return false;
    }
  }

  function resetDialogState() {
    setShowDialog(false);
    setEditingCompany(null);
    setForm(initialForm);
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  async function finalizeCompanySave(company: Company | undefined, action: 'created' | 'updated') {
    const companyId = company?.id ?? editingCompany?.id;
    const logoUploaded = companyId ? await uploadCompanyLogo(companyId) : true;

    await refreshCompanyQueries();

    toast(
      logoFile && !logoUploaded
        ? { title: `Company ${action}`, description: 'Company details were saved without updating the logo.', variant: 'success' }
        : { title: `Company ${action}`, variant: 'success' },
    );

    resetDialogState();
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: async () => {
      await refreshCompanyQueries();
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
    mutationFn: (data: CompanyInput) => api.post<ApiResponse<Company>>('/companies', data),
    onSuccess: (response) => {
      void finalizeCompanySave(response.data, 'created');
    },
    onError: (error) =>
      toast({
        title: 'Failed to create company',
        description: getErrorMessage(error, 'Review the company details and try again.'),
        variant: 'destructive',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyInput }) => api.patch<ApiResponse<Company>>(`/companies/${id}`, data),
    onSuccess: (response) => {
      void finalizeCompanySave(response.data, 'updated');
    },
    onError: (error) =>
      toast({
        title: 'Failed to update company',
        description: getErrorMessage(error, 'Review the company details and try again.'),
        variant: 'destructive',
      }),
  });

  const deletePendingId = deleteMutation.isPending ? deleteMutation.variables : undefined;

  function openCreateDialog() {
    setEditingCompany(null);
    setForm(initialForm);
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
    setShowDialog(true);
  }

  function openEditDialog(company: Company) {
    setEditingCompany(company);
    setForm({
      name: company.name,
      industry: company.industry ?? '',
      website: company.website ?? '',
      size: (company.size ?? '') as CompanyFormValues['size'],
    });
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
    setShowDialog(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createMutation.isPending || updateMutation.isPending) return;

    const payload = normalizeCompanyPayload(form, editingCompany?.status ?? 'prospect');
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: payload });
      return;
    }

    createMutation.mutate(payload);
  }

  function handleDeleteConfirm() {
    if (!companyToDelete || deleteMutation.isPending) return;
    deleteMutation.mutate(companyToDelete.id);
  }

  function CompanyActions({ company }: { company: Company }) {
    return (
      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => openEditDialog(company)} className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Edit ${company.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => navigate(`/crm/companies/${company.id}`)} className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`View ${company.name}`}>
          <Eye className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setCompanyToDelete(company)} disabled={deletePendingId === company.id} className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50" aria-label={`Delete ${company.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
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
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /></td>)}</tr>
              ))
            ) : companies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No companies found</td></tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => navigate(`/crm/companies/${company.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CompanyAvatar company={company} />
                      <span className="max-w-[180px] truncate font-medium text-foreground">{company.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{company.industry ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {company.website ? (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        <Globe className="h-3.5 w-3.5" />
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">{formatRelative(company.createdAt)}</td>
                  <td className="px-4 py-3 text-right"><CompanyActions company={company} /></td>
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
        Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-lg border border-border bg-card p-4"><div className="h-4 w-1/2 animate-pulse rounded bg-muted" /></div>)
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">No companies found</div>
      ) : (
        companies.map((company) => (
          <article key={company.id} className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CompanyAvatar company={company} className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 space-y-1">
                  <h2 className="truncate text-base font-semibold text-foreground">{company.name}</h2>
                  <p className="text-xs text-muted-foreground">Added {formatRelative(company.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{company.industry ?? 'No industry set'}</p>
              <p>{company.size ? `${company.size} employees` : 'No company size set'}</p>
              {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline"><Globe className="h-4 w-4" />{company.website.replace(/^https?:\/\//, '')}</a>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => openEditDialog(company)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"><Pencil className="h-4 w-4" />Edit</button>
              <button type="button" onClick={() => navigate(`/crm/companies/${company.id}`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"><Eye className="h-4 w-4" />View</button>
              <button type="button" onClick={() => setCompanyToDelete(company)} disabled={deletePendingId === company.id} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button>
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
        actions={<button type="button" onClick={openCreateDialog} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" />New Company</button>}
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search companies…" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
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

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending && !updateMutation.isPending) {
            resetDialogState();
            return;
          }
          setShowDialog(open);
        }}
        title={editingCompany ? 'Edit Company' : 'New Company'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company logo</label>
            <input ref={logoInputRef} aria-label="Company logo" title="Upload company logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium`} onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or SVG up to 5MB.</p>
            {editingCompany?.logoUrl && !logoFile ? <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"><CompanyAvatar company={editingCompany} className="h-10 w-10 rounded-lg" /><p className="text-xs text-muted-foreground">Current logo will be kept unless you choose a new file.</p></div> : null}
            {logoFile ? <p className="text-xs text-muted-foreground">Selected: {logoFile.name}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={resetDialogState} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending || updateMutation.isPending ? 'Saving company…' : editingCompany ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(companyToDelete)}
        onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setCompanyToDelete(null); }}
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
