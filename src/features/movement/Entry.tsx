import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon } from '@/components/ui';
import { clock } from '@/lib/clock';
import { colors, sizes, spacing } from '@/theme';

import { movementCatalog } from './catalog';
import { retestDue, retestSeries } from './progress';
import { activeReports, useMovementPainStore } from './store';
import { PainBars, reportTitle } from './ui';

/**
 * Entry to "Movement that hurts" (SPEC §8) and the open recovery plans.
 * Hidden in release builds until the reviewer signs the catalog off.
 */
export function MovementPainEntry({ chart = false }: { chart?: boolean }) {
  const { t } = useTranslation();
  const catalog = useMemo(() => movementCatalog(), []);
  const reports = activeReports(useMovementPainStore((s) => s.reports));
  if (!catalog) return null;
  const now = clock.now();

  return (
    <View style={styles.wrap}>
      {reports.map((r) => (
        <Pressable
          key={r.id}
          accessibilityRole="button"
          accessibilityLabel={t('movementPain.entry.open', { area: reportTitle(t, r) })}
          onPress={() => router.push({ pathname: '/movement-pain/[id]', params: { id: r.id } })}
        >
          <Card style={styles.card}>
            <View style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {t('movementPain.entry.open', { area: reportTitle(t, r) })}
              </AppText>
              <Icon name="chevron-right" color={colors.teal} />
            </View>
            {retestDue(r, now) ? (
              <AppText variant="caption" color={colors.teal}>
                {t('movementPain.plan.retestDue')}
              </AppText>
            ) : null}
            {chart ? <PainBars points={retestSeries(r).map((p) => p.score)} /> : null}
          </Card>
        </Pressable>
      ))}
      {!chart || !reports.length ? (
        <Card tone="safety" style={styles.card}>
          <AppText color={colors.teal}>{t('movementPain.entry.body')}</AppText>
          <Button
            variant="secondary"
            label={t('movementPain.entry.cta')}
            onPress={() => router.push('/movement-pain')}
          />
        </Card>
      ) : null}
    </View>
  );
}

/** After a workout: one button per open plan to rate the pain (traffic light). */
export function RatePainButtons({ workoutId }: { workoutId: string }) {
  const { t } = useTranslation();
  const reports = activeReports(useMovementPainStore((s) => s.reports));
  return (
    <>
      {reports
        .filter((r) => !r.checks.some((c) => c.kind === 'after' && c.workoutId === workoutId))
        .map((r) => (
          <Button
            key={r.id}
            variant="secondary"
            label={t('movementPain.rateAfter', { area: reportTitle(t, r) })}
            onPress={() =>
              router.push({
                pathname: '/movement-pain/check',
                params: { id: r.id, kind: 'after', workout: workoutId },
              })
            }
          />
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
  },
  flex: { flex: 1 },
});
