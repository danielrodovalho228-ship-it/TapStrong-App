import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Notice, TextLink } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

import { buy, currentOwnerAge } from '../actions';
import {
  currentPlan,
  familyPurchaseBlocked,
  priceLabel,
  PRODUCTS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
  type Period,
  type Plan,
} from '../rules';
import { useBillingStore } from '../store';

/**
 * The subscribe button with honest terms right under it (SPEC §2.5):
 * the price after the trial, the reminder, and cancel steps one tap away.
 */
export function SubscribeFooter({
  plan,
  period,
  onBought,
}: {
  plan: Plan;
  period: Period;
  /** Where to go after a purchase; Billing by default (the paywall resumes the workout). */
  onBought?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const saved = useAccountStore((s) => s.saved);
  const { entitlement, prices, hadTrial } = useBillingStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = currentPlan(entitlement, clock.now());

  if (plan === 'free') {
    return (
      <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
        {t('billing.freeNote')}
      </AppText>
    );
  }

  const subscribedFamily = plan === 'family' && current === 'family';
  if (plan === 'family' && !subscribedFamily && familyPurchaseBlocked(currentOwnerAge())) {
    // Owners under 18 can't buy the Family plan (Phase 13, Daniel).
    return <Notice tone="warning">{t('billing.familyAdultsOnly')}</Notice>;
  }

  const price = priceLabel(prices, plan, period);
  const per = t(period === 'annual' ? 'billing.perYear' : 'billing.perMonth');
  const subscribed = current === plan && entitlement.productId === PRODUCTS[plan][period];
  // A subscriber picking another plan or period switches in the store (QA round 1).
  const switching = !subscribed && current !== 'free';
  const trialEnd = new Date(clock.now().getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const trialEndText = trialEnd.toLocaleDateString(i18n.language, {
    month: 'long',
    day: 'numeric',
  });

  const onPress = async () => {
    if (subscribed) return router.push('/billing');
    if (!saved) return router.push('/account');
    setBusy(true);
    setMessage(null);
    const result = await buy(PRODUCTS[plan][period]);
    setBusy(false);
    if (result === 'ok') (onBought ?? (() => router.replace('/billing')))();
    else if (result !== 'cancelled') setMessage(t(`billing.errors.${result}`));
  };

  return (
    <View style={styles.wrap}>
      {message ? <Notice tone="warning">{message}</Notice> : null}
      <Button
        label={
          subscribed
            ? t('billing.manage')
            : !saved
              ? t('billing.saveFirst')
              : switching
                ? t('billing.switchTo', { plan: t(`billing.plans.${plan}.name`), price, per })
                : hadTrial
                  ? t('billing.subscribe', { price, per })
                  : t('billing.startTrial', { days: TRIAL_DAYS })
        }
        loading={busy}
        onPress={onPress}
      />
      <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
        {hadTrial || switching
          ? t('billing.termsNoTrial', { price, per })
          : t('billing.terms', { price, per, days: TRIAL_DAYS, reminder: TRIAL_REMINDER_DAYS })}
      </AppText>
      {!hadTrial && !switching && !subscribed ? (
        <AppText variant="caption" color={colors.ink} style={styles.center}>
          {t('billing.trialEnds', { date: trialEndText })}
        </AppText>
      ) : null}
      <View style={styles.center}>
        <TextLink
          tone="accent"
          label={t('billing.cancelAnytime')}
          onPress={() => router.push('/billing')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  center: { textAlign: 'center', alignItems: 'center' },
});
