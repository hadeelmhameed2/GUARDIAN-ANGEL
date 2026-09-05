import { Platform } from 'react-native';

const DEFAULT_NATIVE_BASE = 'https://guardianangelapp-nnw.pages.dev';
const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const BASE_URL = (RAW_BASE || DEFAULT_NATIVE_BASE).replace(/\/$/, '');

function useWebDevProxy(): boolean {
  return Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isApiConfigured(): boolean {
  if (useWebDevProxy()) {
    return true;
  }
  return BASE_URL.length > 0;
}

export function getApiBaseUrl(): string {
  if (useWebDevProxy()) {
    return '';
  }
  return BASE_URL;
}

export function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`;
  return fetch(url, init);
}
