import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { hasSecureSessionAccess } from '@/src/risk-status';

/**
 * Auth gate for every screen behind the calculator disguise.
 *
 * `hasSecureSessionAccess()` reads an in-memory flag that is only ever set by
 * `unlockSecureDataWithPin` on the calculator screen, so it is false on every
 * cold start. That is deliberate: opening `/home` or `/drafts` straight from a
 * pasted URL, a bookmark, or a restored browser tab lands here with no session
 * and bounces to the calculator.
 *
 * Returning `<Redirect>` instead of `<Stack>` matters — the protected screens
 * never mount, so their contents are never painted even for a frame. An
 * effect-based redirect would render the journal first and then navigate away,
 * which defeats the disguise for anyone watching the screen.
 */
export default function ProtectedLayout() {
  const { t } = useTranslation();

  if (!hasSecureSessionAccess()) {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen name="core-settings" options={{ title: t('panic.settings.title') }} />
    </Stack>
  );
}
