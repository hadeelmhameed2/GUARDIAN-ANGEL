import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MoodEntry, MoodId } from './types';

const ENTRIES_KEY = 'ga_mood_entries_v1';

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

export async function appendTodayMood(moodId: MoodId): Promise<MoodEntry[]> {
  const entries = await getMoodEntries();
  const now = Date.now();
  const date = localDateString(new Date());
  const withoutToday = entries.filter((e) => e.date !== date);
  const next: MoodEntry[] = [...withoutToday, { date, moodId, recordedAt: now }].sort(
    (a, b) => a.recordedAt - b.recordedAt,
  );
  await saveMoodEntries(next);
  return next;
}

export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
