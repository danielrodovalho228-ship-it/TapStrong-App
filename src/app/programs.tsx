import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Header, Screen } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { PlansBrowser } from '@/features/program/components/PlansBrowser';

/** Ready-made plans (improvements v1, A5). Also the Library tab's "Plans" segment. */
export default function ProgramsScreen() {
  const { t } = useTranslation();
  const mode = derive(useOnboardingStore())?.mode ?? 'adult';
  return (
    <Screen header={<Header onBack={() => router.back()} title={t('plans.title')} />}>
      <PlansBrowser mode={mode} />
    </Screen>
  );
}
