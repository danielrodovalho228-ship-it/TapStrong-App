import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Icon, Screen, TextLink } from '@/components/ui';
import { FamilyAdultRequired } from '@/features/billing/components/FamilyAdultRequired';
import { PlanPicker } from '@/features/billing/components/PlanPicker';
import { SubscribeFooter } from '@/features/billing/components/SubscribeFooter';
import {
  currentPlan,
  FREE_WORKOUTS_PER_WEEK,
  startPlan,
  type Period,
  type Plan,
} from '@/features/billing/rules';
import { OwnerOnly } from '@/features/family/OwnerOnly';
import { useBillingStore } from '@/features/billing/store';
import { useFamilyPlanAllowed } from '@/features/billing/useFamilyPlan';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { fonts, spacing, useColors } from '@/theme';

const VALUE = ['unlimited', 'repair', 'family', 'progress'] as const;

/** Free limit reached (SPEC §8): value first, price second, cancel info visible. */
function PaywallScreenInner() {
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const { next, plan: wanted } = useLocalSearchParams<{ next?: string; plan?: string }>();
  const familyOk = useFamilyPlanAllowed();
  const current = currentPlan(
    useBillingStore((st) => st.entitlement),
    clock.now(),
  );
  const [plan, setPlan] = useState<Plan>(() => startPlan(current, wanted, familyOk));
  const [period, setPeriod] = useState<Period>('monthly');

  useEffect(() => {
    track('paywall_viewed');
  }, []);
  // A minor on the Family link: no purchase (Daniel, Phase 21).
  if (wanted === 'family' && !familyOk) return <FamilyAdultRequired />;

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
      <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
        {/* A subscriber is never told they are on the free plan (QA R2-03). */}
        {current === 'free'
          ? t('paywall.eyebrow', { count: FREE_WORKOUTS_PER_WEEK })
          : t('paywall.eyebrowSubscribed', { plan: t(`billing.plans.${current}.name`) })}
      </AppText>
      <AppText variant="h1" accessibilityRole="header">
        {t('paywall.title')}
      </AppText>
      <View style={styles.list}>
        {VALUE.filter((v) => familyOk || v !== 'family').map((v) => (
          <View key={v} style={styles.row}>
            <Icon name="check" color={colors.teal} />
            <AppText style={styles.flex}>{t(`paywall.value.${v}`)}</AppText>
          </View>
        ))}
      </View>
      {nextDay && current === 'free' ? (
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

/** Owner-only: a child or teen can't change the parent's plan (QA R2-03). */
export default function PaywallScreen() {
  return (
    <OwnerOnly>
      <PaywallScreenInner />
    </OwnerOnly>
  );
}
