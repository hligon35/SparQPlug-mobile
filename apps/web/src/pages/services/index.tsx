import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import type { ApiResponse, Company, PaginatedResponse } from '@sparqplug/types';

type ServiceCategory = 'hosting' | 'email' | 'auth' | 'storage' | 'database' | 'cdn' | 'payments' | 'analytics' | 'communications' | 'productivity' | 'other';
type ServiceBillingType = 'fixed' | 'per_seat' | 'usage';
type ServiceBillingCycle = 'monthly' | 'annual' | 'one_time';

type Service = {
  id: string;
  name: string;
  provider: string;
  category: ServiceCategory;
  billingType: ServiceBillingType;
  unitCostCents: number;
  defaultMarkupPct: number;
  currency: string;
  billingCycle: ServiceBillingCycle;
  logoUrl?: string | null;
  url?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
};

type ClientServiceAssignment = {
  assignment: {
    id: string;
    companyId: string;
    serviceId: string;
    quantity: number;
    overrideCostCents?: number | null;
    billedAmountCents: number;
    notes?: string | null;
    isActive: boolean;
  };
  service: Service;
};

type ProfitabilityRow = {
  companyId: string;
  companyName: string;
  costCents: number;
  billedCents: number;
  marginCents: number;
  marginPct: number;
};

