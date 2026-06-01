import * as SecureStore from 'expo-secure-store';

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const BASE_URL = runtimeEnv?.['EXPO_PUBLIC_API_BASE_URL'] ?? 'https://api.sparqplug.com/v1';
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
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;

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

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Request failed' } })) as { error?: { message: string } };
    throw new Error(err.error?.message ?? 'Request failed');
  }
  return response.json() as Promise<T>;
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
