import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Chip, Icon, IconButton, TextField } from '@/components/ui';
import type { AppMode } from '@/features/profile/age';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { useLibraryStore } from '@/features/library/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

import { AchievementsCard } from './AchievementsCard';
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
  const colors = useColors();
  const styles = useStyles();
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
            value: compact(totals.volume, i18n.language),
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
    <View style={styles.sections}>
      {/* "Total activity" (Phase 31, G): range pills and big numbers. */}
      <SectionHead title={t('progress.activity.title')} />
      <View style={styles.panel}>
        <View
          style={styles.ranges}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('progress.activity.rangeLabel')}
        >
          {RANGES.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: r === range }}
              accessibilityLabel={t(`progress.activity.range.${r}`)}
              onPress={() => setRange(r)}
              style={[styles.range, r === range && styles.rangeOn]}
            >
              <AppText
                variant="bodyStrong"
                color={r === range ? colors.onAccent : colors.accentText}
              >
                {t(`progress.activity.rangeShort.${r}`)}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.tiles}>
          {tiles.slice(0, 3).map((tile, n) => (
            <View
              key={tile.key}
              style={[styles.tile, n > 0 && styles.tileDivider]}
              testID={`activity-${tile.key}`}
            >
              <AppText
                variant="display"
                color={colors.accentText}
                style={styles.big}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {String(tile.value)}
              </AppText>
              <AppText color={colors.mutedStrong} style={styles.center} numberOfLines={2}>
                {tile.label}
              </AppText>
            </View>
          ))}
        </View>
        {/* Three big numbers, like the reference; a fourth goes on one line. */}
        {tiles[3] ? (
          <AppText
            color={colors.mutedStrong}
            style={styles.center}
            testID={`activity-${tiles[3].key}`}
          >
            {t('progress.activity.mobilityLine', { n: tiles[3].value })}
          </AppText>
        ) : null}
      </View>

      {/* "Your workouts": the month calendar. */}
      <SectionHead title={t('progress.activity.yourWorkouts')} />
      <View style={styles.panel}>
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
      </View>

      <AchievementsCard mode={mode} unit={unit} />

      {senior ? null : (
        <>
          <SectionHead title={t('progress.activity.graphs')} />
          <View style={styles.panel}>
            <ExerciseGraph unit={unit} library={library} workouts={workouts} />
          </View>
        </>
      )}
    </View>
  );
}

function SectionHead({ title }: { title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHead}>
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
    </View>
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
  const colors = useColors();
  const styles = useStyles();
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
      {/* Goal and current max side by side (Phase 31, G). */}
      <View style={styles.goalRow}>
        <View style={styles.goalBox}>
          <AppText variant="bodyStrong">{t('progress.activity.goalTitle')}</AppText>
          <View style={styles.goalValue}>
            <AppText variant="display" color={colors.accentText} style={styles.big}>
              {goal ? goal.toLocaleString(i18n.language) : '—'}
            </AppText>
            <AppText color={colors.accentText}>{unitText}</AppText>
            <Icon
              name="trophy"
              size={26}
              color={goal && max >= goal ? colors.accent : colors.muted}
            />
          </View>
        </View>
        <View style={styles.maxBox}>
          <AppText variant="bodyStrong">{t('progress.activity.currentMax')}</AppText>
          <View style={styles.goalValue}>
            <AppText variant="display" color={colors.accentText} style={styles.big}>
              {max.toLocaleString(i18n.language)}
            </AppText>
            <AppText color={colors.accentText}>{unitText}</AppText>
          </View>
        </View>
      </View>
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

const useStyles = makeStyles(() => ({
  sections: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card * 2,
    backgroundColor: colors.sunken,
  },
  ranges: { flexDirection: 'row', justifyContent: 'space-between' },
  range: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeOn: { backgroundColor: colors.accent },
  big: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  tileDivider: { borderLeftWidth: 1, borderLeftColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tiles: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xxs },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2, textAlign: 'center' },
  dot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.accent },
  graph: { gap: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  goalBox: {
    flex: 1,
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  maxBox: { flex: 1, alignItems: 'flex-end', gap: spacing.xxs, paddingTop: spacing.md },
  goalValue: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xxs },
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
}));

/** "1.5K" / "1,5 mil" once a number gets long, so it fits its tile. */
function compact(n: number, locale: string) {
  return n >= 10_000
    ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : n.toLocaleString(locale);
}
