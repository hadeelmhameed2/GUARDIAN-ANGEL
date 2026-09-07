import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { lockSecureSession } from '@/src/risk-status';

/**
 * The only supported way out of a protected screen during a panic event.
 *
 * Locking before navigating is the entire point: the route guard in
 * `app/(protected)/_layout.tsx` reads the same in-memory flag, so an exit that
 * skips the lock leaves the session open and lets a later navigation back in
 * without re-entering the PIN. Every shake-to-hide handler and quick-exit
 * button routes through here instead of calling `router.replace` directly —
 * a bare replace is silently insecure and that is how this was missed before.
 */
export function usePanicExit(): () => void {
  const router = useRouter();
  return useCallback(() => {
    lockSecureSession();
    router.replace('/(tabs)');
  }, [router]);
}
