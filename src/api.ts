import { Platform } from 'react-native';

const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const BASE_URL = RAW_BASE.replace(/\/$/, '');

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
  if (!BASE_URL.length) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  }
  return BASE_URL;
}

export function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`;
  return fetch(url, init);
}
