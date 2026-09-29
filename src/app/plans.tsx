import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Notice, Screen } from '@/components/ui';
import { PlanPicker } from '@/features/billing/components/PlanPicker';
import { SubscribeFooter } from '@/features/billing/components/SubscribeFooter';
import { getBilling } from '@/features/billing/provider';
import { currentPlan, type Period } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { FamilyStrip } from '@/features/family/components/FamilyStrip';
import { clock } from '@/lib/clock';
import { familyAvailable, kidsUnder13Enabled } from '@/lib/features';
import { fonts, spacing, useColors } from '@/theme';
import { FamilyAdultRequired } from '@/features/billing/components/FamilyAdultRequired';
import { FamilyPlanOn } from '@/features/billing/components/FamilyPlanOn';
import { useFamilyPlanAllowed, usePlanChoice } from '@/features/billing/useFamilyPlan';
import { OwnerOnly } from '@/features/family/OwnerOnly';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';

/** Mockup 19 — plans and family (SPEC §9 /plans). */
function PlansScreenInner() {
  const colors = useColors();
  const { t } = useTranslation();
  const entitlement = useBillingStore((s) => s.entitlement);
  const current = currentPlan(entitlement, clock.now());
  // Premium first for new buyers; subscribers start on their plan (QA round 1).
  const { plan: wanted } = useLocalSearchParams<{ plan?: string }>();
  // Web: no family profiles yet, so no Family plan to pick (security round 1, S1-03).
  const onWeb = !familyAvailable();
  const familyOk = useFamilyPlanAllowed() && !onWeb;
  const [plan, setPlan] = usePlanChoice(current, wanted, familyOk);
  const [period, setPeriod] = useState<Period>('monthly');
  // A solo teen doesn't manage a family: no family lead or member strip (QA R8 P2).
  const minor = ['teen', 'child'].includes(modeOf(useOnboardingStore()));
  // On the Family plan with a minor's profile active: only "Manage" (QA R9-04).
  const familyLocked = current === 'family' && !familyOk;

  return (
    <Screen
      header={
        <Header
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          // Web has no family: adult copy, not "Train the whole family" (round 2, P3).
          title={t(minor || onWeb ? 'billing.plansTitleSolo' : 'billing.plansTitle')}
        />
      }
      footer={familyLocked ? undefined : <SubscribeFooter plan={plan} period={period} />}
    >
      {onWeb ? (
        <Notice tone="neutral">{t('family.mobileOnly')}</Notice>
      ) : minor ? null : (
        <>
          <FamilyStrip />
          <AppText color={colors.mutedStrong}>
            {t(kidsUnder13Enabled() ? 'billing.familyIntro' : 'billing.familyIntroTeens')}
          </AppText>
        </>
      )}
      {familyLocked ? (
        <FamilyPlanOn />
      ) : (
        <>
          <AppText variant="caption" style={styles.caps}>
            {t('billing.choose')}
          </AppText>
          <PlanPicker plan={plan} period={period} onPlan={setPlan} onPeriod={setPeriod} />
        </>
      )}
      {__DEV__ && getBilling().kind === 'dev' ? <DevControls /> : null}
    </Screen>
  );
}

/** Development builds without RevenueCat: move the simulated plan along. */
function DevControls() {
  const colors = useColors();
  const { t } = useTranslation();
  // Inside `if (__DEV__)` so release bundles drop the simulator entirely.
  if (__DEV__) {
    type Dev = typeof import('@/features/billing/devProvider');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dev = require('@/features/billing/devProvider') as Dev;
    return (
      <View style={styles.dev}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('billing.dev.note')}
        </AppText>
        <Button
          variant="secondary"
          label={t('billing.dev.charge')}
          onPress={dev.simulateFirstCharge}
        />
        <Button variant="ghost" label={t('billing.dev.expire')} onPress={dev.simulateExpiry} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.heading },
  dev: { gap: spacing.sm },
});

/** Owner-only: a child profile needs the parent gate (QA B-03). */
export default function PlansScreen() {
  // A minor on the Family link hears it right away, before any parent PIN
  // (Daniel, Phase 21; QA R9 P2).
  const { plan: wanted } = useLocalSearchParams<{ plan?: string }>();
  const familyOk = useFamilyPlanAllowed();
  if (wanted === 'family' && !familyOk) return <FamilyAdultRequired />;
  return (
    <OwnerOnly>
      <PlansScreenInner />
    </OwnerOnly>
  );
}
