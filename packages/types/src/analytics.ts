// ─── Cloudflare Analytics Types ───────────────────────────────────────────────

export interface AnalyticsDomain {
  id: string;
  name: string;
  zoneId: string;
  status: 'active' | 'inactive';
  organizationId: string;
}

export type AnalyticsDateRange =
  | '1h'
  | '6h'
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | 'custom';

export interface AnalyticsDateFilter {
  range: AnalyticsDateRange;
  since?: string;
  until?: string;
}

// ─── Traffic Metrics ─────────────────────────────────────────────────────────

export interface TrafficMetrics {
  totalRequests: number;
  uniqueVisitors: number;
  pageViews: number;
  bandwidth: number;
  cacheHitRatio: number;
  threats: number;
  botTraffic: number;
  blockedRequests: number;
  originRequests: number;
  originErrors: number;
  avgResponseTime: number;
}

export interface TrafficDataPoint {
  timestamp: string;
  requests: number;
  visitors: number;
  bandwidth: number;
  threats: number;
  cacheHits: number;
  originRequests: number;
}

// ─── Top Pages / Countries ────────────────────────────────────────────────────

export interface TopPage {
  path: string;
  requests: number;
  visitors: number;
  avgDuration: number;
}

export interface TopCountry {
  countryCode: string;
  countryName: string;
  requests: number;
  visitors: number;
  bandwidth: number;
}

export interface TopBrowser {
  browser: string;
  requests: number;
  percentage: number;
}

export interface TopOS {
  os: string;
  requests: number;
  percentage: number;
}

// ─── Security Events ──────────────────────────────────────────────────────────

export interface SecurityEvent {
  timestamp: string;
  action: 'block' | 'challenge' | 'allow' | 'log';
  ruleId: string;
  ruleName: string;
  source: string;
  count: number;
}

// ─── Analytics Snapshot ───────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  id: string;
  domainId: string;
  zoneId: string;
  metrics: TrafficMetrics;
  trafficTimeseries: TrafficDataPoint[];
  topPages: TopPage[];
  topCountries: TopCountry[];
  securityEvents: SecurityEvent[];
  dateFilter: AnalyticsDateFilter;
  capturedAt: string;
}

// ─── Dashboard Widget ─────────────────────────────────────────────────────────

export interface DashboardWidget {
  id: string;
  type:
    | 'metric_card'
    | 'traffic_chart'
    | 'revenue_chart'
    | 'pipeline_chart'
    | 'recent_activity'
    | 'recent_documents'
    | 'pending_invoices'
    | 'upcoming_tasks'
    | 'top_pages'
    | 'top_countries';
  title: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  userId: string;
  organizationId: string;
  widgets: DashboardWidget[];
}
