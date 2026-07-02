import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Users, MapPin, Server, Plus, Trash2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/lib/form-utils';
import { formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import type { ApiResponse, Company } from '@sparqplug/types';

type Tab = 'overview' | 'services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  provider: string;
  billingType: 'fixed' | 'per_seat' | 'usage';
  unitCostCents: number;
  defaultMarkupPct: number;
  billingCycle: string;
  category: string;
}

interface ClientServiceRow {
  assignment: {
    id: string;
    quantity: number;
    overrideCostCents: number | null;
    billedAmountCents: number;
    isActive: boolean;
    notes: string | null;
  };
  service: Service;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function CompanyServicesTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [billedAmount, setBilledAmount] = useState('');
  const [showExpenseLog, setShowExpenseLog] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ serviceId: '', period: new Date().toISOString().slice(0, 7), actualCostCents: '', invoiceRef: '', pct: '100', billedAmountCents: '' });

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: () => api.get<{ success: boolean; data: ClientServiceRow[] }>(`/services/clients/${companyId}`),
    enabled: !!companyId,
  });

  const { data: catalogData } = useQuery({
    queryKey: ['services-catalog'],
    queryFn: () => api.get<{ success: boolean; data: Service[] }>('/services'),
  });

  const assignments = assignmentsData?.data ?? [];
  const catalog = catalogData?.data ?? [];
  const usageCatalog = catalog.filter((s) => s.billingType === 'usage');
  const fixedCatalog = catalog.filter((s) => s.billingType !== 'usage');

  const addMutation = useMutation({
    mutationFn: () => api.post(`/services/clients/${companyId}`, {
      serviceId: selectedServiceId,
      quantity: Number.parseInt(quantity || '1', 10) || 1,
      billedAmountCents: Math.round(parseFloat(billedAmount || '0') * 100),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-services', companyId] });
      setShowAdd(false);
      setSelectedServiceId('');
      setQuantity('1');
      setBilledAmount('');
      toast({ title: 'Service assigned', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to assign service', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-services', companyId] });
      toast({ title: 'Service removed' });
    },
  });

  const expenseMutation = useMutation({
    mutationFn: () => api.post('/services/expenses', {
      serviceId: expenseForm.serviceId,
      period: expenseForm.period,
      actualCostCents: Math.round(parseFloat(expenseForm.actualCostCents || '0') * 100),
      invoiceRef: expenseForm.invoiceRef || null,
      allocations: [{
        companyId,
        pct: parseFloat(expenseForm.pct || '100'),
        billedAmountCents: Math.round(parseFloat(expenseForm.billedAmountCents || '0') * 100),
      }],
    }),
    onSuccess: () => {
      setShowExpenseLog(false);
      setExpenseForm({ serviceId: '', period: new Date().toISOString().slice(0, 7), actualCostCents: '', invoiceRef: '', pct: '100', billedAmountCents: '' });
      toast({ title: 'Expense logged', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to log expense', variant: 'destructive' }),
  });

  // Cost summary
  const totalCost = assignments.reduce((sum, row) => {
    const cost = row.assignment.overrideCostCents ?? row.service.unitCostCents;
    return sum + cost * (row.service.billingType === 'per_seat' ? row.assignment.quantity : 1);
  }, 0);
  const totalBilled = assignments.reduce((sum, row) => sum + row.assignment.billedAmountCents, 0);
  const margin = totalBilled - totalCost;
  const marginPct = totalBilled > 0 ? Math.round(margin / totalBilled * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {assignments.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Monthly Cost', value: formatCents(totalCost), color: 'text-red-500' },
            { label: 'Monthly Billed', value: formatCents(totalBilled), color: 'text-foreground' },
            { label: 'Margin', value: `${formatCents(margin)} (${marginPct}%)`, color: margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-base font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Assigned Services</p>
        <div className="flex items-center gap-2">
          {usageCatalog.length > 0 && (
            <button
              onClick={() => setShowExpenseLog(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Log Expense
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Assign Service
          </button>
        </div>
      </div>

      {/* Assign service form */}
      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Assign Fixed/Per-Seat Service</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Service</label>
              <select
                aria-label="Assign service"
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select…</option>
                {fixedCatalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.provider} ({formatCents(s.unitCostCents)}/{s.billingType === 'per_seat' ? 'seat' : 'mo'})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Quantity</label>
              <input type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(sanitizeIntegerInput(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Amount billed to client ($/mo)</label>
              <input type="text" inputMode="decimal" placeholder="0.00" value={billedAmount} onChange={(e) => setBilledAmount(sanitizeDecimalInput(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!selectedServiceId || addMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {/* Log usage expense form */}
      {showExpenseLog && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Log Usage-Based Expense</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Service</label>
              <select
                aria-label="Usage expense service"
                value={expenseForm.serviceId}
                onChange={(e) => setExpenseForm((f) => ({ ...f, serviceId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select…</option>
                {usageCatalog.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.provider}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Billing Period (YYYY-MM)</label>
              <input type="text" inputMode="numeric" title="Billing period" placeholder="YYYY-MM" value={expenseForm.period} onChange={(e) => setExpenseForm((f) => ({ ...f, period: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Actual Bill ($)</label>
              <input type="text" inputMode="decimal" placeholder="0.00" value={expenseForm.actualCostCents} onChange={(e) => setExpenseForm((f) => ({ ...f, actualCostCents: sanitizeDecimalInput(e.target.value) }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">% Allocated to this client</label>
              <input type="text" inputMode="numeric" value={expenseForm.pct} onChange={(e) => setExpenseForm((f) => ({ ...f, pct: sanitizeIntegerInput(e.target.value) }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Amount billed to client ($)</label>
              <input type="text" inputMode="decimal" placeholder="0.00" value={expenseForm.billedAmountCents} onChange={(e) => setExpenseForm((f) => ({ ...f, billedAmountCents: sanitizeDecimalInput(e.target.value) }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Invoice Ref (optional)</label>
              <input type="text" title="Invoice reference" placeholder="INV-1001" value={expenseForm.invoiceRef} onChange={(e) => setExpenseForm((f) => ({ ...f, invoiceRef: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowExpenseLog(false)} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={() => expenseMutation.mutate()}
              disabled={!expenseForm.serviceId || !expenseForm.actualCostCents || expenseMutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {expenseMutation.isPending ? 'Logging…' : 'Log Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Assigned list */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded w-1/3" /></div>)
        ) : assignments.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Server className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">No services assigned to this client yet</p>
          </div>
        ) : (
          assignments.map((row) => {
            const costPerUnit = row.assignment.overrideCostCents ?? row.service.unitCostCents;
            const totalCostRow = costPerUnit * (row.service.billingType === 'per_seat' ? row.assignment.quantity : 1);
            const marginRow = row.assignment.billedAmountCents - totalCostRow;
            const marginPctRow = row.assignment.billedAmountCents > 0 ? Math.round(marginRow / row.assignment.billedAmountCents * 100) : 0;
            return (
              <div key={row.assignment.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{row.service.name}</p>
                    <span className="text-xs text-muted-foreground">{row.service.provider}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {row.service.billingType === 'per_seat' && <span>{row.assignment.quantity} seats</span>}
                    <span>Cost: {formatCents(totalCostRow)}/mo</span>
                    {row.assignment.billedAmountCents > 0 && (
                      <>
                        <span>·</span>
                        <span>Billed: {formatCents(row.assignment.billedAmountCents)}/mo</span>
                        <span>·</span>
                        <span className={marginRow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                          {marginPctRow}% margin
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  title={`Remove ${row.service.name}`}
                  onClick={() => removeMutation.mutate(row.assignment.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Company Detail Page ──────────────────────────────────────────────────────

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get<ApiResponse<Company>>(`/companies/${id}`),
    enabled: !!id,
  });

  const company = data?.data;

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!company) {
    return <div className="p-6 text-center text-muted-foreground">Company not found.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Users className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
          {company.industry && <p className="text-muted-foreground">{company.industry}</p>}
          <p className="text-xs text-muted-foreground mt-1">Added {formatRelative(company.createdAt)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['overview', 'services'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'services' ? (
              <span className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" />Services</span>
            ) : t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {company.website && (
              <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{company.website}</a>
                </div>
              </div>
            )}
            {company.employeeCount && (
              <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-sm text-foreground">{company.employeeCount.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {company.description && (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{company.description}</p>
            </div>
          )}
        </>
      )}

      {tab === 'services' && id && <CompanyServicesTab companyId={id} />}
    </div>
  );
}
