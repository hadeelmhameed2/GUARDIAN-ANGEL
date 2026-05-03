import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { I18nManager, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';

import ar from '@/src/locales/ar.json';
import en from '@/src/locales/en.json';
import he from '@/src/locales/he.json';

export type AppLanguage = 'en' | 'he' | 'ar';

const LANGUAGE_STORAGE_KEY = 'app-language';
const RTL_LANGUAGES: AppLanguage[] = ['he', 'ar'];
const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'he', 'ar'];
const IS_WEB_SERVER = Platform.OS === 'web' && typeof window === 'undefined';

function isSupportedLanguage(language?: string | null): language is AppLanguage {
  return Boolean(language && SUPPORTED_LANGUAGES.includes(language as AppLanguage));
}

function getDeviceLanguage(): AppLanguage {
  try {
    const locale = getLocales()[0];
    const languageCode = locale?.languageCode?.toLowerCase();
    if (isSupportedLanguage(languageCode)) {
      return languageCode;
    }
    const languageTag = locale?.languageTag?.split('-')[0]?.toLowerCase();
    if (isSupportedLanguage(languageTag)) {
      return languageTag;
    }
  } catch {
    return 'en';
  }
  return 'en';
}

async function syncRTL(language: AppLanguage) {
  const shouldUseRTL = RTL_LANGUAGES.includes(language);
  const manager = I18nManager as {
    isRTL?: boolean;
    allowRTL?: (value: boolean) => void;
    forceRTL?: (value: boolean) => void;
    swapLeftAndRightInRTL?: (value: boolean) => void;
  };

  if (typeof manager.allowRTL === 'function') {
    manager.allowRTL(shouldUseRTL);
  }
  if (typeof manager.swapLeftAndRightInRTL === 'function') {
    manager.swapLeftAndRightInRTL(true);
  }
  if (Platform.OS !== 'web' && typeof manager.forceRTL === 'function' && manager.isRTL !== shouldUseRTL) {
    manager.forceRTL(shouldUseRTL);
  }
}

async function getStoredLanguage(): Promise<AppLanguage | null> {
  if (IS_WEB_SERVER) return null;
  try {
    const value = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

async function persistLanguage(language: AppLanguage) {
  if (IS_WEB_SERVER) return;
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore persistence errors and keep runtime language active.
  }
}

async function getInitialLanguage(): Promise<AppLanguage> {
  const storedLanguage = await getStoredLanguage();
  if (storedLanguage) {
    return storedLanguage;
  }
  return getDeviceLanguage();
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      he: { translation: he },
      ar: { translation: ar },
    },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
    react: {
      useSuspense: false,
    },
  });
}

async function applyPreferredLanguage() {
  const language = await getInitialLanguage();
  await syncRTL(language);
  await i18n.changeLanguage(language);
}

export async function setAppLanguage(language: AppLanguage) {
  await syncRTL(language);
  await i18n.changeLanguage(language);
  await persistLanguage(language);
}

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

void applyPreferredLanguage().catch(() => {
  // Keep app functional even if localization bootstrap fails.
});

export default i18n;
