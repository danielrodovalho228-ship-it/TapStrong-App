import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen, TextLink } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { MUSCLES, muscleByKey, muscleFamily } from '@/features/muscles';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { MonthHomeCard } from '@/features/month/components/MonthHomeCard';
import { useMonthStore } from '@/features/month/store';
import { MoreOptions } from '@/features/home/MoreOptions';
import { StartHero } from '@/features/home/StartHero';
import { useMonthClose } from '@/features/month/useMonthClose';
import { SeniorHome } from '@/features/senior/SeniorHome';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { generateBalanceSession, MOBILITY_MINUTES } from '@/features/generator';
import { programStatus } from '@/features/program/apply';
import { dayName, sessionSummary } from '@/features/program/block';
import { WeekStrip } from '@/features/program/components/WeekStrip';
import { useTrainingDaysPerWeek } from '@/features/program/useTrainingDays';
import { plannedDaysBetween } from '@/features/program/week';
import { useProgramStore } from '@/features/program/store';
import { morningCheckOpen, pendingMorningChecks } from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import {
  createBalanceWorkout,
  createMobilityWorkout,
  createWorkoutFrom,
  refreshWorkout,
  useBodyStates,
  useExerciseLibrary,
  useGeneratorInput,
} from '@/features/workout/hooks';
import type { RecoveryState } from '@/features/workout/recovery';
import { sessionTargets, todaySession } from '@/features/workout/plan';
import { beginWorkout } from '@/features/workout/start';
import { useWorkoutStore } from '@/features/workout/store';
import { easyDayKey, todayState } from '@/features/workout/secondWorkout';
import { showStreakHint, streakToday } from '@/features/workout/streak';
import { canStartWorkout, currentPlan, FREE_WORKOUTS_PER_WEEK } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, spacing, useColors } from '@/theme';
import { listText } from '@/lib/listText';

const LEGEND: Exclude<RecoveryState, 'neutral'>[] = ['fresh', 'recovering', 'almost', 'neglected'];