type ProfitabilityResponse = {
  period: string;
  summary: ProfitabilityRow[];
  totals: {
    costCents: number;
    billedCents: number;
    marginCents: number;
    marginPct: number;
  };
};

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const textareaClass = 'flex min-h-[76px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const categories: ServiceCategory[] = ['hosting', 'email', 'auth', 'storage', 'database', 'cdn', 'payments', 'analytics', 'communications', 'productivity', 'other'];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function dollarsToCents(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function centsToDollars(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2);
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function ServicesPage() {
  const queryClient = useQueryClient();
  const [serviceForm, setServiceForm] = useState({
    name: '',
    provider: '',
    category: 'other' as ServiceCategory,
    billingType: 'fixed' as ServiceBillingType,
    unitCost: '',
    billingCycle: 'monthly' as ServiceBillingCycle,
    notes: '',
  });
  const [assignmentForm, setAssignmentForm] = useState({
    companyId: '',
    serviceId: '',
    quantity: '1',
    billedAmount: '',
    overrideCost: '',
    notes: '',
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<ApiResponse<Service[]>>('/services'),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
  });

  const companies = companiesData?.data?.items ?? [];
  const services = servicesData?.data ?? [];
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['client-services', selectedCompanyId],
    queryFn: () => api.get<ApiResponse<ClientServiceAssignment[]>>(`/services/clients/${selectedCompanyId}`),
    enabled: Boolean(selectedCompanyId),
  });

  const { data: profitabilityData, isLoading: profitabilityLoading } = useQuery({
    queryKey: ['services-profitability', period],
    queryFn: () => api.get<ApiResponse<ProfitabilityResponse>>('/services/profitability', { period }),
  });

  const assignments = assignmentsData?.data ?? [];
  const profitability = profitabilityData?.data;

  const selectedCompanyMonthlyCharge = useMemo(
    () => assignments.reduce((sum, item) => sum + item.assignment.billedAmountCents, 0),
    [assignments],
  );

  const createServiceMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Service>>('/services', {
        name: serviceForm.name.trim(),
        provider: serviceForm.provider.trim(),
        category: serviceForm.category,
        billingType: serviceForm.billingType,
        unitCostCents: dollarsToCents(serviceForm.unitCost),
        defaultMarkupPct: 0,
        currency: 'USD',
        billingCycle: serviceForm.billingCycle,
        notes: serviceForm.notes.trim() || undefined,
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-profitability'] });
      setServiceForm({ name: '', provider: '', category: 'other', billingType: 'fixed', unitCost: '', billingCycle: 'monthly', notes: '' });
      toast({ title: 'Service saved', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Failed to save service',
        description: getErrorMessage(error, 'Review the service details and try again.'),
        variant: 'destructive',
      }),
  });

  const assignServiceMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<unknown>>(`/services/clients/${assignmentForm.companyId}`, {
        serviceId: assignmentForm.serviceId,
        quantity: Number.parseInt(assignmentForm.quantity, 10) || 1,
        overrideCostCents: assignmentForm.overrideCost ? dollarsToCents(assignmentForm.overrideCost) : undefined,
        billedAmountCents: dollarsToCents(assignmentForm.billedAmount),
        notes: assignmentForm.notes.trim() || undefined,
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-services'] });
      queryClient.invalidateQueries({ queryKey: ['services-profitability'] });
      setSelectedCompanyId(assignmentForm.companyId);
      setAssignmentForm({ companyId: assignmentForm.companyId, serviceId: '', quantity: '1', billedAmount: '', overrideCost: '', notes: '' });
      toast({ title: 'Client service added', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Failed to assign service',
        description: getErrorMessage(error, 'Review the client service details and try again.'),
        variant: 'destructive',
      }),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/services/clients/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-services'] });
      queryClient.invalidateQueries({ queryKey: ['services-profitability'] });
      toast({ title: 'Client service removed', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Failed to remove service',
        description: getErrorMessage(error, 'The assignment could not be removed.'),
        variant: 'destructive',
      }),
  });

  function handleCreateService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createServiceMutation.isPending) createServiceMutation.mutate();
  }

  function handleAssignService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignServiceMutation.isPending) assignServiceMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Track what you pay for, what each client uses, and what you charge monthly.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            queryClient.invalidateQueries({ queryKey: ['services-profitability'] });
            if (selectedCompanyId) queryClient.invalidateQueries({ queryKey: ['client-services', selectedCompanyId] });
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Service catalog</h2>
              <p className="text-sm text-muted-foreground">Software, hosting, subscriptions, and tools you pay for.</p>
            </div>
          </div>

          <form onSubmit={handleCreateService} className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Service name *</label>
              <input required className={inputClass} value={serviceForm.name} onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))} placeholder="Google Workspace" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider *</label>
              <input required className={inputClass} value={serviceForm.provider} onChange={(e) => setServiceForm((f) => ({ ...f, provider: e.target.value }))} placeholder="Google" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select aria-label="Service category" className={inputClass} value={serviceForm.category} onChange={(e) => setServiceForm((f) => ({ ...f, category: e.target.value as ServiceCategory }))}>
                {categories.map((category) => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <select aria-label="Billing type" className={inputClass} value={serviceForm.billingType} onChange={(e) => setServiceForm((f) => ({ ...f, billingType: e.target.value as ServiceBillingType }))}>
                  <option value="fixed">Fixed</option>
                  <option value="per_seat">Per seat</option>
                  <option value="usage">Usage</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cycle</label>
                <select aria-label="Billing cycle" className={inputClass} value={serviceForm.billingCycle} onChange={(e) => setServiceForm((f) => ({ ...f, billingCycle: e.target.value as ServiceBillingCycle }))}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One time</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Your cost ($)</label>
              <input className={inputClass} inputMode="decimal" value={serviceForm.unitCost} onChange={(e) => setServiceForm((f) => ({ ...f, unitCost: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea className={textareaClass} value={serviceForm.notes} onChange={(e) => setServiceForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about pricing, account owner, renewal, etc." />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={createServiceMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                <Plus className="h-4 w-4" />
                {createServiceMutation.isPending ? 'Saving…' : 'Add Service'}
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {servicesLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index}><td colSpan={3} className="px-4 py-3"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></td></tr>
                  ))
                ) : services.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No services yet. Add tools like hosting, email, storage, or monthly retainers.</td></tr>
                ) : (
                  services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.provider} · {service.billingCycle.replace('_', ' ')}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell capitalize">{service.category.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{formatCurrency(service.unitCostCents / 100, service.currency)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold text-foreground">Client monthly charge</h2>
            <p className="mt-1 text-sm text-muted-foreground">Record what you charge a client monthly, separately from your internal service cost.</p>

            <form onSubmit={handleAssignService} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Client/company *</label>
                <select required aria-label="Client company" className={inputClass} value={assignmentForm.companyId} onChange={(e) => setAssignmentForm((f) => ({ ...f, companyId: e.target.value }))}>
                  <option value="">— Select company —</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Service or retainer *</label>
                <select required aria-label="Service" className={inputClass} value={assignmentForm.serviceId} onChange={(e) => setAssignmentForm((f) => ({ ...f, serviceId: e.target.value }))}>
                  <option value="">— Select service —</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Qty</label>
                  <input className={inputClass} inputMode="numeric" value={assignmentForm.quantity} onChange={(e) => setAssignmentForm((f) => ({ ...f, quantity: e.target.value.replace(/\D/g, '') }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Charge/mo ($)</label>
                  <input className={inputClass} inputMode="decimal" value={assignmentForm.billedAmount} onChange={(e) => setAssignmentForm((f) => ({ ...f, billedAmount: e.target.value }))} placeholder="500.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cost override</label>
                  <input className={inputClass} inputMode="decimal" value={assignmentForm.overrideCost} onChange={(e) => setAssignmentForm((f) => ({ ...f, overrideCost: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <textarea className={textareaClass} value={assignmentForm.notes} onChange={(e) => setAssignmentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional internal notes for this client/service" />
              <button type="submit" disabled={assignServiceMutation.isPending || services.length === 0 || companies.length === 0} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                <Plus className="h-4 w-4" />
                {assignServiceMutation.isPending ? 'Saving…' : 'Add to Client'}
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Client services</h2>
                <p className="text-sm text-muted-foreground">Select a company to review current monthly charges.</p>
              </div>
              <select aria-label="View company services" className={`${inputClass} max-w-[220px]`} value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
                <option value="">— Company —</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </div>

            {selectedCompany ? (
              <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">{selectedCompany.name}</p>
                <p className="text-xs text-muted-foreground">Recorded monthly charge: {formatCurrency(selectedCompanyMonthlyCharge / 100, 'USD')}</p>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {!selectedCompanyId ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Choose a company to see assigned services.</p>
              ) : assignmentsLoading ? (
                <div className="h-16 animate-pulse rounded-md bg-muted" />
              ) : assignments.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No services assigned to this client yet.</p>
              ) : (
                assignments.map((item) => {
                  const costCents = item.assignment.overrideCostCents ?? item.service.unitCostCents;
                  return (
                    <div key={item.assignment.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                      <div>
                        <p className="font-medium text-foreground">{item.service.name}</p>
                        <p className="text-xs text-muted-foreground">Cost {formatCurrency((costCents * item.assignment.quantity) / 100, item.service.currency)} · Charge {formatCurrency(item.assignment.billedAmountCents / 100, item.service.currency)}</p>
                        {item.assignment.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.assignment.notes}</p> : null}
                      </div>
                      <button type="button" onClick={() => deleteAssignmentMutation.mutate(item.assignment.id)} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Remove client service">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Profitability</h2>
            <p className="text-sm text-muted-foreground">Compare monthly client charges against services and subscriptions you pay for.</p>
          </div>
          <input type="month" title="Profitability period" className={`${inputClass} max-w-[180px]`} value={period} onChange={(e) => setPeriod(e.target.value || currentPeriod())} />
        </div>

        {profitability ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-semibold text-foreground">{formatCurrency(profitability.totals.billedCents / 100, 'USD')}</p></div>
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Cost</p><p className="text-lg font-semibold text-foreground">{formatCurrency(profitability.totals.costCents / 100, 'USD')}</p></div>
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Margin</p><p className="text-lg font-semibold text-foreground">{formatCurrency(profitability.totals.marginCents / 100, 'USD')}</p></div>
            <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">Margin %</p><p className="text-lg font-semibold text-foreground">{profitability.totals.marginPct}%</p></div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {profitabilityLoading ? (
                Array.from({ length: 3 }).map((_, index) => <tr key={index}><td colSpan={4} className="px-4 py-3"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /></td></tr>)
              ) : !profitability || profitability.summary.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No profitability data yet. Assign services to clients to start tracking.</td></tr>
              ) : (
                profitability.summary.map((row) => (
                  <tr key={row.companyId}>
                    <td className="px-4 py-3 font-medium text-foreground">{row.companyName}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{formatCurrency(row.billedCents / 100, 'USD')}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(row.costCents / 100, 'USD')}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{formatCurrency(row.marginCents / 100, 'USD')} · {row.marginPct}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
