import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatRelative, cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { Dialog } from '@/components/ui/dialog';
import type { ApiResponse, PaginatedResponse, Opportunity, OpportunityStage, Company, Contact } from '@sparqplug/types';

const STAGES: OpportunityStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const STAGE_COLORS: Record<OpportunityStage, string> = {
  lead: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  qualified: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  proposal: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  negotiation: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  closed_won: 'bg-green-500/15 text-green-600 dark:text-green-400',
  closed_lost: 'bg-muted text-muted-foreground',
};

const STAGE_PROBABILITIES: Record<OpportunityStage, string> = {
  lead: '10', qualified: '30', proposal: '50', negotiation: '75', closed_won: '100', closed_lost: '0',
};

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<OpportunityStage | ''>('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', stage: 'lead' as OpportunityStage, value: '', probability: STAGE_PROBABILITIES['lead'], closeDate: '', companyId: '', contactId: '' });
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', { stage, page }],
    queryFn: () =>
      api.get<ApiResponse<PaginatedResponse<Opportunity>>>('/opportunities', {
        stage: stage || undefined,
        page,
        limit: LIMIT,
      }),
  });

  const opps = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/opportunities', {
      ...data,
      value: data.value ? parseFloat(data.value) : undefined,
      probability: data.probability ? parseInt(data.probability) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Opportunity created', variant: 'success' });
      setShowCreate(false);
      setForm({ name: '', stage: 'lead', value: '', probability: STAGE_PROBABILITIES['lead'], closeDate: '', companyId: '', contactId: '' });
    },
    onError: () => toast({ title: 'Failed to create opportunity', variant: 'destructive' }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Company>>>('/companies', { limit: 200 }),
    enabled: showCreate,
  });
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { limit: 200 }),
    enabled: showCreate,
  });
  const companiesList = companiesData?.data?.items ?? [];
  const contactsList = contactsData?.data?.items ?? [];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          New Opportunity
        </button>
      </div>

      {/* Stage filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setStage(''); setPage(1); }}
          className={cn('h-7 px-3 rounded-full text-xs font-medium border transition-colors', !stage ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}
        >
          All
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => { setStage(s); setPage(1); }}
            className={cn('h-7 px-3 rounded-full text-xs font-medium border transition-colors capitalize', stage === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Opportunity</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Probability</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Close Date</th>
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
            ) : opps.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No opportunities found</td></tr>
            ) : (
              opps.map((opp) => (
                <tr key={opp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{opp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STAGE_COLORS[opp.stage])}>
                      {opp.stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                    {formatCurrency(opp.value ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
                    {opp.probability != null ? `${opp.probability}%` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {opp.closeDate ? formatRelative(opp.closeDate) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2.5 rounded text-xs border border-border hover:bg-muted disabled:opacity-40 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Opportunity">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <input required autoFocus className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Enterprise deal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <select className={inputClass} value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}>
                <option value="">— None —</option>
                {companiesList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <select className={inputClass} value={form.contactId} onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}>
                <option value="">— None —</option>
                {contactsList.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Stage</label>
              <select className={inputClass} value={form.stage} onChange={(e) => {
                const s = e.target.value as OpportunityStage;
                setForm((f) => ({ ...f, stage: s, probability: STAGE_PROBABILITIES[s] }));
              }}>
                {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Value ($)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Probability (%)</label>
              <input type="number" min="0" max="100" className={inputClass} value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Close date</label>
              <input type="date" className={inputClass} value={form.closeDate} onChange={(e) => setForm((f) => ({ ...f, closeDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-md border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
