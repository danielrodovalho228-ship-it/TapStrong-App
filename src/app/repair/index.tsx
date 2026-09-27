import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { MovementPainEntry } from '@/features/movement/Entry';
import { useProgressStore } from '@/features/progress/store';
import { buildRepairPlan, grade } from '@/features/repair/tests';
import { useRepair } from '@/features/repair/useRepair';
import { clock } from '@/lib/clock';
import { colors, fonts, sizes, spacing } from '@/theme';

const GRADE_COLOR = {
  good: colors.teal,
  uneven: colors.accent,
  low: colors.accent,
  limited: colors.accent,
  todo: colors.accent,
} as const;

/** Mockup 17 — Repair check: find weak spots (SPEC §9 /repair). */
export default function RepairScreen() {
  const { t } = useTranslation();
  const { all, tests, mode, results, plan, found } = useRepair();
  const setRepairPlan = useProgressStore((s) => s.setRepairPlan);
  const entitlement = useBillingStore((s) => s.entitlement);
  const premium = currentPlan(entitlement, clock.now()) !== 'free';
  const done = tests.filter((x) => results.some((r) => r.testKey === x.key)).length;
  const skipped = all.length - tests.length;

  const buildPlan = () => {
    // Free: 1 Repair check; the 6-week plan is Premium (mockup 19).
    if (!premium) return router.push('/paywall');
    const next = buildRepairPlan(tests, found, clock.now());
    if (!next) return;
    setRepairPlan(next);
    router.push('/repair/plan');
  };

  if (!all.length) {
    return (
      <Screen
        header={
          <Header
            onBack={() => router.back()}
            eyebrow={t('repair.eyebrow')}
            title={t('repair.title')}
          />
        }
      >
        <Notice icon>{t('repair.underReview')}</Notice>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('repair.eyebrow')}
          title={t('repair.title')}
        />
      }
      footer={
        plan ? (
          <Button label={t('repair.openPlan')} onPress={() => router.push('/repair/plan')} />
        ) : found.length && done === tests.length ? (
          <Button label={t('repair.buildPlan')} onPress={buildPlan} />
        ) : null
      }
    >
      {__DEV__ ? <Notice tone="warning">{t('repair.devOnly')}</Notice> : null}
      <MovementPainEntry />
      <AppText color={colors.mutedStrong}>{t('repair.intro')}</AppText>
      <Card style={styles.list}>
        {tests.map((test, i) => {
          const result = results.find((r) => r.testKey === test.key);
          const g = grade(test, result, mode);
          const value =
            result?.value != null
              ? ` · ${t(test.kind === 'reps' ? 'workout.rest.reps' : 'workout.seconds', { count: result.value, value: result.value })}`
              : '';
          return (
            <Pressable
              key={test.key}
              accessibilityRole="button"
              accessibilityLabel={`${t(`repair.tests.${test.key as 'squat'}.name`)}, ${t(`repair.grades.${g}`)}`}
              onPress={() =>
                router.push({ pathname: '/repair/test/[key]', params: { key: test.key } })
              }
              style={[styles.row, i > 0 && styles.divider]}
            >
              <AppText variant="bodyStrong" style={styles.flex}>
                {t(`repair.tests.${test.key as 'squat'}.name`)}
                {value}
              </AppText>
              <AppText
                variant="caption"
                color={GRADE_COLOR[g]}
                style={[styles.caps, g === 'todo' && styles.underline]}
              >
                {t(`repair.grades.${g}`)}
              </AppText>
            </Pressable>
          );
        })}
      </Card>
      {skipped > 0 ? (
        <AppText variant="caption" color={colors.muted}>
          {t('repair.skipped', { count: skipped })}
        </AppText>
      ) : null}

      {found.length ? (
        <Card tone="dark" style={styles.found}>
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
            {t('repair.foundTitle')}
          </AppText>
          {found.map((f) => (
            <AppText key={f.testKey} color={colors.dark.text}>
              {t(`repair.findings.${f.testKey as 'squat'}`, {
                side: f.side ? t(`repair.sides.${f.side}`) : '',
              })}
            </AppText>
          ))}
          <AppText variant="caption" color={colors.dark.accentSoft}>
            {t('repair.notDiagnosis')}
          </AppText>
        </Card>
      ) : done === tests.length && done > 0 ? (
        <Notice>{t('repair.allGood')}</Notice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.heading },
  underline: { textDecorationLine: 'underline' },
  found: { gap: spacing.sm },
});
