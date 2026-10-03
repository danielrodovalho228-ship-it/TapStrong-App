import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Button, Icon, IconButton, Screen, TextLink } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { MomentCard } from '@/features/moments/MomentCard';
import { useMoment } from '@/features/moments/useMoment';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { MonthHomeCard } from '@/features/month/components/MonthHomeCard';
import { useMonthStore } from '@/features/month/store';
import { identityKey, workoutsThisWeekDone } from '@/features/home/identity';
import { MoreOptions } from '@/features/home/MoreOptions';
import { StartHero } from '@/features/home/StartHero';
import { useMonthClose } from '@/features/month/useMonthClose';
import { SeniorHome } from '@/features/senior/SeniorHome';
import { muscleLabel } from '@/features/onboarding/summaries';
import { generateBalanceSession, MOBILITY_MINUTES } from '@/features/generator';
import { programStatus } from '@/features/program/apply';
import { dayName } from '@/features/program/block';
import { CareHomeCards } from '@/features/rehab/CareHomeCard';
import { ExerciseCard, PhaseCard } from '@/features/plan/PlanCards';
import { usePrefsStore } from '@/features/settings/store';
import { openShare } from '@/features/share/open';
import type { SessionItem } from '@/features/generator/types';
import { SwapSheet } from '@/features/workout/components/SwapSheet';
import { doseText, exerciseName } from '@/features/workout/format';
import { adviceForItem, loadText } from '@/features/workout/loads';
import { workoutInput } from '@/features/workout/safety';
import type { LoadUnit } from '@/features/workout/types';
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
  useExerciseLibrary,
  useGeneratorInput,
} from '@/features/workout/hooks';
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

