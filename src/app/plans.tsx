import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen } from '@/components/ui';
import { PlanPicker } from '@/features/billing/components/PlanPicker';
import { SubscribeFooter } from '@/features/billing/components/SubscribeFooter';
import { getBilling } from '@/features/billing/provider';
import { currentPlan, type Period, type Plan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { FamilyStrip } from '@/features/family/components/FamilyStrip';
import { clock } from '@/lib/clock';
import { kidsUnder13Enabled } from '@/lib/features';
import { colors, fonts, spacing } from '@/theme';
import { OwnerOnly } from '@/features/family/OwnerOnly';

/** Mockup 19 — plans and family (SPEC §9 /plans). */
function PlansScreenInner() {
  const { t } = useTranslation();
  const entitlement = useBillingStore((s) => s.entitlement);
  const current = currentPlan(entitlement, clock.now());
  // Premium first for new buyers; subscribers start on their plan (QA round 1).
  const [plan, setPlan] = useState<Plan>(current === 'free' ? 'premium' : current);
  const [period, setPeriod] = useState<Period>('monthly');

  return (
    <Screen
      header={
        <Header
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          title={t('billing.plansTitle')}
        />
      }
      footer={<SubscribeFooter plan={plan} period={period} />}
    >
      <FamilyStrip />
      <AppText color={colors.mutedStrong}>
        {t(kidsUnder13Enabled() ? 'billing.familyIntro' : 'billing.familyIntroTeens')}
      </AppText>
      <AppText variant="caption" style={styles.caps}>
        {t('billing.choose')}
      </AppText>
      <PlanPicker plan={plan} period={period} onPlan={setPlan} onPeriod={setPeriod} />
      {__DEV__ && getBilling().kind === 'dev' ? <DevControls /> : null}
    </Screen>
  );
}

/** Development builds without RevenueCat: move the simulated plan along. */
function DevControls() {
  const { t } = useTranslation();
  // Inside `if (__DEV__)` so release bundles drop the simulator entirely.
  if (__DEV__) {
    type Dev = typeof import('@/features/billing/devProvider');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dev = require('@/features/billing/devProvider') as Dev;
    return (
      <View style={styles.dev}>
        <AppText variant="caption" color={colors.accent}>
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
  return (
    <OwnerOnly>
      <PlansScreenInner />
    </OwnerOnly>
  );
}
