import type { MoodId } from './types';

/**
 * Calm → distressed: light sky blue through mid tones to deep purple.
 * Storage IDs: sage | mist | dawn | dust.
 */
export const MOOD_PALETTE: { id: MoodId; color: string; border: string }[] = [
  { id: 'sage', color: '#B8DDF0', border: '#3D7DAD' },
  { id: 'mist', color: '#E6E0F2', border: '#8E7DA3' },
  { id: 'dawn', color: '#A898C4', border: '#6B4F7A' },
  { id: 'dust', color: '#4A3B5C', border: '#2A1F36' },
];
