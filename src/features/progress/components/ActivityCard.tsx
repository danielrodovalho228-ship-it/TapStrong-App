import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, IconButton, TextField } from '@/components/ui';
import type { AppMode } from '@/features/profile/age';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { useLibraryStore } from '@/features/library/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

import {
  activityTotals,
  exerciseBest,
  loggedExercises,
  monthGrid,
  trainedDays,
  type ActivityRange,
} from '../activity';

const RANGES: ActivityRange[] = ['7d', '30d', '6m', '12m', 'all'];
const LB = 0.45359237;
const BAR_HEIGHT = 110;

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Progress → Activity (improvements v1, D1). Teens see no volume; 60+ see
 * only workouts, hours and the calendar.
 */
export function ActivityCard({ mode, unit }: { mode: AppMode; unit: 'lb' | 'kg' }) {
  const { t, i18n } = useTranslation();
  const workouts = useWorkoutStore((s) => s.workouts);
  const library = useExerciseLibrary();
  const now = clock.now();
  const senior = mode === 'senior';
  const [range, setRange] = useState<ActivityRange>('30d');
  const [month, setMonth] = useState(() => localDate(now).slice(0, 7));
  const totals = activityTotals(workouts, range, now, unit);
  const days = trainedDays(workouts, month);
  const startsOn = deviceWeekStart();
  const weekday = (d: number) =>
    new Date(2026, 8, 20 + d, 12).toLocaleDateString(i18n.language, { weekday: 'narrow' }); // Sep 20 2026 is a Sunday
  const [y, m] = month.split('-').map(Number);
  // "Outubro de 2026", not "Outubro De 2026" (QA R4 P2): only the first letter.
  const monthRaw = new Date(y, m - 1, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });
  const monthTitle = monthRaw.charAt(0).toLocaleUpperCase(i18n.language) + monthRaw.slice(1);
  const dayText = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
      month: 'short',
      day: 'numeric',
    });

  const tiles = [
    {
      key: 'workouts',
      label: t('progress.activity.workouts'),
      value: totals.workouts.toLocaleString(i18n.language),
    },
    {
      key: 'hours',
      label: t('progress.activity.hours'),
      value: totals.hours.toLocaleString(i18n.language),
    },
    ...(mode === 'adult'
      ? [
          {
            key: 'volume',
            label: t('progress.activity.volume', { unit: t(`workout.units.${unit}`) }),
            value: totals.volume.toLocaleString(i18n.language),
          },
        ]
      : []),
    ...(senior
      ? []
      : [
          {
            key: 'mobility',
            label: t('progress.activity.mobility'),
            value: totals.mobility.toLocaleString(i18n.language),
          },
        ]),
  ];

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t('progress.activity.title')}</AppText>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('progress.activity.rangeLabel')}
      >
        {RANGES.map((r) => (
          <Chip
            key={r}
            label={t(`progress.activity.range.${r}`)}
            selected={r === range}
            onPress={() => setRange(r)}
          />
        ))}
      </View>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.key} style={styles.tile} testID={`activity-${tile.key}`}>
            <AppText variant="caption" color={colors.muted} style={styles.caps}>
              {tile.label}
            </AppText>
            <AppText variant="h2">{String(tile.value)}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.monthHead}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel={t('progress.activity.prevMonth')}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <AppText variant="bodyStrong" style={styles.monthTitle}>
          {monthTitle}
        </AppText>
        <IconButton
          icon="chevron-right"
          accessibilityLabel={t('progress.activity.nextMonth')}
          disabled={month >= localDate(now).slice(0, 7)}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </View>
      <View>
        <View style={styles.week}>
          {Array.from({ length: 7 }, (_, i) => (
            <AppText key={i} variant="caption" color={colors.muted} style={styles.dayCell}>
              {weekday((startsOn + i) % 7)}
            </AppText>
          ))}
        </View>
        {monthGrid(month, startsOn).map((row, r) => (
          <View key={r} style={styles.week}>
            {row.map((date, i) =>
              date ? (
                <View
                  key={date}
                  style={styles.dayCell}
                  accessible
                  accessibilityLabel={
                    days.has(date)
                      ? t('progress.activity.dayTrained', { date: dayText(date) })
                      : dayText(date)
                  }
                  testID={days.has(date) ? `trained-${date}` : undefined}
                >
                  <View style={[styles.dot, days.has(date) ? styles.dotOn : null]}>
                    <AppText
                      variant="caption"
                      color={days.has(date) ? colors.onAccent : colors.ink}
                    >
                      {String(Number(date.slice(8)))}
                    </AppText>
                  </View>
                </View>
              ) : (
                <View key={`e${i}`} style={styles.dayCell} />
              ),
            )}
          </View>
        ))}
      </View>

      {senior ? null : <ExerciseGraph unit={unit} library={library} workouts={workouts} />}
    </Card>
  );
}

