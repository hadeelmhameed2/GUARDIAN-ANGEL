const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const BASE_URL = RAW_BASE.replace(/\/$/, '');

export function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  return fetch(url, init);
}