/** Mockup 07 — home: today's workout, streak, recovery map (SPEC §9). */
export default function HomeScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  // The block closed: summary + next month, once (Phase 26).
  useMonthClose(input, library);
  const { workouts, streak, nextFocus } = useWorkoutStore();
  const { states, activity } = useBodyStates();
  const member = useFamilyStore(activeProfile);
  const painReports = useMovementPainStore((st) => st.reports);
  const [resting, setResting] = useState(false);
  const [extraAsked, setExtraAsked] = useState(false);
  const programState = useProgramStore();
  const trainingDays = useTrainingDaysPerWeek();
  const entitlement = useBillingStore((st) => st.entitlement);
  if (!profile.onboardingComplete || !derived) return <Redirect href="/welcome" />;

  const now = clock.now();
  const plannedToday =
    plannedDaysBetween(localDate(now), addDays(localDate(now), 1), deviceWeekStart(), trainingDays)
      .length > 0;
  const morning = pendingMorningChecks(painReports).find((c) => morningCheckOpen(c.afterAt, now));
  // Only today's workouts (QA R5-03); older ones are closed on launch.
  const today = localDate(now);
  const sameDay = (w: (typeof workouts)[number]) =>
    localDate(new Date(w.logs.at(-1)?.loggedAt ?? w.startedAt ?? w.createdAt)) === today;
  const active = workouts.find((w) => w.status === 'active' && sameDay(w));
  const planned = workouts.find(
    (w) => w.status === 'planned' && w.kind === 'regular' && sameDay(w),
  );
  // The card names what today's workout really trains (QA D-01): the stored
  // one, or a preview of the one "Start" will build (the generator is
  // deterministic, so it is the same session).
  const built = active || planned ? null : todaySession(input, library, nextFocus);
  const preview = (active ?? planned)?.session ?? (built && !built.error ? built : null);
  // Everything picked is still recovering: say so, and offer mobility, balance
  // or rest instead of a workout Start can't build (QA R3-03).
  // After a sharp pain stop today, only mobility, balance or rest for the
  // rest of the day, never a second full workout (QA R5 P2).
  const { stoppedToday, doneToday, extraAllowed } = todayState({
    workouts,
    now,
    mode: derived.mode,
    entitlement,
  });
  const allRecovering =
    built?.error === 'all_recovering' || built?.error === 'weekly_cap' || stoppedToday;
  // The week's sets are used up: its own words, not "Everything is recovering" (QA R10 P2).
  const weeklyCap = built?.error === 'weekly_cap';
  // Today's workout is done (Daniel, Phase 19): mobility, balance or rest; an
  // adult may still choose an extra workout, after a short warning.
  const easyDay = allRecovering || doneToday;
  // Free plan, weekly workouts used (Daniel, Phase 16): suggest the free short
  // mobility and mention Premium once, instead of a paywall on Start.
  const freeDone =
    !active &&
    !easyDay &&
    currentPlan(entitlement, now) === 'free' &&
    !canStartWorkout('free', workouts, now, deviceWeekStart()).allowed;
  // Short balance next to short mobility for 60+, a balance goal or a fall (QA R5 P2).
  const balanceUser =
    derived.mode === 'senior' ||
    profile.conditions.includes('fell_last_year') ||
    profile.mainGoals.includes('balance');
  const goals = (preview ? sessionTargets(preview) : []).map((m) => muscleLabel(t, m));
  // The session's own length, not the profile setting (QA round 2).
  const cardMinutes = preview?.estimatedMinutes || profile.minutes || 30;
  const program = programStatus(programState, workouts, localDate(now), derived.mode);
  const summary = preview ? sessionSummary(preview, derived.mode, profile.weightKg) : null;
  const openMobility = () => {
    const id = createMobilityWorkout(input);
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };
  // Short balance is offered only when one can be built (QA R6-07): never a
  // button that leads to "unavailable".
  const balanceOk = !!input && !generateBalanceSession(input).error;
  const openBalance = () => {
    const id = createBalanceWorkout(input);
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

  // One tap from Home to the player (Phase 27, A2). The preview stays one
  // small link away ("See workout"). The first workout of a new month opens
  // the preview instead, so "Renewed N exercises · Undo" is seen before the
  // workout starts (Phase 26).
  const trainNow = () => {
    const existing = active ?? planned;
    const noticeBefore = useMonthStore.getState().autoNotice;
    const id = existing
      ? refreshWorkout(existing.id, input, library)
      : createWorkoutFrom(input, library);
    if (!existing && id) track('workout_generated', { mode: derived.mode });
    if (!id || useMonthStore.getState().autoNotice !== noticeBefore) {
      router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
      return;
    }
    const begun = beginWorkout(id);
    if (!begun.ok) {
      router.push({ pathname: '/paywall', params: { next: begun.nextFreeDay } });
      return;
    }
    router.push({ pathname: '/workout/[id]/play', params: { id } });
  };

  // Labels name the state, not an elapsed time (QA round 2): a secondary muscle
  // worked minutes ago reads "recovering", never "1–2 days ago". Grey-blue
  // splits into "not trained yet" and "time to train" (QA P2).
  // A muscle counts as trained when it, its parent or a sibling was (QA R3:
  // mid chest isn't "not trained yet" after a chest workout).
  const touched = (key: string) =>
    !!activity[key]?.lastPrimaryAt || !!activity[key]?.lastSecondaryAt;
  const never = (key: string) => {
    const parent = muscleByKey(key)?.parentKey ?? key;
    return ![parent, ...muscleFamily(parent), key].some(touched);
  };
  // Today's targets and the chosen muscles lead each line, then anatomy order (QA R3).
  const lead = [
    ...(preview ? sessionTargets(preview, 10) : []),
    ...profile.muscleGoals.map((g) => g.muscleKey),
  ];
  const rank = (key: string) => {
    const i = lead.findIndex((k) => k === key || muscleByKey(key)?.parentKey === k);
    return i < 0 ? lead.length : i;
  };
  const byState = (state: RecoveryState, neverTrained?: boolean) =>
    MUSCLES.filter(
      (m) =>
        m.views.length &&
        states[m.key] === state &&
        (neverTrained === undefined || never(m.key) === neverTrained),
    )
      .map((m, order) => ({ m, order }))
      .sort((a, b) => rank(a.m.key) - rank(b.m.key) || a.order - b.order)
      .map(({ m }) => m)
      .slice(0, 3)
      .map((m) => muscleLabel(t, m.key));
  const legend = [
    ...LEGEND.filter((s) => s !== 'neglected').map((s) => ({
      state: s as RecoveryState,
      key: s,
      muscles: byState(s),
    })),
    { state: 'neglected' as const, key: 'neglected', muscles: byState('neglected', false) },
    { state: 'neglected' as const, key: 'never', muscles: byState('neglected', true) },
  ].filter((l) => l.muscles.length);
  const trainedAny = legend.some((l) => l.state !== 'neglected');

  if (derived.mode === 'senior')
    return (
      <SeniorHome
        onStart={trainNow}
        onPreview={openWorkout}
        onMobility={openMobility}
        onBalance={balanceOk ? openBalance : undefined}
        targets={goals}
        minutes={cardMinutes}
        allRecovering={easyDay}
        weeklyCap={weeklyCap}
        stoppedToday={stoppedToday}
        doneToday={doneToday}
      />
    );

  const easyKey = easyDayKey({ stoppedToday, doneToday, weeklyCap });
  const heroDetail = [
    goals.length ? listText(goals, t('common.and')) : t('home.fullBody'),
    t('home.minutesShort', { minutes: cardMinutes }),
  ].join(' · ');
  const eyebrow = active
    ? t('home.inProgress')
    : [
        t(`program.block.${program.block.phase}`, {
          week: program.block.week,
          of: program.block.of,
        }),
        preview ? t(`program.day.${dayName(preview, library)}`) : null,
      ]
        .filter(Boolean)
        .join(' · ');

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
          <AppText variant="h1" style={styles.num}>
            {streakToday(streak, localDate(now), deviceWeekStart())}
          </AppText>
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

      {/* The one action, at the top (Phase 27, A2); nothing above it. */}
      {easyDay ? (
        <View style={styles.today} testID={doneToday ? 'done-today' : undefined}>
          <AppText variant="h2" accessibilityRole="header">
            {t(`home.${easyKey}Title`)}
          </AppText>
          <AppText color={colors.mutedStrong}>{t(`home.${easyKey}Body`)}</AppText>
          <StartHero
            eyebrow={t('home.picked')}
            title={t('home.mobilityTitle')}
            detail={t('home.minutesShort', { minutes: MOBILITY_MINUTES })}
            onPress={openMobility}
          />
          <View style={styles.links}>
            <TextLink label={t('home.rest')} onPress={() => setResting(true)} />
          </View>
          {resting ? (
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('home.restNote')}
            </AppText>
          ) : null}
        </View>
      ) : freeDone ? (
        <View style={styles.today} testID="free-done">
          <AppText variant="h2" accessibilityRole="header">
            {t('home.freeDoneTitle', { count: FREE_WORKOUTS_PER_WEEK })}
          </AppText>
          <AppText color={colors.mutedStrong}>{t('home.freeDoneBody')}</AppText>
          <StartHero
            title={t('home.mobilityTitle')}
            detail={t('home.minutesShort', { minutes: MOBILITY_MINUTES })}
            onPress={openMobility}
          />
          <View style={styles.links}>
            <TextLink label={t('home.freeDonePremium')} onPress={() => router.push('/plans')} />
          </View>
        </View>
      ) : (
        <View style={styles.today}>
          <StartHero
            eyebrow={eyebrow}
            title={active ? t('home.continue') : t('home.trainNow')}
            detail={heroDetail}
            onPress={trainNow}
          />
          {/* "6 exercises · 45 min" (+ kcal for adults only, never teens). */}
          {summary ? (
            <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
              {[
                t('program.summary', { count: summary.exercises, minutes: summary.minutes }),
                summary.kcal ? t('program.kcal', { kcal: summary.kcal }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          ) : null}
          <View style={styles.links}>
            <TextLink label={t('home.seeWorkout')} onPress={openWorkout} />
          </View>
        </View>
      )}

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

      <WeekStrip />

      {/* Less common choices, collapsed (Phase 27, A3). Short mobility stays
          free and counts for the streak (decision 1, QA round 2). */}
      <MoreOptions>
        {!easyDay && !freeDone && !active ? (
          <Button
            variant="secondary"
            label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
            onPress={openMobility}
          />
        ) : null}
        {balanceOk && (easyDay || balanceUser) ? (
          <Button
            variant="secondary"
            label={t('home.balance', { minutes: MOBILITY_MINUTES })}
            onPress={openBalance}
          />
        ) : null}
        {!easyDay && !freeDone ? (
          <Button
            variant="secondary"
            label={t('home.pickElse')}
            onPress={() => router.push('/workout/new')}
          />
        ) : null}
        {easyDay && extraAllowed ? (
          extraAsked ? (
            <>
              <AppText variant="caption" color={colors.mutedStrong} testID="extra-warning">
                {t('home.extraWarning')}
              </AppText>
              <Button variant="secondary" label={t('home.extraStart')} onPress={openWorkout} />
            </>
          ) : (
            <Button
              variant="secondary"
              label={t('home.extra')}
              onPress={() => setExtraAsked(true)}
            />
          )
        ) : null}
        <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
          {t('home.mobilityNote')}
        </AppText>
      </MoreOptions>
      {!active && !easyDay && !freeDone && showStreakHint(streak, localDate(now), plannedToday) ? (
        <AppText color={colors.teal} style={styles.center} testID="streak-hint">
          {t('home.streakHint')}
        </AppText>
      ) : null}

      {/* The month's summary replaces the 4-week check-in card (Phase 26). */}
      <MonthHomeCard onStart={trainNow} />

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
                // Plural agreement with the list (QA R3: "ainda não treinados").
                label={t(`home.recovery.${l.key as 'never'}`, {
                  muscles: l.muscles.join(', '),
                  count: l.muscles.length,
                })}
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

const useStyles = makeStyles(() => ({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: { alignItems: 'flex-end' },
  today: { gap: spacing.md },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md },
  num: { fontVariant: ['tabular-nums'] },
  recovery: { gap: spacing.md },
  legend: { gap: spacing.sm },
  center: { textAlign: 'center' },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.tealTint,
  },
}));
