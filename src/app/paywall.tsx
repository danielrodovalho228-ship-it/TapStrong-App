import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Icon, Screen, TextLink } from '@/components/ui';
import { PlanPicker } from '@/features/billing/components/PlanPicker';
import { SubscribeFooter } from '@/features/billing/components/SubscribeFooter';
import { FREE_WORKOUTS_PER_WEEK, type Period, type Plan } from '@/features/billing/rules';
import { track } from '@/lib/analytics';
import { colors, fonts, spacing } from '@/theme';

const VALUE = ['unlimited', 'repair', 'family', 'progress'] as const;

/** Free limit reached (SPEC §8): value first, price second, cancel info visible. */
export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [plan, setPlan] = useState<Plan>('premium');
  const [period, setPeriod] = useState<Period>('monthly');

  useEffect(() => {
    track('paywall_viewed');
  }, []);

  const nextDay = next
    ? new Date(`${next}T12:00:00`).toLocaleDateString(i18n.language, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Screen
      footer={
        <SubscribeFooter
          plan={plan}
          period={period}
          // Back to the workout (or Repair) that asked, now unlocked (QA round 1).
          onBought={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        />
      }
    >
      <AppText variant="caption" color={colors.accent} style={styles.caps}>
        {t('paywall.eyebrow', { count: FREE_WORKOUTS_PER_WEEK })}
      </AppText>
      <AppText variant="h1" accessibilityRole="header">
        {t('paywall.title')}
      </AppText>
      <View style={styles.list}>
        {VALUE.map((v) => (
          <View key={v} style={styles.row}>
            <Icon name="check" color={colors.teal} />
            <AppText style={styles.flex}>{t(`paywall.value.${v}`)}</AppText>
          </View>
        ))}
      </View>
      {nextDay ? (
        <AppText color={colors.mutedStrong}>{t('paywall.nextFree', { day: nextDay })}</AppText>
      ) : null}
      <PlanPicker
        plan={plan}
        period={period}
        onPlan={setPlan}
        onPeriod={setPeriod}
        showFree={false}
      />
      <View style={styles.center}>
        <TextLink label={t('paywall.notNow')} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
});
