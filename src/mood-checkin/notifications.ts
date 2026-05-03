import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelStoredSchedules(ids: string[] | undefined): Promise<void> {
  if (Platform.OS === 'web' || !ids?.length) return;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // already cancelled
      }
    }),
  );
}

export async function scheduleQuietCheckInReminder(title: string, body: string): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const ok = await ensureNotificationPermissions();
  if (!ok) return [];

  const immediateId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: undefined,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
    },
  });

  const dailyId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: undefined,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });

  return [immediateId, dailyId];
}
