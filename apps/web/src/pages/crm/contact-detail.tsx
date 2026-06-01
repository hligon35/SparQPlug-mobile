import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import type { ApiResponse, Contact, Company, PaginatedResponse } from '@sparqplug/types';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [companyIdDraft, setCompanyIdDraft] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<ApiResponse<Contact>>(`/contacts/${id}`),
    enabled: !!id,
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list-for-contact-edit'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
    enabled: !!id,
  });

  const companies = companiesData?.data?.data ?? [];

  const updateCompanyMutation = useMutation({
    mutationFn: (nextCompanyId: string | null) => api.patch(`/contacts/${id}`, { companyId: nextCompanyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setCompanyIdDraft(null);
      toast({ title: 'Company updated', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Failed to update company', variant: 'destructive' });
    },
  });

  const contact = data?.data;
  const selectedCompanyId = companyIdDraft ?? (contact?.companyId ?? '');
  const normalizedSelectedCompanyId = selectedCompanyId ? selectedCompanyId : null;
  const currentCompanyId = contact?.companyId ?? null;
  const hasCompanyChange = normalizedSelectedCompanyId !== currentCompanyId;

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6 text-center text-muted-foreground">Contact not found.</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-semibold text-primary">
            {contact.firstName[0]}{contact.lastName[0]}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {contact.firstName} {contact.lastName}
          </h1>
          {contact.title && <p className="text-muted-foreground">{contact.title}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            Added {formatRelative(contact.createdAt)}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
          { icon: Phone, label: 'Phone', value: contact.phone },
          { icon: Building2, label: 'Company', value: contact.company?.name ?? contact.companyId },
        ].map(({ icon: Icon, label, value, href }) =>
          value ? (
            <div key={label} className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
              <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                {href ? (
                  <a href={href} className="text-sm text-primary hover:underline">{value}</a>
                ) : (
                  <p className="text-sm text-foreground">{value}</p>
                )}
              </div>
            </div>
          ) : null,
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Relationship</p>
          <p className="text-sm text-muted-foreground mt-1">
            Assign this contact to a company or clear the link.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label htmlFor="company-relationship-select" className="sr-only">
            Company relationship
          </label>
          <select
            id="company-relationship-select"
            aria-label="Company relationship"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-0 sm:min-w-[260px]"
            value={selectedCompanyId}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
          >
            <option value="">— No company —</option>
            {companies.map((company: Company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!hasCompanyChange || updateCompanyMutation.isPending}
            onClick={() => updateCompanyMutation.mutate(normalizedSelectedCompanyId)}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateCompanyMutation.isPending ? 'Saving…' : 'Save Relationship'}
          </button>
        </div>
      </div>

      {/* Notes */}
      {contact.notes && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}
    </div>
  );
}
