import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth-store';

const DEFAULT_BASE_URL = 'https://sparqplug-api.hligon.workers.dev/api/v1';
const DEFAULT_TIMEOUT_MS = 15000;
const expoExtra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };
const BASE_URL = (expoExtra.apiBaseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
const TOKEN_KEY = 'sparqplug_firebase_token';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

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
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) searchParams.set(k, String(v));
    }
    const qs = searchParams.toString();
    if (qs) url = `${url}?${qs}`;
  }

  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, { ...init, headers, signal: init.signal ?? controller.signal });
    const payload = await parseJsonSafely<T & ApiErrorPayload>(response);

    if (!response.ok) {
      if (response.status === 401) {
        await clearToken();
        useAuthStore.getState().signOut();
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
      clearTimeout(timeoutId);
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

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiFetch<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
