import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Screen } from '@/components/ui';
import { useOnboardingStore } from '@/features/onboarding/store';
import { colors } from '@/theme';

/** Placeholder after onboarding until the body map lands (Phase 2). */
export default function NextScreen() {
  const { t } = useTranslation();
  const reset = useOnboardingStore((s) => s.reset);
  return (
    <Screen
      footer={
        <>
          <Button label={t('next.review')} onPress={() => router.push('/onboarding/profile')} />
          <Button
            variant="ghost"
            label={t('next.restart')}
            onPress={() => {
              reset();
              router.replace('/welcome');
            }}
          />
        </>
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        {t('next.title')}
      </AppText>
      <AppText color={colors.mutedStrong}>{t('next.body')}</AppText>
    </Screen>
  );
}
