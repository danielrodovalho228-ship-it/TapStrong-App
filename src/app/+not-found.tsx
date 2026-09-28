import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice, Screen } from '@/components/ui';

/** Any unknown address (QA R7 P2): themed, translated, back to Home. */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen footer={<Button label={t('notFound.home')} onPress={() => router.replace('/home')} />}>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <AppText variant="h1" accessibilityRole="header">
        {t('notFound.title')}
      </AppText>
      <Notice>{t('notFound.body')}</Notice>
    </Screen>
  );
}
