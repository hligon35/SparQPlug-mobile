// ─── API Route Types ──────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  auth: boolean;
  roles?: string[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'contact' | 'company' | 'opportunity' | 'invoice' | 'document' | 'subscription' | 'task';
  title: string;
  subtitle?: string;
  url: string;
  icon?: string;
  meta?: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  grouped: {
    contacts?: SearchResult[];
    companies?: SearchResult[];
    opportunities?: SearchResult[];
    invoices?: SearchResult[];
    documents?: SearchResult[];
    subscriptions?: SearchResult[];
    tasks?: SearchResult[];
  };
  total: number;
  took: number;
}

// ─── Realtime Events ──────────────────────────────────────────────────────────

export type RealtimeEventType =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted'
  | 'user.presence'
  | 'notification'
  | 'lock.acquired'
  | 'lock.released';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  entity: string;
  entityId: string;
  data: T;
  userId: string;
  organizationId: string;
  timestamp: string;
}

// ─── Command Palette ──────────────────────────────────────────────────────────

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  shortcut?: string;
  group: string;
  action: () => void;
}
