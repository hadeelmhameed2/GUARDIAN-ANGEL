import type { TFunction } from 'i18next';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

import { getTrustedContacts } from '@/app/risk-status';
import { authFetch } from '@/src/auth-session';

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

  const escalated = await escalateSafetyCheckin(t, latestSettings.presetSosMessage);
  if (!escalated) return; // leave escalationIssuedAt unset so this retries next time the app opens

  await cancelStoredSchedules(state.scheduledIds);
  await saveSafetyState({
    ...state,
    escalationIssuedAt: now,
    scheduledIds: undefined,
  });
}

/**
 * Dispatches the SOS via the server (functions/api/sos/send.ts) rather than
 * the device's SMS composer — that composer requires a human to press Send,
 * which defeats the point of an *automated* alert for a user who's assumed
 * unable to act. Returns whether the dispatch actually succeeded, and shows
 * a confirmation/failure Alert either way. Exported so the Core Settings
 * "Demo: Trigger SOS Now" button can fire this exact path on demand.
 */
export async function escalateSafetyCheckin(t: TFunction, presetSosMessage: string): Promise<boolean> {
  const contacts = getTrustedContacts();
  const raw = contacts[0]?.phone?.replace(/\s+/g, '');
  if (!raw) return false;

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

  try {
    const response = await authFetch('/api/sos/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: raw, message: body }),
    });
    if (!response.ok) {
      throw new Error(`SOS dispatch failed with status ${response.status}`);
    }
    Alert.alert(t('moodCheckin.sosDispatchedTitle'), t('moodCheckin.sosDispatchedBody'));
    return true;
  } catch {
    Alert.alert(t('moodCheckin.sosDispatchFailedTitle'), t('moodCheckin.sosDispatchFailedBody'));
    return false;
  }
}

export async function disableSafetyCheckinSchedules(): Promise<void> {
  const state = await getSafetyState();
  await cancelStoredSchedules(state.scheduledIds);
  await saveSafetyState({});
}
