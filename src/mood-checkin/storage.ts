import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelStoredSchedules } from './notifications';

import type { MoodEntry, MoodId, SafetyCheckinSettings, SafetyCheckinState } from './types';

const ENTRIES_KEY = 'ga_mood_entries_v1';
const SETTINGS_KEY = 'ga_safety_checkin_settings_v1';
const STATE_KEY = 'ga_safety_checkin_state_v1';

const DEFAULT_SETTINGS: SafetyCheckinSettings = {
  safetyCheckinEnabled: false,
  presetSosMessage: '',
};

export async function getMoodEntries(): Promise<MoodEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is MoodEntry =>
        e != null &&
        typeof (e as MoodEntry).date === 'string' &&
        typeof (e as MoodEntry).moodId === 'string' &&
        typeof (e as MoodEntry).recordedAt === 'number',
    );
  } catch {
    return [];
  }
}

export async function saveMoodEntries(entries: MoodEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries.slice(-120)));
}

export async function getSafetySettings(): Promise<SafetyCheckinSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SafetyCheckinSettings>;
    return {
      safetyCheckinEnabled: Boolean(parsed?.safetyCheckinEnabled),
      presetSosMessage: typeof parsed?.presetSosMessage === 'string' ? parsed.presetSosMessage : '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSafetySettings(next: SafetyCheckinSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export async function getSafetyState(): Promise<SafetyCheckinState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SafetyCheckinState;
    return {
      warningIssuedAt: typeof parsed?.warningIssuedAt === 'number' ? parsed.warningIssuedAt : undefined,
      escalationIssuedAt:
        typeof parsed?.escalationIssuedAt === 'number' ? parsed.escalationIssuedAt : undefined,
      scheduledIds: Array.isArray(parsed?.scheduledIds)
        ? parsed.scheduledIds.filter((id): id is string => typeof id === 'string')
        : undefined,
    };
  } catch {
    return {};
  }
}

export async function saveSafetyState(next: SafetyCheckinState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
}

export async function appendTodayMood(moodId: MoodId): Promise<MoodEntry[]> {
  const prevState = await getSafetyState();
  await cancelStoredSchedules(prevState.scheduledIds);
  const entries = await getMoodEntries();
  const now = Date.now();
  const date = localDateString(new Date());
  const withoutToday = entries.filter((e) => e.date !== date);
  const next: MoodEntry[] = [...withoutToday, { date, moodId, recordedAt: now }].sort(
    (a, b) => a.recordedAt - b.recordedAt,
  );
  await saveMoodEntries(next);
  await saveSafetyState({});
  return next;
}

export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calendarDaysBetweenUtcMidnight(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

export function daysSinceLastMood(entries: MoodEntry[], today = new Date()): number | null {
  if (!entries.length) return null;
  const last = entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0].date);
  const [y, m, d] = last.split('-').map(Number);
  const lastDate = new Date(y, m - 1, d);
  return calendarDaysBetweenUtcMidnight(lastDate, today);
}
