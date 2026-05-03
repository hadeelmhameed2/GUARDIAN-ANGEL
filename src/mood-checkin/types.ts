export type MoodId = 'sage' | 'mist' | 'dawn' | 'dust';

export type MoodEntry = {
  date: string;
  moodId: MoodId;
  recordedAt: number;
};

export type SafetyCheckinSettings = {
  /** User must turn this ON for 4-day automated SOS; default off. */
  safetyCheckinEnabled: boolean;
  /** Custom SMS body; if empty, default i18n string is used at send time. */
  presetSosMessage: string;
};

export type SafetyCheckinState = {
  warningIssuedAt?: number;
  escalationIssuedAt?: number;
  scheduledIds?: string[];
};

export const INACTIVITY_DAYS_THRESHOLD = 4;
export const HOURS_UNTIL_ESCALATION = 6;
