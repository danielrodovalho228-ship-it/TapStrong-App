import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen, TextLink } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { MUSCLES } from '@/features/muscles';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { checkinDue } from '@/features/progress/checkin';
import { useProgressStore } from '@/features/progress/store';
import { SeniorHome } from '@/features/senior/SeniorHome';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { MOBILITY_MINUTES } from '@/features/generator';
import { morningCheckOpen, pendingMorningChecks } from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import {
  createMobilityWorkout,
  createWorkoutFrom,
  refreshWorkout,
  useBodyStates,
  useExerciseLibrary,
  useGeneratorInput,
} from '@/features/workout/hooks';
import type { RecoveryState } from '@/features/workout/recovery';
import { previewSession, sessionTargets } from '@/features/workout/plan';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, spacing } from '@/theme';

const LEGEND: Exclude<RecoveryState, 'neutral'>[] = ['fresh', 'recovering', 'almost', 'neglected'];

/** Mockup 07 — home: today's workout, streak, recovery map (SPEC §9). */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const { workouts, streak, nextFocus } = useWorkoutStore();
  const { states, activity } = useBodyStates();
  const member = useFamilyStore(activeProfile);
  const checkins = useProgressStore((st) => st.checkins);
  const painReports = useMovementPainStore((st) => st.reports);
  if (!profile.onboardingComplete || !derived) return <Redirect href="/welcome" />;

  const now = clock.now();
  const morning = pendingMorningChecks(painReports).find((c) => morningCheckOpen(c.afterAt, now));
  const active = workouts.find((w) => w.status === 'active');
  const planned = workouts.find((w) => w.status === 'planned' && w.kind === 'regular');
  // The card names what today's workout really trains (QA D-01): the stored
  // one, or a preview of the one "Start" will build (the generator is
  // deterministic, so it is the same session).
  const preview = (active ?? planned)?.session ?? previewSession(input, library, nextFocus);
  const goals = (preview ? sessionTargets(preview) : []).map((m) => muscleLabel(t, m));
  // The session's own length, not the profile setting (QA round 2).
  const cardMinutes = preview?.estimatedMinutes || profile.minutes || 30;
  const openMobility = () => {
    const id = createMobilityWorkout(input);
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };
  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');

  const openWorkout = () => {
    const existing = active ?? planned;
    if (existing) {
      // Restrictions or pain reports may have changed since it was built (QA A-01).
      const openId = refreshWorkout(existing.id, input, library);
      router.push({ pathname: '/workout/[id]', params: { id: openId ?? 'unavailable' } });
      return;
    }
    const id = createWorkoutFrom(input, library);
    if (id) track('workout_generated', { mode: derived.mode });
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };

  // Labels name the state, not an elapsed time (QA round 2): a secondary muscle
  // worked minutes ago reads "recovering", never "1–2 days ago". Grey-blue
  // splits into "not trained yet" and "time to train" (QA P2).
  const never = (key: string) => !activity[key]?.lastPrimaryAt && !activity[key]?.lastSecondaryAt;
  const byState = (state: RecoveryState, neverTrained?: boolean) =>
    MUSCLES.filter(
      (m) =>
        m.views.length &&
        states[m.key] === state &&
        (neverTrained === undefined || never(m.key) === neverTrained),
    )
      .slice(0, 3)
      .map((m) => muscleLabel(t, m.key))
      .join(', ');
  const legend = [
    ...LEGEND.filter((s) => s !== 'neglected').map((s) => ({
      state: s as RecoveryState,
      key: s,
      muscles: byState(s),
    })),
    { state: 'neglected' as const, key: 'neglected', muscles: byState('neglected', false) },
    { state: 'neglected' as const, key: 'never', muscles: byState('neglected', true) },
  ].filter((l) => l.muscles);
  const trainedAny = legend.some((l) => l.state !== 'neglected');

  if (derived.mode === 'senior') return <SeniorHome onStart={openWorkout} targets={goals} />;

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.muted} style={styles.caps}>
            {now.toLocaleDateString(i18n.language, { weekday: 'long' })}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {t('home.title')}
          </AppText>
          {member && member.kind !== 'self' ? (
            <AppText variant="caption" color={colors.teal} style={styles.caps}>
              {t('home.trainingAs', { name: member.name ?? t('family.member') })}
            </AppText>
          ) : null}
        </View>
        <View style={styles.streak}>
          <AppText variant="h1">{streakToday(streak, localDate(now), deviceWeekStart())}</AppText>
          <AppText variant="caption" color={colors.muted} style={styles.caps}>
            {t('home.dayStreak', { count: streakToday(streak, localDate(now), deviceWeekStart()) })}
          </AppText>
          {streak.freezes > 0 ? (
            <AppText variant="caption" color={colors.teal}>
              {t('home.freezes', { count: streak.freezes })}
            </AppText>
          ) : null}
        </View>
      </View>

      <Card tone="dark" style={styles.today}>
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {active ? t('home.inProgress') : t('home.picked')}
        </AppText>
        <AppText variant="h1" color={colors.dark.text}>
          {goals.length ? goals.join(' & ') : t('home.fullBody')}
        </AppText>
        <AppText color={colors.dark.text}>{t('home.withWarmup', { minutes: cardMinutes })}</AppText>
        <Button
          variant="accent"
          label={active ? t('home.continue') : t('home.start', { minutes: cardMinutes })}
          onPress={openWorkout}
        />
        <Button variant="onDark" label={t('home.pickElse')} onPress={() => router.push('/body')} />
      </Card>

      {/* Short mobility (decision 1, QA round 2): always free, counts for the streak. */}
      {!active ? (
        <View style={styles.mobility}>
          <Button
            variant="secondary"
            label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
            onPress={openMobility}
          />
          <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
            {t('home.mobilityNote')}
          </AppText>
        </View>
      ) : null}

      {morning ? (
        // Morning check after a recovery session, right on Home (QA round 2).
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.morningCheck')}
          onPress={() =>
            router.push({ pathname: '/movement-pain/[id]', params: { id: morning.reportId } })
          }
          style={styles.checkin}
        >
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={colors.teal}>
              {t('home.morningCheck')}
            </AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('home.morningCheckBody')}
            </AppText>
          </View>
          <Icon name="chevron-right" color={colors.teal} />
        </Pressable>
      ) : null}

      {checkinDue(workouts, checkins, now) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.checkinReady')}
          onPress={() => router.push('/checkin')}
          style={styles.checkin}
        >
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={colors.teal}>
              {t('home.checkinReady')}
            </AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('home.checkinBody')}
            </AppText>
          </View>
          <Icon name="chevron-right" color={colors.teal} />
        </Pressable>
      ) : null}

      {/* The body takes the full card width; the legend sits below it (QA O-1b). */}
      <Card style={styles.recovery}>
        <AppText variant="h3">{t('home.recoveryMap')}</AppText>
        <RecoveryBody band={band} sex={sex} states={states} />
        <View style={styles.legend}>
          {legend.length ? (
            legend.map((l) => (
              <LegendRow
                key={l.key}
                color={STATE_COLOR[l.state as Exclude<RecoveryState, 'neutral'>]}
                label={t(`home.recovery.${l.key as 'never'}`, { muscles: l.muscles })}
              />
            ))
          ) : (
            <AppText color={colors.mutedStrong}>{t('home.recoveryEmpty')}</AppText>
          )}
          {trainedAny ? <LegendRow label={t('home.recovery.ready')} /> : null}
          <AppText variant="caption" color={colors.muted}>
            {t('home.recoveryNote')}
          </AppText>
          <TextLink tone="accent" label={t('home.openBody')} onPress={() => router.push('/body')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: { alignItems: 'flex-end' },
  today: { gap: spacing.md, padding: spacing.xl },
  recovery: { gap: spacing.md },
  legend: { gap: spacing.sm },
  mobility: { gap: spacing.xs },
  center: { textAlign: 'center' },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.tealTint,
  },
});
