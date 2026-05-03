import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Paragraph/body text: fixes punctuation flow for Hebrew & Arabic in RN / web. */
export function useRtlTextStyle() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const isRtl = i18n.dir() === 'rtl';
    const rtlText = isRtl
      ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
      : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const });
    const rtlWriting = isRtl
      ? ({ writingDirection: 'rtl' as const })
      : ({ writingDirection: 'ltr' as const });
    return { isRtl, rtlText, rtlWriting };
  }, [i18n.language]);
}