/** Mockup 07 — home: today's workout, streak, recovery map (SPEC §9). */
export default function HomeScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const planView = usePrefsStore((s) => s.planView);
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  // The block closed: summary + next month, once (Phase 26).
  useMonthClose(input, library);
  const { workouts, streak, nextFocus } = useWorkoutStore();
  const member = useFamilyStore(activeProfile);
  const painReports = useMovementPainStore((st) => st.reports);
  const [resting, setResting] = useState(false);
  const [extraAsked, setExtraAsked] = useState(false);
  // The swap sheet on the plan (Phase 31, C): which item, in which stored workout.
  const [sheet, setSheet] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const programState = useProgramStore();
  const trainingDays = useTrainingDaysPerWeek();
  const entitlement = useBillingStore((st) => st.entitlement);
  // Date Moments (birthday month, 1 month / 1 year of app), below the button (Phase 27, C).
  const moment = useMoment('home');
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
  const byId = new Map(library.map((e) => [e.id, e]));
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

  // Swap right on the plan (Phase 31, C): the workout is stored first, so
  // the swap is kept; the number of exercises never grows.
  const sheetWorkout = sheetId ? workouts.find((w) => w.id === sheetId) : undefined;
  const openSwap = (itemId: string) => {
    const existing = active ?? planned;
    const id = existing ? existing.id : createWorkoutFrom(input, library);
    if (!id) return;
    if (!existing) track('workout_generated', { mode: derived.mode });
    setSheetId(id);
    setSheet(itemId);
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
  const weekDone = workoutsThisWeekDone(workouts, now, deviceWeekStart());
  const identity = identityKey(weekDone);
  // "Week 3/5 · Base" (Phase 31, B): the block's week and phase in coral.
  const eyebrow = active
    ? t('home.inProgress')
    : t(`plan.eyebrow.${program.block.phase}`, {
        week: program.block.week,
        of: program.block.of,
      });
  const split = preview ? t(`program.day.${dayName(preview, library)}`) : null;
  // "5 sets × 10–12 reps × 35 lb": the load for adults only, never minors.
  const minor = derived.mode === 'teen' || derived.mode === 'child';
  const unit: LoadUnit = profile.units === 'imperial' ? 'lb' : 'kg';
  const storedId = (active ?? planned)?.id ?? '';
  const badgeFor = (item: SessionItem) => {
    const e = byId.get(item.exerciseId);
    const reps = item.reps
      ? item.reps[0] === item.reps[1]
        ? `${item.reps[0]}`
        : `${item.reps[0]}–${item.reps[1]}`
      : null;
    const dose = reps ? t('plan.badge', { count: item.sets, reps }) : doseText(t, item);
    if (minor || !item.reps) return dose;
    const load = loadText(
      adviceForItem({
        workouts,
        workoutId: storedId,
        item,
        exercise: e,
        unit,
        generator: { ...input!, deload: preview?.deload },
      }),
      t(`workout.units.${unit}`),
    );
    return load ? t('plan.badgeLoad', { dose, load }) : dose;
  };
  const warm = preview?.items.filter((i) => i.role === 'warmup') ?? [];
  const mains = preview?.items.filter((i) => i.role === 'main' || i.role === 'finisher') ?? [];
  const cool = preview?.items.filter((i) => i.role === 'cooldown') ?? [];
  const phaseMinutes = (items: SessionItem[]) =>
    Math.max(1, Math.round(items.reduce((n, i) => n + i.estSeconds, 0) / 60));
  const shareOk = canShare(member, derived.mode);
  const streakNow = streakToday(streak, localDate(now), deviceWeekStart());
  const startLabel = active ? t('home.continue') : t('plan.start');

  return (
    <Screen
      header={
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('plan.myPlanHint')}
            onPress={() => router.push('/programs')}
            style={styles.planButton}
            testID="plan-switch"
          >
            <AppText variant="h2" accessibilityRole="header">
              {t('plan.myPlan')}
            </AppText>
            <Icon name="chevron-down" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.topIcons}>
            <View
              style={styles.streak}
              accessible
              accessibilityLabel={t('home.dayStreak', { count: streakNow })}
              testID="plan-streak"
            >
              <Icon name="flame" size={20} color={colors.accentText} />
              <AppText variant="bodyStrong" style={styles.num}>
                {streakNow}
              </AppText>
            </View>
            <IconButton
              icon="calendar"
              accessibilityLabel={t('plan.calendar')}
              onPress={() => router.push('/months')}
            />
            <IconButton
              icon="filter"
              accessibilityLabel={t('plan.filters')}
              onPress={() => router.push('/settings/equipment')}
            />
          </View>
        </View>
      }
      footer={
        easyDay ? (
          <Button variant="accent" label={t('plan.stretchNow')} onPress={openMobility} />
        ) : freeDone ? null : (
          <Button variant="accent" label={startLabel} onPress={trainNow} testID="start-hero" />
        )
      }
    >
      {member && member.kind !== 'self' ? (
        <AppText variant="caption" color={colors.teal} style={styles.caps}>
          {t('home.trainingAs', { name: member.name ?? t('family.member') })}
        </AppText>
      ) : null}
      {/* The week on top (Phase 29, B2): today marked, a dot on trained days,
          tap a day for that day's workout. */}
      <WeekStrip />
      {easyDay ? (
        // Rest day (Phase 31, B): a short stretch is recommended.
        <View style={styles.rest} testID={doneToday ? 'done-today' : 'rest-day'}>
          <Icon name="clock" size={40} color={colors.accentText} />
          <AppText variant="h2" style={styles.restTitle} accessibilityRole="header">
            {t(`home.${easyKey}Title`)}
          </AppText>
          <AppText color={colors.mutedStrong} style={styles.center}>
            {t(`home.${easyKey}Body`)}
          </AppText>
          <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
            {t('plan.restBody')}
          </AppText>
          <View style={styles.links}>
            <TextLink label={t('home.rest')} onPress={() => setResting(true)} />
          </View>
          {resting ? (
            <AppText variant="caption" color={colors.mutedStrong} style={styles.center}>
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
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <AppText variant="caption" color={colors.accentText} style={styles.caps}>
                {eyebrow}
              </AppText>
              <AppText variant="h1" style={styles.upper} accessibilityRole="header">
                {t('plan.today')}
              </AppText>
              {split ? <AppText variant="h3">{split}</AppText> : null}
            </View>
            <IconButton
              icon="edit"
              accessibilityLabel={t('plan.edit')}
              onPress={openWorkout}
              testID="plan-edit"
            />
          </View>
          {preview ? (
            <View style={styles.summaryRow}>
              <AppText variant="label" color={colors.mutedStrong} testID="plan-summary">
                {t('program.summary', {
                  count: mains.length,
                  minutes: cardMinutes,
                })}
              </AppText>
              {shareOk ? (
                <IconButton
                  icon="share"
                  accessibilityLabel={t('plan.share')}
                  onPress={() => openShare({ template: 'week' })}
                />
              ) : null}
            </View>
          ) : null}
          {warm.length ? (
            <PhaseCard
              exercise={byId.get(warm[0].exerciseId)}
              title={t('plan.warmup')}
              detail={t('home.minutesShort', { minutes: phaseMinutes(warm) })}
              onOpen={openWorkout}
              testID="plan-warmup"
            />
          ) : null}
          {mains.map((item) => {
            const e = byId.get(item.exerciseId);
            // Settings → Workout tab display: a compact list (Phase 31, F).
            if (planView === 'list')
              return (
                <PhaseCard
                  key={item.id}
                  exercise={e}
                  title={exerciseName(t, e, item.exerciseId)}
                  detail={badgeFor(item)}
                  onSwap={() => openSwap(item.id)}
                  testID="plan-row"
                />
              );
            return (
              <ExerciseCard
                key={item.id}
                exercise={e}
                name={exerciseName(t, e, item.exerciseId)}
                badge={badgeFor(item)}
                band={band}
                onSwap={() => openSwap(item.id)}
              />
            );
          })}
          {cool.length ? (
            <PhaseCard
              exercise={byId.get(cool[0].exerciseId)}
              title={t('plan.cooldown')}
              detail={t('home.minutesShort', { minutes: phaseMinutes(cool) })}
              onOpen={openWorkout}
              testID="plan-cooldown"
            />
          ) : null}
        </View>
      )}

      {/* "Shoulder today" next to today's workout (Phase 30 addendum §6.1). */}
      <CareHomeCards />

      {moment ? (
        <MomentCard
          moment={moment}
          band={band}
          sex={sex}
          canShare={canShare(member, derived.mode)}
        />
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

      {identity ? (
        // Identity, not guilt (Phase 27, B4).
        <AppText color={colors.teal} style={styles.center} testID="home-identity">
          {t(identity, { count: weekDone })}
        </AppText>
      ) : null}

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

      {sheet && sheetWorkout && input ? (
        <SwapSheet
          visible
          workout={sheetWorkout}
          itemId={sheet}
          reason="user_choice"
          input={workoutInput(sheetWorkout, input)}
          byId={byId}
          onPickItem={(itemId) => setSheet(itemId)}
          onClose={() => setSheet(null)}
          onSwapped={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  planButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 44 },
  topIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  upper: { textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rest: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  restTitle: { textTransform: 'uppercase', textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  today: { gap: spacing.md },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md },
  num: { fontVariant: ['tabular-nums'] },
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
