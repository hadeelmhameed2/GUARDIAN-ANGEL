import { apiFetch, isApiConfigured } from '@/src/api';
import {
  AUTH_CALCULATOR_CODE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USERNAME_KEY,
  deleteSecureItem,
  readSecureItem,
  writeSecureItem,
} from '@/src/secure-storage';

const LOG_PREFIX = '[auth-session]';

function normalizeToken(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, '');
}

export async function getStoredAuthToken(): Promise<string | null> {
  return normalizeToken(await readSecureItem(AUTH_TOKEN_KEY));
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem(AUTH_TOKEN_KEY),
    deleteSecureItem(AUTH_CALCULATOR_CODE_KEY),
    deleteSecureItem(AUTH_USERNAME_KEY),
  ]);
}

type LoginResponse = { token?: string; error?: string };

/**
 * Exchanges stored username + PIN for a fresh JWT from the server.
 * Updates local storage when successful.
 */
export async function refreshAuthSession(): Promise<string | null> {
  if (!isApiConfigured()) return null;

  const [username, pin] = await Promise.all([
    readSecureItem(AUTH_USERNAME_KEY),
    readSecureItem(AUTH_CALCULATOR_CODE_KEY),
  ]);

  if (!username?.trim() || !pin?.trim()) {
    console.warn(LOG_PREFIX, 'Cannot refresh — missing username or PIN in storage');
    return null;
  }

  try {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: pin.trim() }),
    });

    const payload = (await response.json()) as LoginResponse;
    if (!response.ok) {
      console.warn(LOG_PREFIX, 'Refresh failed', { status: response.status, error: payload.error });
      if (response.status === 401) {
        await clearAuthSession();
      }
      return null;
    }

    const token = normalizeToken(payload.token ?? null);
    if (!token || token.startsWith('local-dev-')) {
      console.warn(LOG_PREFIX, 'Refresh returned no usable token');
      return null;
    }

    await writeSecureItem(AUTH_TOKEN_KEY, token);
    console.info(LOG_PREFIX, 'Session refreshed');
    return token;
  } catch (error) {
    console.warn(LOG_PREFIX, 'Refresh network error', error);
    return null;
  }
}

/**
 * Returns a usable JWT, refreshing via login when missing or after a 401.
 */
export async function getValidAuthToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
  if (options?.forceRefresh) {
    return refreshAuthSession();
  }

  const existing = await getStoredAuthToken();
  if (existing && !existing.startsWith('local-dev-')) {
    return existing;
  }

  return refreshAuthSession();
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAuthToken();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);

  let response = await apiFetch(path, { ...init, headers });

  if (response.status === 401) {
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      headers.set('authorization', `Bearer ${refreshed}`);
      response = await apiFetch(path, { ...init, headers });
    }
  }

  return response;
}
