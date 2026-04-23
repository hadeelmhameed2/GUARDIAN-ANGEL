import { useFocusEffect } from '@react-navigation/native';
import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { useCallback, useRef } from 'react';

const SHAKE_THRESHOLD = 1.9;
const SHAKE_COOLDOWN_MS = 1200;
const SAMPLE_INTERVAL_MS = 140;

type Options = {
  onShake: () => void;
  threshold?: number;
  cooldownMs?: number;
};

export function useShakeHide({ onShake, threshold = SHAKE_THRESHOLD, cooldownMs = SHAKE_COOLDOWN_MS }: Options) {
  const lastShakeAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      // Web often lacks a usable accelerometer API; keep this hook as a safe no-op there.
      if (Platform.OS === 'web') {
        return undefined;
      }

      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
      try {
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (magnitude > threshold && now - lastShakeAtRef.current > cooldownMs) {
            lastShakeAtRef.current = now;
            onShake();
          }
        });
      } catch {
        // If sensor access is unavailable, avoid crashing and just disable shake-hide.
        return undefined;
      }

      return () => {
        subscription?.remove();
      };
    }, [cooldownMs, onShake, threshold]),
  );
}
