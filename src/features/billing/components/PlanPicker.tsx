import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, SegmentedControl } from '@/components/ui';
import { kidsUnder13Enabled } from '@/lib/features';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { priceLabel, type Period, type Plan } from '../rules';
import { useBillingStore } from '../store';

type Props = {
  plan: Plan;
  period: Period;
  onPlan: (plan: Plan) => void;
  onPeriod: (period: Period) => void;
  showFree?: boolean;
};

/** Plan cards (mockup 19): Free, Premium, Family, with monthly / yearly. */
export function PlanPicker({ plan, period, onPlan, onPeriod, showFree = true }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const prices = useBillingStore((s) => s.prices);
  const plans: Plan[] = showFree ? ['free', 'premium', 'family'] : ['premium', 'family'];

  return (
    <View style={styles.wrap}>
      <SegmentedControl
        accessibilityLabel={t('billing.period')}
        value={period}
        onChange={onPeriod}
        options={[
          { value: 'monthly' as Period, label: t('billing.monthly') },
          { value: 'annual' as Period, label: t('billing.annual') },
        ]}
      />
      <View accessibilityRole="radiogroup" style={styles.list}>
        {plans.map((p) => {
          const selected = plan === p;
          const price = p === 'free' ? '$0' : priceLabel(prices, p, period);
          return (
            <Pressable
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={`${t(`billing.plans.${p}.name`)}, ${price}`}
              onPress={() => onPlan(p)}
              style={[styles.card, selected && styles.cardOn]}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <AppText variant="bodyStrong">{t(`billing.plans.${p}.name`)}</AppText>
                  {p === 'family' ? (
                    <View style={styles.badge}>
                      <AppText variant="caption" color={colors.ink} style={styles.badgeText}>
                        {t('billing.bestValue')}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t(
                    p === 'family' && !kidsUnder13Enabled()
                      ? 'billing.plans.family.detailTeens'
                      : `billing.plans.${p}.detail`,
                  )}
                </AppText>
              </View>
              <View style={styles.price}>
                <AppText variant="h3">{price}</AppText>
                {p !== 'free' ? (
                  <AppText variant="caption" color={colors.muted}>
                    {t(period === 'annual' ? 'billing.perYear' : 'billing.perMonth')}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardOn: { borderColor: colors.ink, borderWidth: 2.5 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  text: { flex: 1, gap: spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    // A label, not an action (QA R7 P2).
    backgroundColor: colors.primarySoft,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
  },
  badgeText: { fontFamily: fonts.headingSemi, textTransform: 'uppercase', letterSpacing: 0.8 },
  price: { alignItems: 'flex-end' },
}));
