export type MoodId = 'sage' | 'mist' | 'dawn' | 'dust';

export type MoodEntry = {
  date: string;
  moodId: MoodId;
  recordedAt: number;
};
