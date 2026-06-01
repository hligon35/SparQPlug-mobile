import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Users, Building2, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatCompactNumber, formatRelative, cn } from '@/lib/utils';
import type { ApiResponse, RevenueMetrics, PaginatedResponse, Contact, Opportunity } from '@sparqplug/types';

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
}

function MetricCard({ label, value, change, icon: Icon }: MetricCardProps) {
  const positive = change >= 0;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <div className={cn('flex items-center gap-1 mt-1 text-xs', positive ? 'text-green-500' : 'text-destructive')}>
        {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        <span>{Math.abs(change)}% vs last month</span>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data: revenueData } = useQuery({
    queryKey: ['revenue-metrics'],
    queryFn: () => api.get<ApiResponse<RevenueMetrics>>('/billing/revenue-metrics'),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['contacts', { page: 1, limit: 5 }],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { limit: 5 }),
  });

  const { data: opportunitiesData } = useQuery({
    queryKey: ['opportunities', { page: 1, limit: 5 }],
    queryFn: () => api.get<ApiResponse<PaginatedResponse<Opportunity>>>('/opportunities', { limit: 5 }),
  });

  const metrics = revenueData?.data;

  // Fake sparkline data until real analytics are connected
  const revenueSparkline = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    mrr: Math.round(4000 + Math.random() * 3000 + i * 200),
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your business at a glance</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Monthly Recurring Revenue"
          value={metrics ? formatCurrency(metrics.mrr) : '—'}
          change={8.2}
          icon={DollarSign}
        />
        <MetricCard
          label="Annual Recurring Revenue"
          value={metrics ? formatCurrency(metrics.arr) : '—'}
          change={8.2}
          icon={TrendingUp}
        />
        <MetricCard
          label="Active Contacts"
          value={contactsData?.data ? formatCompactNumber(contactsData.data.total) : '—'}
          change={4.1}
          icon={Users}
        />
        <MetricCard
          label="Open Opportunities"
          value={opportunitiesData?.data ? formatCompactNumber(opportunitiesData.data.total) : '—'}
          change={-2.3}
          icon={Building2}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR chart */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">MRR Trend (12 months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueSparkline}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), 'MRR']}
              />
              <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#mrrGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent opportunities */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Recent Opportunities</p>
          <div className="space-y-3">
            {opportunitiesData?.data?.items.map((opp) => (
              <div key={opp.id} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{opp.name}</p>
                  <p className="text-xs text-muted-foreground">{opp.stage} · {formatCurrency(opp.value ?? 0)}</p>
                </div>
              </div>
            )) ?? (
              <p className="text-sm text-muted-foreground">No opportunities yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent contacts */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Recent Contacts</p>
          <a href="/crm/contacts" className="text-xs text-primary hover:underline">View all</a>
        </div>
        <div className="divide-y divide-border">
          {contactsData?.data?.items.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 px-5 py-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">
                  {contact.firstName[0]}{contact.lastName[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{formatRelative(contact.createdAt)}</span>
            </div>
          )) ?? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No contacts yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
