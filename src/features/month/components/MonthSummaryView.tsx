import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Notice } from '@/components/ui';
import { BodyMapCanvas } from '@/features/bodymap/components/BodyMapCanvas';
import type { BodySex, BodyView } from '@/features/bodymap/images';
import { muscleLabel } from '@/features/onboarding/summaries';
import type { AppMode, BodyBand } from '@/features/profile/age';
import { measurementsAllowed, photosAllowed } from '@/features/progress/checkin';
import type { StrengthRow } from '@/features/progress/store';
import { exerciseName } from '@/features/workout/format';
import { LegendRow } from '@/features/workout/components/RecoveryBody';
import type { Exercise } from '@/features/exercises/types';
import { addDays } from '@/lib/dates';
import { colors, makeStyles, radius, recoveryColors, spacing, useColors } from '@/theme';

import type { MonthSummary } from '../summary';

/** Fill for a muscle by its sets a week (month average). */
export function setsFill(perWeek: number): string | undefined {
  if (perWeek >= 8) return recoveryColors.fresh;
  if (perWeek >= 4) return recoveryColors.recovering;
  if (perWeek > 0) return recoveryColors.almost;
  return undefined;
}

/**
 * The closed month (Phase 26, A): counts, the block's days, the body colored
 * by sets (tap a muscle for this month vs last), strength and records, the
 * measurements and photos entry (adults; 60+ photos only if turned on;
 * never minors) and two lines of highlights, no guilt.
 */
