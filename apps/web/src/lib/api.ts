import { useAuthStore } from '@/stores/auth-store';

const DEFAULT_BASE_URL = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;

function resolveBaseUrl() {
  const configuredBaseUrl = import.meta.env['VITE_API_BASE_URL'] as string | undefined;
  const normalizedBaseUrl = configuredBaseUrl?.trim();

  if (!normalizedBaseUrl) {
    return DEFAULT_BASE_URL;
  }

  return normalizedBaseUrl.endsWith('/') ? normalizedBaseUrl.slice(0, -1) : normalizedBaseUrl;
}

const BASE_URL = resolveBaseUrl();

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

interface ApiErrorPayload {
  error?:
    | string
    | {
        message?: string;
        code?: string;
      };
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  const loginPath = '/auth/login';

  if (window.location.protocol === 'file:') {
    if (window.location.hash !== `#${loginPath}`) {
      window.location.hash = loginPath;
    }
    return;
  }

  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function getApiErrorDetails(payload: ApiErrorPayload | null) {
  const nestedError = payload?.error;

  if (typeof nestedError === 'string') {
    return { message: nestedError, code: undefined };
  }

  return {
    message: nestedError?.message ?? 'Request failed',
    code: nestedError?.code,
  };
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url = `${url}?${qs}`;
  }

  const token = useAuthStore.getState().firebaseToken;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (!isFormDataBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });

    const payload = await parseJsonSafely<T & ApiErrorPayload>(response);

    if (!response.ok) {
      if (response.status === 401) {
        useAuthStore.getState().signOut();
        redirectToLogin();
      }

      const errorDetails = getApiErrorDetails(payload);
      throw new ApiError(errorDetails.message, response.status, errorDetails.code);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, 'REQUEST_TIMEOUT');
    }

    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    params
      ? apiFetch<T>(path, { method: 'GET', params })
      : apiFetch<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body:
        typeof FormData !== 'undefined' && body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body:
        typeof FormData !== 'undefined' && body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body:
        typeof FormData !== 'undefined' && body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
