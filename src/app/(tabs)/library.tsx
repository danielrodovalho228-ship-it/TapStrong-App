import { useTranslation } from 'react-i18next';

import { AppText, Screen } from '@/components/ui';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { PlansBrowser } from '@/features/program/components/PlansBrowser';

/**
 * Library tab (Phase 31, F): ready-made plans in rows by days a week, with
 * equipment, muscle and time filters, and the care programs. Exercises are
 * browsed on the body in the Exercises tab.
 */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const mode = modeOf(useOnboardingStore());
  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        {t('library.title')}
      </AppText>
      <PlansBrowser mode={mode} />
    </Screen>
  );
}
