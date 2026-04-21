import { useFocusEffect } from '@react-navigation/native';
import { Accelerometer } from 'expo-sensors';
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
      Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
      const subscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (magnitude > threshold && now - lastShakeAtRef.current > cooldownMs) {
          lastShakeAtRef.current = now;
          onShake();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [cooldownMs, onShake, threshold]),
  );
}
