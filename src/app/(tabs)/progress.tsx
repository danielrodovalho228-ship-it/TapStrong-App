import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Card,
  Chip,
  Icon,
  Screen,
  SegmentedControl,
  TextLink,
  ToggleRow,
  type IconName,
} from '@/components/ui';
import { EmptyState } from '@/features/home/EmptyState';
import { MovementPainEntry } from '@/features/movement/Entry';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { ActivityCard } from '@/features/progress/components/ActivityCard';
import { BodyPanel } from '@/features/progress/components/BodyPanel';
import { formatLength, formatWeight } from '@/features/progress/format';
import { checkinDue, measurementsAllowed, photosAllowed } from '@/features/progress/checkin';
import { WeekChart } from '@/features/progress/components/WeekChart';
import { chartMuscles, totals, weeklySets } from '@/features/progress/stats';
import { useProgressStore } from '@/features/progress/store';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { streakToday } from '@/features/workout/streak';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/** Mockup 18 — progress (SPEC §9 /(tabs)/progress). */
export default function ProgressScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const profile = useOnboardingStore();
  const mode = modeOf(profile);
  const { workouts, streak } = useWorkoutStore();
  const { checkins, seniorPhotos, setSeniorPhotos } = useProgressStore();
  const library = useExerciseLibrary();
  const now = clock.now();
  const muscles = chartMuscles(
    profile.muscleGoals.map((g) => g.muscleKey),
    workouts,
    library,
  );
  const [muscle, setMuscle] = useState<string | null>(null);
  const selected = muscle ?? muscles[0] ?? null;
  const { workouts: count, sets } = totals(workouts);
  // Latest known value of each, even if the last check-in skipped it (QA P2).
  const last = {
    waistCm: [...checkins].reverse().find((c) => c.waistCm)?.waistCm,
    weightKg: [...checkins].reverse().find((c) => c.weightKg)?.weightKg,
  };
  const adult = measurementsAllowed(mode);
  const [view, setView] = useState<'activity' | 'body'>('activity');
  const unit = profile.units === 'imperial' ? 'lb' : 'kg';

  const activity = (
    <>
      <View style={styles.stats}>
        <Stat
          label={t('progress.streak')}
          value={t('progress.days', {
            count: streakToday(streak, localDate(now), deviceWeekStart()),
          })}
        />
        <Stat label={t('progress.workouts')} value={String(count)} />
        {mode === 'senior' ? null : <Stat label={t('progress.sets')} value={String(sets)} />}
      </View>

      <ActivityCard mode={mode} unit={unit} />

      {/* 60+: workouts, hours and the calendar only (QA R4 P2). */}
      {mode === 'senior' ? null : (
        <Card style={styles.card}>
          <AppText variant="h3">{t('progress.chart.title')}</AppText>
          {selected ? (
            <>
              <View style={styles.chips}>
                {muscles.map((m) => (
                  <Chip
                    key={m}
                    label={muscleLabel(t, m)}
                    selected={m === selected}
                    onPress={() => setMuscle(m)}
                  />
                ))}
              </View>
              <WeekChart bars={weeklySets(workouts, library, selected, now, deviceWeekStart())} />
            </>
          ) : (
            <EmptyState
              icon="progress"
              title={t('progress.chart.empty')}
              action={{ label: t('home.trainNow'), onPress: () => router.push('/home') }}
            />
          )}
        </Card>
      )}

      <Card style={styles.card}>
        <View style={styles.row}>
          <AppText variant="h3" style={styles.flex}>
            {adult ? t('progress.measurements') : t('progress.checkinTitle')}
          </AppText>
          <TextLink
            tone="accent"
            label={t('progress.openCheckin')}
            onPress={() => router.push('/checkin')}
          />
        </View>
        {checkinDue(workouts, checkins, now) ? (
          <AppText color={colors.teal}>{t('progress.checkinReady')}</AppText>
        ) : null}
        {adult && last.waistCm ? (
          <>
            <Line
              label={t('progress.waist')}
              value={formatLength(t, last.waistCm, profile.units)}
            />
            {last.weightKg ? (
              <Line
                label={t('progress.weight')}
                value={formatWeight(t, last.weightKg, profile.units)}
              />
            ) : null}
          </>
        ) : (
          <AppText color={colors.mutedStrong}>
            {adult ? t('progress.noMeasurements') : t('progress.strengthOnly')}
          </AppText>
        )}
      </Card>

      <MovementPainEntry chart />

      <View style={styles.links}>
        {/* Past month summaries (Phase 26, G). */}
        <LinkRow
          icon="check"
          label={t('month.monthsTitle')}
          onPress={() => router.push('/months')}
        />
        <LinkRow
          icon="star"
          label={t('progress.links.badges')}
          onPress={() => router.push({ pathname: '/milestone', params: { from: 'badges' } })}
        />
        <LinkRow
          icon="shield"
          label={t('progress.links.repair')}
          onPress={() => router.push('/repair')}
        />
        <LinkRow
          icon="alert"
          label={t('progress.links.restrictions')}
          onPress={() => router.push('/restrictions')}
        />
        {photosAllowed(mode, seniorPhotos) ? (
          <LinkRow
            icon="body"
            label={t('progress.links.photos')}
            onPress={() => router.push('/before-after')}
          />
        ) : null}
        <LinkRow
          icon="family"
          label={t('settings.open')}
          onPress={() => router.push('/settings')}
        />
      </View>
      {mode === 'senior' ? (
        <Card>
          <ToggleRow
            label={t('progress.seniorPhotos')}
            detail={t('progress.seniorPhotosDetail')}
            value={seniorPhotos}
            onChange={setSeniorPhotos}
          />
        </Card>
      ) : null}
    </>
  );

  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        {t('progress.title')}
      </AppText>
      {adult ? (
        <SegmentedControl
          accessibilityLabel={t('progress.segment.label')}
          value={view}
          onChange={setView}
          options={[
            { value: 'activity', label: t('progress.segment.activity') },
            { value: 'body', label: t('progress.segment.body') },
          ]}
        />
      ) : null}
      {adult && view === 'body' ? <BodyPanel /> : activity}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color={colors.muted} style={styles.caps}>
        {label}
      </AppText>
      <AppText variant="h2">{value}</AppText>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, styles.line]}>
      <AppText style={styles.flex}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.linkRow}
    >
      <Icon name={icon} color={colors.teal} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <Icon name="chevron-right" color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line },
  flex: { flex: 1 },
  links: { gap: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
}));