export function MonthSummaryView({
  summary,
  mode,
  band,
  sex,
  library,
  seniorPhotos,
  retestDue,
}: {
  summary: MonthSummary;
  mode: AppMode;
  band: BodyBand;
  sex: BodySex;
  library: Exercise[];
  seniorPhotos: boolean;
  retestDue: boolean;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [view, setView] = useState<BodyView>('front');
  const [picked, setPicked] = useState<string | null>(null);
  const minor = mode === 'child' || mode === 'teen';
  const byId = new Map(library.map((e) => [e.id, e]));
  const name = (id: string) => exerciseName(t, byId.get(id), id);
  const hours = Math.floor(summary.minutes / 60);
  const mins = summary.minutes % 60;
  const perWeek = (m: string) => (summary.sets[m] ?? 0) / summary.weeks;
  // Sub-muscles (upper / mid / lower chest…) take their parent's color.
  const fills: Record<string, string | undefined> = {};
  for (const m of Object.keys(summary.sets)) fills[m] = setsFill(perWeek(m));
  for (const key of ['upperChest', 'midChest', 'lowerChest']) fills[key] = fills.chest;
  for (const key of ['upperAbs', 'lowerAbs']) fills[key] = fills.abs;
  const parentOfTap = (key: string) =>
    key.endsWith('Chest') ? 'chest' : key.endsWith('Abs') ? 'abs' : key;

  const weeks = Array.from({ length: summary.weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(summary.from, w * 7 + d)),
  );
  const trained = new Set(summary.trainedDays);
  const value = (r: StrengthRow, side: 'first' | 'last') => {
    const v = r[side];
    if (r.kind === 'load') return `${v.value} ${t(`workout.units.${v.unit ?? 'kg'}`)} × ${v.reps}`;
    if (r.kind === 'reps') return t('workout.rest.reps', { count: v.value });
    return `${v.value} s`;
  };
  const tappedMuscle = picked ? parentOfTap(picked) : null;

  return (
    <View style={styles.wrap}>
      <AppText variant="h1" accessibilityRole="header">
        {summary.weeks > 4 ? t('month.titleBlock', { n: summary.blockNo + 1 }) : t('month.title')}
      </AppText>
      <View style={styles.stats}>
        <Stat label={t('month.statWorkouts')} value={String(summary.workouts)} />
        <Stat label={t('month.statDays')} value={String(summary.trainedDays.length)} />
        <Stat
          label={t('month.statTime')}
          value={hours ? t('month.hours', { h: hours, m: mins }) : t('month.minutes', { m: mins })}
        />
      </View>

      {retestDue ? (
        // First step, never a block (Phase 26, A6).
        <Notice title={t('month.repairDue')}>
          <Button
            variant="secondary"
            label={t('month.repairButton')}
            onPress={() => router.push('/repair')}
          />
        </Notice>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="h3">{t('month.calendar')}</AppText>
        <View accessibilityLabel={t('month.statDays')} style={styles.grid}>
          {weeks.map((row, i) => (
            <View key={i} style={styles.gridRow}>
              {row.map((day) => (
                <View
                  key={day}
                  testID={trained.has(day) ? `month-day-${day}-on` : `month-day-${day}`}
                  style={[
                    styles.dot,
                    { backgroundColor: trained.has(day) ? colors.accent : colors.line },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={trained.has(day) ? colors.onAccent : colors.muted}
                  >
                    {Number(day.slice(8))}
                  </AppText>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="h3">{t('month.bodyTitle')}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('month.bodyHint')}
        </AppText>
        <BodyMapCanvas
          band={band}
          sex={sex}
          view={view}
          selected={picked ? [picked] : []}
          recovery={fills}
          onToggle={(key) => setPicked(key === picked ? null : key)}
          maxHeight={420}
          accessibilityLabel={t('month.bodyTitle')}
        />
        <View style={styles.row}>
          {(['front', 'back'] as const).map((v) => (
            <Button
              key={v}
              variant={v === view ? 'primary' : 'ghost'}
              label={t(`bodyMap.${v}`)}
              onPress={() => setView(v)}
            />
          ))}
        </View>
        {tappedMuscle ? (
          <AppText testID="month-muscle-compare">
            {summary.blockNo > 0
              ? t('month.muscleCompare', {
                  muscle: muscleLabel(t, tappedMuscle),
                  now: summary.sets[tappedMuscle] ?? 0,
                  before: summary.prevSets[tappedMuscle] ?? 0,
                })
              : t('month.muscleCompareFirst', {
                  muscle: muscleLabel(t, tappedMuscle),
                  now: summary.sets[tappedMuscle] ?? 0,
                })}
          </AppText>
        ) : null}
        <LegendRow color={recoveryColors.fresh} label={t('month.legendLots')} />
        <LegendRow color={recoveryColors.recovering} label={t('month.legendSome')} />
        <LegendRow color={recoveryColors.almost} label={t('month.legendLittle')} />
      </Card>

      {minor ? (
        // Teens: habits, not numbers (Phase 26, F).
        <Card style={styles.card}>
          <AppText variant="h3">{t('month.habitTitle')}</AppText>
          <AppText>{t('month.habitBody', { days: summary.trainedDays.length })}</AppText>
        </Card>
      ) : (
        <Card style={styles.card}>
          <AppText variant="h3">{t('month.strengthTitle')}</AppText>
          {summary.strength.length ? (
            summary.strength.map((r) => (
              <AppText key={r.exerciseId}>
                {t('month.strengthLine', {
                  exercise: name(r.exerciseId),
                  from: value(r, 'first'),
                  to: value(r, 'last'),
                })}
              </AppText>
            ))
          ) : (
            <AppText color={colors.mutedStrong}>{t('month.strengthNone')}</AppText>
          )}
          {summary.records.length ? (
            <>
              <AppText variant="bodyStrong">{t('month.recordsTitle')}</AppText>
              {summary.records.map((r) => (
                <AppText key={r.exerciseId}>
                  {t('month.recordLine', {
                    exercise: name(r.exerciseId),
                    load: `${r.value} ${t(`workout.units.${r.unit}`)}`,
                  })}
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
      )}

      {measurementsAllowed(mode) || photosAllowed(mode, seniorPhotos) ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('month.measureTitle')}</AppText>
          {measurementsAllowed(mode) ? (
            <>
              <AppText color={colors.mutedStrong}>{t('month.measureBody')}</AppText>
              <Button
                variant="secondary"
                label={t('month.measureButton')}
                onPress={() => router.push('/checkin')}
              />
            </>
          ) : null}
          {photosAllowed(mode, seniorPhotos) ? (
            <Button
              variant="ghost"
              label={t('month.photosButton')}
              onPress={() => router.push('/before-after')}
            />
          ) : null}
        </Card>
      ) : null}

      {summary.strong || summary.weak ? (
        <Card style={styles.card}>
          {summary.strong ? (
            <AppText>
              {t(summary.strong.kind === 'growth' ? 'month.strongGrowth' : 'month.strongMost', {
                muscle: muscleLabel(t, summary.strong.muscle),
                n: summary.strong.perWeek,
              })}
            </AppText>
          ) : null}
          {summary.weak ? (
            <AppText color={colors.mutedStrong}>
              {t('month.weak', { muscle: muscleLabel(t, summary.weak.muscle) })}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.stat}>
      <AppText variant="h2">{value}</AppText>
      <AppText variant="caption" color={colors.mutedStrong}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  card: { gap: spacing.sm },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  dot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
}));
