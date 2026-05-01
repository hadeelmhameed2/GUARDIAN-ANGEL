import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type WriteResult = { ok: boolean; quota?: boolean };

export async function readJournalRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeJournalRaw(key: string, value: string): Promise<WriteResult> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return { ok: false };
    try {
      window.localStorage.setItem(key, value);
      return { ok: true };
    } catch (error: any) {
      const isQuota =
        error?.name === 'QuotaExceededError' ||
        error?.code === 22 ||
        error?.code === 1014 ||
        error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
      return { ok: false, quota: isQuota };
    }
  }
  try {
    await AsyncStorage.setItem(key, value);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
