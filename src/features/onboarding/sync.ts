import { useEffect } from 'react';

import i18n from '@/i18n';
import { useAppModeStore } from '@/stores/app-mode';

import { derive } from './derived';
import { useOnboardingStore } from './store';

/** Applies the saved language and age mode (senior text size) app-wide. */
export function useSyncProfileSettings() {
  const locale = useOnboardingStore((s) => s.locale);
  const birthMonth = useOnboardingStore((s) => s.birthMonth);
  const birthYear = useOnboardingStore((s) => s.birthYear);
  const setMode = useAppModeStore((s) => s.setMode);

  useEffect(() => {
    if (locale && i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  useEffect(() => {
    const derived = derive({ birthMonth, birthYear });
    setMode(derived?.mode ?? 'adult');
  }, [birthMonth, birthYear, setMode]);
}
