import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export const AUTH_TOKEN_KEY = 'ga_auth_token';
export const AUTH_CALCULATOR_CODE_KEY = 'ga_calculator_code';
export const AUTH_USERNAME_KEY = 'ga_auth_username';

export type AuthCredentials = {
  token: string | null;
  calculatorCode: string | null;
};

function normalizeStoredValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** True when a non-empty auth token exists (same rules on web and native). */
export function hasAuthToken(token: string | null | undefined): boolean {
  return normalizeStoredValue(token) !== null;
}

export async function readSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window === 'undefined') return null;
    try {
      return normalizeStoredValue(window.localStorage.getItem(key));
    } catch {
      return null;
    }
  }
  try {
    return normalizeStoredValue(await SecureStore.getItemAsync(key));
  } catch {
    return null;
  }
}

export async function writeSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore quota / storage errors
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

/** Loads auth token + calculator PIN from storage with identical normalization on all platforms. */
export async function loadAuthCredentials(): Promise<AuthCredentials> {
  const [token, calculatorCode] = await Promise.all([
    readSecureItem(AUTH_TOKEN_KEY),
    readSecureItem(AUTH_CALCULATOR_CODE_KEY),
  ]);
  return { token, calculatorCode };
}
