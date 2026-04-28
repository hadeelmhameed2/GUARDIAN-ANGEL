import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type PanicSettings = {
  phoneNumber: string;
  emergencyMessage: string;
};

const PANIC_SETTINGS_STORAGE_KEY = 'panic-settings-v1';

const EMPTY_SETTINGS: PanicSettings = {
  phoneNumber: '',
  emergencyMessage: '',
};

function normalizeSettings(settings?: Partial<PanicSettings> | null): PanicSettings {
  return {
    phoneNumber: settings?.phoneNumber?.trim() ?? '',
    emergencyMessage: settings?.emergencyMessage?.trim() ?? '',
  };
}

export async function getPanicSettings(): Promise<PanicSettings> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(PANIC_SETTINGS_STORAGE_KEY);
      if (!raw) return EMPTY_SETTINGS;
      return normalizeSettings(JSON.parse(raw) as Partial<PanicSettings>);
    }

    const raw = await AsyncStorage.getItem(PANIC_SETTINGS_STORAGE_KEY);
    if (!raw) return EMPTY_SETTINGS;
    return normalizeSettings(JSON.parse(raw) as Partial<PanicSettings>);
  } catch {
    return EMPTY_SETTINGS;
  }
}

export async function savePanicSettings(settings: PanicSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const payload = JSON.stringify(normalized);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(PANIC_SETTINGS_STORAGE_KEY, payload);
    return;
  }

  await AsyncStorage.setItem(PANIC_SETTINGS_STORAGE_KEY, payload);
}
