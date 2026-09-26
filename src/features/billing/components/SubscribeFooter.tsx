import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Notice, TextLink } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

import { buy } from '../actions';
import {
  currentPlan,
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
export function SubscribeFooter({ plan, period }: { plan: Plan; period: Period }) {
  const { t } = useTranslation();
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

  const price = priceLabel(prices, plan, period);
  const per = t(period === 'annual' ? 'billing.perYear' : 'billing.perMonth');
  const subscribed = current === plan && entitlement.productId === PRODUCTS[plan][period];

  const onPress = async () => {
    if (subscribed) return router.push('/billing');
    if (!saved) return router.push('/account');
    setBusy(true);
    setMessage(null);
    const result = await buy(PRODUCTS[plan][period]);
    setBusy(false);
    if (result === 'ok') router.replace('/billing');
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
              : hadTrial
                ? t('billing.subscribe', { price, per })
                : t('billing.startTrial', { days: TRIAL_DAYS })
        }
        loading={busy}
        onPress={onPress}
      />
      <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
        {hadTrial
          ? t('billing.termsNoTrial', { price, per })
          : t('billing.terms', { price, per, days: TRIAL_DAYS, reminder: TRIAL_REMINDER_DAYS })}
      </AppText>
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
