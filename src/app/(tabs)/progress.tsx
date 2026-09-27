import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  Chip,
  Icon,
  Screen,
  TextLink,
  ToggleRow,
  type IconName,
} from '@/components/ui';
import { MovementPainEntry } from '@/features/movement/Entry';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
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
import { colors, fonts, radius, sizes, spacing } from '@/theme';

/** Mockup 18 — progress (SPEC §9 /(tabs)/progress). */
export default function ProgressScreen() {
  const { t } = useTranslation();
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
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

  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        {t('progress.title')}
      </AppText>
      <View style={styles.stats}>
        <Stat
          label={t('progress.streak')}
          value={t('progress.days', {
            count: streakToday(streak, localDate(now), deviceWeekStart()),
          })}
        />
        <Stat label={t('progress.workouts')} value={String(count)} />
        <Stat label={t('progress.sets')} value={String(sets)} />
      </View>

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
          <AppText color={colors.mutedStrong}>{t('progress.chart.empty')}</AppText>
        )}
      </Card>

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
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color={colors.muted} style={styles.caps}>
        {label}
      </AppText>
      <AppText variant="h1">{value}</AppText>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, styles.line]}>
      <AppText style={styles.flex}>{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
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

const styles = StyleSheet.create({
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
});
