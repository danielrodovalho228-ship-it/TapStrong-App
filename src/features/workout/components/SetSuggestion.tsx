import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { exerciseRecords } from '@/features/library/performance';
import { exerciseBest } from '@/features/progress/activity';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { LOAD_STEP } from '../progression';
import type { LoadUnit, WorkoutRecord } from '../types';

/**
 * Today's suggestion for a loaded set (Phase 29, B4; adults only, never
 * minors): "Suggested: 80 lb × 10–12 (last time: 75 × 12)", a mini chart of
 * the best load per session and, for adults under 60, the record to beat.
 */
export function SetSuggestion({
  workouts,
  workoutId,
  exerciseId,
  unit,
  load,
  reps,
  showRecord,
}: {
  workouts: WorkoutRecord[];
  workoutId: string;
  exerciseId: string;
  unit: LoadUnit;
  load: number;
  /** The reps text shown: "10–12" or "11". */
  reps: string;
  showRecord: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  if (load <= 0) return null;
  const others = workouts.filter((w) => w.id !== workoutId);
  const last = exerciseRecords(others, exerciseId, unit).sessions.at(-1);
  const best = exerciseBest(others, exerciseId, unit);
  const u = t(`workout.units.${unit}`);
  const points = best.points.slice(-8);
  const top = Math.max(...points.map((p) => p.best), load);
  return (
    <View style={styles.wrap} testID="set-suggestion">
      <AppText variant="bodyStrong">{t('load.suggested', { load, unit: u, reps })}</AppText>
      {last?.bestLoad ? (
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('load.lastTime', { load: last.bestLoad, reps: last.bestReps ?? 0 })}
        </AppText>
      ) : null}
      {points.length >= 2 ? (
        <View
          style={styles.chart}
          accessible
          accessibilityLabel={t('load.chart', { max: best.max, unit: u })}
          testID="set-suggestion-chart"
        >
          {points.map((p) => (
            <View
              key={p.date}
              style={[styles.bar, { height: `${Math.max(10, (p.best / top) * 100)}%` }]}
            />
          ))}
        </View>
      ) : null}
      {showRecord && best.max > 0 ? (
        <AppText variant="caption" color={colors.teal} testID="set-suggestion-record">
          {t('load.recordGoal', { load: best.max + LOAD_STEP[unit], unit: u })}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.background,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs, height: 36 },
  bar: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.chip, opacity: 0.8 },
}));
