import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

/**
 * Settings (QA round 1): one findable place for the account, plan and
 * restrictions, with Delete account at the bottom (App Store rule). Owner-only
 * screens keep their own parent gate.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());

  return (
    <Screen
      header={
        <Header
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          title={t('settings.title')}
        />
      }
    >
      <View style={styles.list}>
        <Button
          variant="secondary"
          label={t('settings.account')}
          onPress={() => router.push('/account')}
        />
        <Button
          variant="secondary"
          label={t('settings.plan')}
          onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
        />
        <Button
          variant="secondary"
          label={t('settings.restrictions')}
          onPress={() => router.push('/restrictions')}
        />
      </View>
      <View style={styles.danger}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('settings.deleteNote')}
        </AppText>
        <Button
          variant="ghost"
          label={t('settings.delete')}
          onPress={() => router.push('/delete-account')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  danger: { gap: spacing.sm, marginTop: spacing.xl },
});
