import type { TFunction } from 'i18next';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';

import { getTrustedContacts } from '@/app/risk-status';

import { cancelStoredSchedules, scheduleQuietCheckInReminder } from './notifications';
import {
  daysSinceLastMood,
  getMoodEntries,
  getSafetySettings,
  getSafetyState,
  saveSafetyState,
} from './storage';
import { HOURS_UNTIL_ESCALATION, INACTIVITY_DAYS_THRESHOLD } from './types';

export async function runSafetyCheckinPipeline(t: TFunction): Promise<void> {
  const settings = await getSafetySettings();
  if (!settings.safetyCheckinEnabled) return;

  const entries = await getMoodEntries();
  const days = daysSinceLastMood(entries);
  if (days === null) return;
  if (days < INACTIVITY_DAYS_THRESHOLD) return;

  const state = await getSafetyState();
  const now = Date.now();

  if (!state.warningIssuedAt) {
    const scheduledIds = await scheduleQuietCheckInReminder(
      t('moodCheckin.notificationTitle'),
      t('moodCheckin.notificationBody'),
    );
    await saveSafetyState({
      warningIssuedAt: now,
      scheduledIds,
      escalationIssuedAt: undefined,
    });
    return;
  }

  if (state.escalationIssuedAt) return;

  const msSinceWarning = now - state.warningIssuedAt;
  if (msSinceWarning < HOURS_UNTIL_ESCALATION * 3600000) return;

  const last = entries.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b));
  if (last.recordedAt >= state.warningIssuedAt) return;

  const latestSettings = await getSafetySettings();
  if (!latestSettings.safetyCheckinEnabled) return;

  await escalateSafetyCheckin(t, latestSettings.presetSosMessage);
  await cancelStoredSchedules(state.scheduledIds);
  await saveSafetyState({
    ...state,
    escalationIssuedAt: now,
    scheduledIds: undefined,
  });
}

async function escalateSafetyCheckin(t: TFunction, presetSosMessage: string): Promise<void> {
  const contacts = getTrustedContacts();
  const raw = contacts[0]?.phone?.replace(/\s+/g, '');
  if (!raw) return;

  let body = presetSosMessage.trim() || t('moodCheckin.escalationSmsBody');
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = loc.coords;
      body += `\n\n${t('moodCheckin.lastKnownLocation')}: https://maps.google.com/?q=${lat},${lng}`;
    }
  } catch {
    // location unavailable
  }

  if (Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    await SMS.sendSMSAsync([raw], body);
    return;
  }

  const qs = encodeURIComponent(body);
  await Linking.openURL(`sms:${raw}?body=${qs}`);
}

export async function disableSafetyCheckinSchedules(): Promise<void> {
  const state = await getSafetyState();
  await cancelStoredSchedules(state.scheduledIds);
  await saveSafetyState({});
}