function ExerciseGraph({
  unit,
  library,
  workouts,
}: {
  unit: 'lb' | 'kg';
  library: ReturnType<typeof useExerciseLibrary>;
  workouts: ReturnType<typeof useWorkoutStore.getState>['workouts'];
}) {
  const { t, i18n } = useTranslation();
  const exercises = loggedExercises(workouts, library);
  const [picked, setPicked] = useState<string | null>(null);
  const goals = useLibraryStore((s) => s.goals);
  const setGoal = useLibraryStore((s) => s.setGoal);
  const id = picked ?? exercises[0]?.id ?? null;
  const unitText = t(`workout.units.${unit}`);
  const stored = id ? goals[id] : undefined;
  const goal = stored
    ? stored.unit === unit
      ? stored.value
      : Math.round(stored.unit === 'lb' ? stored.value * LB : stored.value / LB)
    : null;
  const [draft, setDraft] = useState<string | null>(null);

  if (!id) {
    return (
      <View style={styles.graph}>
        <AppText variant="bodyStrong">{t('progress.activity.exercise')}</AppText>
        <AppText color={colors.mutedStrong}>{t('progress.activity.exerciseEmpty')}</AppText>
      </View>
    );
  }
  const { points, max } = exerciseBest(workouts, id, unit);
  const recent = points.slice(-8);
  const top = Math.max(max, goal ?? 0, 1);
  const saveGoal = () => {
    if (draft === null) return;
    const value = Number(draft.replace(',', '.'));
    setGoal(id, Number.isFinite(value) && value > 0 ? { value, unit } : null);
    setDraft(null);
  };

  return (
    <View style={styles.graph}>
      <AppText variant="bodyStrong">{t('progress.activity.exercise')}</AppText>
      {/* Every logged exercise, scrolling sideways (QA R4 P2: only 8 before). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {exercises.map((e) => (
          <Chip
            key={e.id}
            label={exerciseName(t, e, e.id)}
            selected={e.id === id}
            onPress={() => {
              setPicked(e.id);
              setDraft(null);
            }}
          />
        ))}
      </ScrollView>
      <View style={styles.plot}>
        {recent.map((p) => (
          <View
            key={p.date}
            style={styles.col}
            accessible
            accessibilityLabel={t('progress.activity.pointLabel', {
              date: new Date(p.date).toLocaleDateString(i18n.language),
              value: p.best,
              unit: unitText,
            })}
          >
            <View
              style={[
                styles.bar,
                { height: Math.max(2, (p.best / top) * BAR_HEIGHT) },
                p.best === max ? styles.barOn : styles.barOff,
              ]}
            />
          </View>
        ))}
        {goal ? (
          <View
            pointerEvents="none"
            style={[styles.goalLine, { bottom: (goal / top) * BAR_HEIGHT }]}
          />
        ) : null}
      </View>
      <AppText variant="bodyStrong">
        {t('progress.activity.best', { value: max.toLocaleString(i18n.language), unit: unitText })}
      </AppText>
      {goal ? (
        <AppText color={max >= goal ? colors.teal : colors.mutedStrong}>
          {max >= goal
            ? t('progress.activity.goalMet')
            : t('progress.activity.goalLeft', {
                value: Math.round((goal - max) * 10) / 10,
                unit: unitText,
              })}
        </AppText>
      ) : null}
      <TextField
        label={t('progress.activity.goal', { unit: unitText })}
        keyboardType="decimal-pad"
        value={draft ?? (goal ? String(goal) : '')}
        onChangeText={setDraft}
        onEndEditing={saveGoal}
        onSubmitEditing={saveGoal}
        onBlur={saveGoal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.background,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2, textAlign: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.accent },
  graph: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  plot: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  col: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barOn: { backgroundColor: colors.accent },
  barOff: { backgroundColor: colors.line },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.teal,
  },
});
