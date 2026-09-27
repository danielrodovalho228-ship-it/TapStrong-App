import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen, TextLink } from '@/components/ui';
import { refreshBilling, restore } from '@/features/billing/actions';
import {
  currentPlan,
  FAMILY_MAX_PROFILES,
  manageSubscriptionUrl,
  priceLabel,
  TRIAL_REMINDER_DAYS,
  type Period,
} from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { clock } from '@/lib/clock';
import { colors, fonts, spacing } from '@/theme';
import { OwnerOnly } from '@/features/family/OwnerOnly';

/** Mockup 22 — honest billing: trial end, first charge, cancel in 2 taps. */
function BillingScreenInner() {
  const { t, i18n } = useTranslation();
  const { entitlement, prices } = useBillingStore();
  const [message, setMessage] = useState<string | null>(null);
  const plan = currentPlan(entitlement, clock.now());

  useEffect(() => {
    void refreshBilling();
  }, []);

  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) : '—';
  const period: Period = entitlement.productId?.endsWith('annual') ? 'annual' : 'monthly';
  const per = t(period === 'annual' ? 'billing.perYear' : 'billing.perMonth');
  const price = plan === 'free' ? null : priceLabel(prices, plan, period);

  return (
    <Screen
      header={
        <Header
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          title={t('billing.title')}
        />
      }
    >
      {plan === 'free' ? (
        <>
          <Notice>{t('billing.onFree')}</Notice>
          <Button label={t('billing.seePlans')} onPress={() => router.push('/plans')} />
        </>
      ) : (
        <Card style={styles.rows}>
          <Row
            label={t('billing.rows.plan')}
            value={
              plan === 'family'
                ? t('billing.familyProfiles', { count: FAMILY_MAX_PROFILES })
                : t('billing.plans.premium.name')
            }
          />
          {entitlement.status === 'trial' ? (
            <>
              <Row label={t('billing.rows.trialEnds')} value={date(entitlement.trialEndsAt)} />
              <Row
                label={t('billing.rows.firstCharge')}
                value={
                  entitlement.willRenew
                    ? t('billing.onDate', { price, date: date(entitlement.trialEndsAt) })
                    : t('billing.noCharge')
                }
              />
            </>
          ) : (
            <Row
              label={t(entitlement.willRenew ? 'billing.rows.renews' : 'billing.rows.ends')}
              value={date(entitlement.expiresAt)}
            />
          )}
          <Row label={t('billing.rows.then')} value={`${price} ${per}`} />
        </Card>
      )}

      <Card tone="dark" style={styles.promise}>
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {t('billing.promise.title')}
        </AppText>
        {(['price', 'reminder', 'cancel'] as const).map((k, i) => (
          <View key={k} style={styles.promiseRow}>
            <View style={styles.num}>
              <AppText variant="button" color={colors.onAccent}>
                {i + 1}
              </AppText>
            </View>
            <AppText color={colors.dark.text} style={styles.flex}>
              {t(`billing.promise.${k}`, { days: TRIAL_REMINDER_DAYS })}
            </AppText>
          </View>
        ))}
      </Card>

      {message ? <Notice tone="warning">{message}</Notice> : null}

      {plan !== 'free' ? (
        <>
          <Button
            variant="danger"
            label={t('billing.cancel')}
            onPress={() =>
              void Linking.openURL(manageSubscriptionUrl(Platform.OS, entitlement.productId))
            }
          />
          <AppText variant="caption" color={colors.muted} style={styles.center}>
            {t('billing.cancelNote', {
              plan: t(`billing.plans.${plan}.name`),
              date: date(entitlement.expiresAt),
            })}
          </AppText>
        </>
      ) : null}
      <View style={styles.links}>
        <TextLink
          label={t('billing.restore')}
          onPress={async () => {
            const r = await restore();
            setMessage(
              r === 'ok'
                ? t('billing.restored')
                : t(r === 'unavailable' ? 'billing.errors.unavailable' : 'billing.errors.error'),
            );
          }}
        />
        <TextLink
          label={t('billing.deleteAccount')}
          onPress={() => router.push('/delete-account')}
        />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.flex}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 0, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  promise: { gap: spacing.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  promiseRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  num: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  links: { alignItems: 'center', gap: spacing.sm },
});

/** Owner-only: a child profile needs the parent gate (QA B-03). */
export default function BillingScreen() {
  return (
    <OwnerOnly>
      <BillingScreenInner />
    </OwnerOnly>
  );
}
