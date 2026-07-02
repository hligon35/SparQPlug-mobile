import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Globe, Plus, TrendingUp, DollarSign, TrendingDown, Search, Trash2 } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatCompactNumber, formatDate } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import type { ApiResponse, PaginatedResponse, AnalyticsDomain, AnalyticsSnapshot, AnalyticsDateRange } from '@sparqplug/types';

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

type CloudflareZone = {
  id: string;
  name: string;
  status: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

const DATE_RANGES: { label: string; value: AnalyticsDateRange }[] = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

// ─── Profitability Section ────────────────────────────────────────────────────

interface ProfitSummaryRow {
  companyId: string;
  companyName: string;
  costCents: number;
  billedCents: number;
  marginCents: number;
  marginPct: number;
}

interface ProfitabilityData {
  period: string;
  summary: ProfitSummaryRow[];
  totals: { costCents: number; billedCents: number; marginCents: number; marginPct: number };
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function ProfitabilitySection() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useQuery({
    queryKey: ['services-profitability', period],
    queryFn: () => api.get<{ success: boolean; data: ProfitabilityData }>(`/services/profitability`, { period }),
  });

  const profitData = data?.data;
  const summary = profitData?.summary ?? [];
  const totals = profitData?.totals;

  const chartData = summary.slice(0, 8).map((row) => ({
    name: row.companyName.length > 14 ? `${row.companyName.slice(0, 12)}…` : row.companyName,
    cost: row.costCents / 100,
    billed: row.billedCents / 100,
    margin: row.marginCents / 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Client Profitability</h2>
          <p className="text-sm text-muted-foreground">Service cost vs. billed revenue per client</p>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Cost', value: formatCents(totals.costCents), icon: TrendingDown, color: 'text-red-500' },
            { label: 'Total Billed', value: formatCents(totals.billedCents), icon: DollarSign, color: 'text-foreground' },
            { label: 'Total Margin', value: formatCents(totals.marginCents), icon: TrendingUp, color: totals.marginCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500' },
            { label: 'Avg Margin %', value: `${totals.marginPct}%`, icon: TrendingUp, color: totals.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Cost vs. Billed by Client</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: 12 }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
              />
              <Bar dataKey="cost" name="Cost" fill="hsl(var(--destructive) / 0.6)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="billed" name="Billed" fill="hsl(var(--primary) / 0.8)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-3.5"><div className="h-4 bg-muted animate-pulse rounded w-1/2" /></div>)}
        </div>
      ) : summary.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-10 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No service data for this period — assign services to clients to see profitability</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Billed</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.map((row) => (
                <tr key={row.companyId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.companyName}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCents(row.costCents)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatCents(row.billedCents)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.marginCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {formatCents(row.marginCents)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${row.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : row.marginPct >= 0 ? 'text-orange-500' : 'text-red-500'}`}>
                    {row.marginPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>('7d');
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [domainName, setDomainName] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');

  const { data: domainsData } = useQuery({
    queryKey: ['analytics-domains'],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<AnalyticsDomain>>>('/analytics/domains'),
  });

  const { data: zonesData, isLoading: zonesLoading } = useQuery({
    queryKey: ['cloudflare-zones', zoneSearch],
    queryFn: () => api.get<ApiResponse<CloudflareZone[]>>('/analytics/domains/zones', { name: zoneSearch || undefined }),
    enabled: showAddDomain,
  });

  const createDomainMutation = useMutation({
    mutationFn: () => api.post<ApiResponse<AnalyticsDomain>>('/analytics/domains', { name: domainName.trim(), zoneId: selectedZoneId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-domains'] });
      setShowAddDomain(false);
      setDomainName('');
      setZoneSearch('');
      setSelectedZoneId('');
      toast({ title: 'Domain added', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Failed to add domain',
        description: getErrorMessage(error, 'Review the domain and zone details and try again.'),
        variant: 'destructive',
      }),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/analytics/domains/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['analytics-domains'] });
      toast({ title: 'Domain removed', variant: 'success' });
      if (selectedDomain && domains.find((domain) => domain.id === id)?.zoneId === selectedDomain) {
        setSelectedDomain(null);
      }
    },
    onError: (error) =>
      toast({
        title: 'Failed to remove domain',
        description: getErrorMessage(error, 'The domain could not be removed.'),
        variant: 'destructive',
      }),
  });

  const domains = domainsData?.data?.items ?? [];
  const zones = zonesData?.data ?? [];

  useEffect(() => {
    if (!selectedDomain && domains[0]) {
      setSelectedDomain(domains[0].zoneId);
    }
  }, [domains, selectedDomain]);

  const { data: snapshotData, isLoading } = useQuery({
    queryKey: ['analytics-snapshot', selectedDomain, dateRange],
    queryFn: () =>
      api.get<ApiResponse<AnalyticsSnapshot>>(`/analytics/domains/${selectedDomain}/snapshot`, { range: dateRange }),
    enabled: !!selectedDomain,
  });

  const snapshot = snapshotData?.data;
  const metrics = snapshot?.metrics;
  const timeseries = snapshot?.timeseries ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Cloudflare traffic insights</p>
        </div>
        <button onClick={() => setShowAddDomain(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {/* Domain + date range selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {domains.map((d) => (
          <div key={d.id} className={`inline-flex items-center gap-1 rounded-md border ${selectedDomain === d.zoneId ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
            <button
              onClick={() => setSelectedDomain(d.zoneId)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm transition-colors ${selectedDomain === d.zoneId ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <Globe className="h-3.5 w-3.5" />
              {d.name}
            </button>
            <button
              type="button"
              onClick={() => deleteDomainMutation.mutate(d.id)}
              className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label={`Remove ${d.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={`h-6 px-2.5 rounded text-xs font-medium transition-colors ${dateRange === r.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Requests', value: formatCompactNumber(metrics.requests) },
            { label: 'Unique Visitors', value: formatCompactNumber(metrics.uniqueVisitors) },
            { label: 'Page Views', value: formatCompactNumber(metrics.pageViews) },
            { label: 'Bandwidth', value: `${(metrics.bandwidth / 1e9).toFixed(2)} GB` },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-1">{m.label}</p>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Traffic chart */}
      {timeseries.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Traffic Over Time</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: string) => formatDate(v)} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompactNumber(v)} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: 12 }} />
              <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trafficGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top pages + countries */}
      {snapshot && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Top Pages</p>
            <div className="space-y-2">
              {snapshot.topPages.slice(0, 8).map((p) => (
                <div key={p.url} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-muted-foreground font-mono text-xs">{p.url}</span>
                  <span className="font-semibold text-foreground shrink-0">{formatCompactNumber(p.requests)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Top Countries</p>
            <div className="space-y-2">
              {snapshot.topCountries.slice(0, 8).map((c) => (
                <div key={c.country} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-muted-foreground">{c.country}</span>
                  <span className="font-semibold text-foreground shrink-0">{formatCompactNumber(c.requests)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedDomain && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No domains configured</p>
          <p className="text-sm mt-1">Add a Cloudflare domain to start tracking analytics</p>
        </div>
      )}

      {/* Client Profitability */}
      <div className="border-t border-border pt-6">
        <ProfitabilitySection />
      </div>

      <Dialog
        open={showAddDomain}
        onOpenChange={(open) => {
          setShowAddDomain(open);
          if (!open) {
            setDomainName('');
            setZoneSearch('');
            setSelectedZoneId('');
          }
        }}
        title="Add Analytics Domain"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createDomainMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Domain</label>
            <input
              required
              className={inputClass}
              value={domainName}
              onChange={(event) => {
                const value = event.target.value;
                setDomainName(value);
                setZoneSearch(value);
              }}
              placeholder="example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cloudflare zone</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inputClass} pl-9`} value={zoneSearch} onChange={(event) => setZoneSearch(event.target.value)} placeholder="Search Cloudflare zones" />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-card p-2">
              {zonesLoading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Loading zones…</p>
              ) : zones.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No Cloudflare zones found.</p>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => {
                    const active = selectedZoneId === zone.id;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => {
                          setSelectedZoneId(zone.id);
                          setDomainName(zone.name);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                      >
                        <span className="truncate">{zone.name}</span>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">{zone.status}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Cloudflare credentials are already configured in the deployed backend environment.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowAddDomain(false)} className="h-9 rounded-md border border-border px-4 text-sm transition-colors hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createDomainMutation.isPending || !domainName.trim()} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              {createDomainMutation.isPending ? 'Adding…' : 'Add Domain'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
