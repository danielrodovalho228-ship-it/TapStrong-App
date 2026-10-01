import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { AppText, Button, Card, Icon, Notice, Screen } from '@/components/ui';
import { MomentCard } from '@/features/moments/MomentCard';
import { openShare } from '@/features/share/open';
import { useScreenshotOffer } from '@/features/share/screenshot';
import { useMoment } from '@/features/moments/useMoment';
import { RatePainButtons } from '@/features/movement/Entry';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { useAccountStore } from '@/features/account/store';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { generateSession } from '@/features/generator';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LightUpBody } from '@/features/workout/components/LightUpBody';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { feel } from '@/features/workout/feel';
import { lightOrder, workedMuscles } from '@/features/workout/lightOrder';
import { mainSetCounts } from '@/features/workout/flow';
import { useWorkout } from '@/features/workout/hooks';
import { stoppedForPain } from '@/features/workout/safety';
import { finisherInput, sessionTargets } from '@/features/workout/plan';
import {
  bodyStates,
  groupMuscles,
  muscleActivity,
  neglectedGroup,
} from '@/features/workout/recovery';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { bodyMapColors, colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

/** Mockup 14 — done: the body turns red, stats, a finisher suggestion. */
export default function DoneScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, library, input } = useWorkout(id);
  const profile = useOnboardingStore();
  const { workouts, streak, create, setNextFocus } = useWorkoutStore();
  const account = useAccountStore();
  const member = useFamilyStore(activeProfile);
  const [focusSaved, setFocusSaved] = useState(false);
  // A short chord at the end, if turned on (Phase 27, B2; off by default).
  const endedOk = workout?.status === 'done';
  // A Moment, now and then (Phase 27, C): only here or on Home.
  const moment = useMoment('done', workout);
  // A screenshot here offers this workout's card (Phase 28, C).
  useScreenshotOffer(workout ? { template: 'workout', workout: workout.id } : null);
  useEffect(() => {
    if (endedOk) feel.finish();
  }, [endedOk]);
  const { width } = useWindowDimensions();
  const derived = derive(profile);
  if (!workout || !derived) return <Redirect href="/home" />;

  const now = clock.now();
  // Narrow phones and 60+ large type: the footer buttons stack (QA R7 P2).
  const stackFooter = width < 360 || derived.mode === 'senior';
  // Stopped for sharp pain: calm copy, no finisher, no new workout (QA C-01).
  const stopped = stoppedForPain(workout);
  // Short mobility is not "Workout n" (QA R3-05).
  const mobility = workout.kind === 'mobility';
  const balance = workout.session.focus === 'balance';
  const finished = workouts.filter(
    (w) => (w.status === 'done' || w.status === 'partial') && w.kind !== 'mobility',
  );
  const number = finished.findIndex((w) => w.id === workout.id) + 1 || finished.length;
  const activity = muscleActivity(workouts, library, now);
  const group = neglectedGroup(activity, library, now);
  const groupList = group ? groupMuscles(group, library) : [];
  const groupNeverTrained = groupList.every((k) => !activity[k]?.lastPrimaryAt);
  const states = bodyStates(activity, now, derived.mode, [
    ...profile.muscleGoals.map((g) => g.muscleKey),
    ...groupList,
  ]);

  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');

  const minutes = Math.max(
    1,
    Math.round(
      (Date.parse(workout.endedAt ?? now.toISOString()) -
        Date.parse(workout.startedAt ?? workout.createdAt)) /
        60000,
    ),
  );
  const { done: sets } = mainSetCounts(workout);
  const worked = workedMuscles(workout, library);
  const lit = lightOrder(workout, library).filter(
    (k) => worked.primary.includes(k) || worked.secondary.includes(k),
  );
  const perMuscle = new Map<string, number>();
  for (const log of workout.logs) {
    const item = workout.session.items.find((i) => i.id === log.itemId);
    if (item?.role === 'main' && item.targetMuscle) {
      perMuscle.set(item.targetMuscle, (perMuscle.get(item.targetMuscle) ?? 0) + 1);
    }
  }
  // Ties go to the session's own target order, not the alphabet (QA R3).
  const order = sessionTargets(workout.session, 20);
  const at = (m: string) => (order.indexOf(m) < 0 ? order.length : order.indexOf(m));
  const top = [...perMuscle.entries()].sort((a, b) => b[1] - a[1] || at(a[0]) - at(b[0]))[0];

  const addTen = () => {
    if (!input || !group) return;
    const session = generateSession(finisherInput(input, group, library));
    if (session.error) return;
    const newId = create(session, 'finisher');
    router.replace({ pathname: '/workout/[id]', params: { id: newId } });
  };

  const goHome = () => {
    router.dismissAll();
    router.replace('/home');
  };

  return (
    <Screen
      footer={
        <>
          <View style={[styles.row, stackFooter && styles.column]}>
            {member?.kind === 'child' && !member.shareAllowed && derived.mode !== 'child' ? (
              <AppText variant="caption" color={colors.mutedStrong} style={styles.flex}>
                {t('share.teenOff')}
              </AppText>
            ) : null}
            {canShare(member, derived.mode) ? (
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  label={t('workout.done.share')}
                  onPress={() => openShare({ template: 'workout', workout: workout?.id })}
                />
              </View>
            ) : null}
            {!account.saved && derived.mode !== 'child' ? (
              <View style={styles.flex}>
                <Button
                  label={t('workout.done.save')}
                  onPress={() => router.push({ pathname: '/account', params: { from: 'done' } })}
                />
              </View>
            ) : null}
          </View>
          <Button
            variant={account.saved || derived.mode === 'child' ? 'primary' : 'ghost'}
            label={t('workout.done.home')}
            onPress={goHome}
          />
        </>
      }
    >
      <RatePainButtons workoutId={workout.id} />
      {account.milestone?.workoutId === workout.id ? (
        <Card tone="dark" style={styles.finish}>
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
            {t('milestone.eyebrow')}
          </AppText>
          <AppText variant="h2" color={colors.dark.text}>
            {t('milestone.title', { count: account.milestone.streak })}
          </AppText>
          <Button
            variant="onDark"
            label={t('workout.done.seeMilestone')}
            onPress={() => router.push('/milestone')}
          />
        </Card>
      ) : null}
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
            {stopped
              ? t('workout.done.stoppedEyebrow')
              : mobility
                ? t(balance ? 'workout.done.balanceEyebrow' : 'workout.done.mobilityEyebrow')
                : t('workout.done.eyebrow', { n: number })}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {stopped
              ? t('workout.done.stoppedTitle')
              : mobility
                ? t(balance ? 'workout.done.balanceTitle' : 'workout.done.mobilityTitle')
                : number === 1
                  ? t('workout.done.firstTitle')
                  : t('workout.done.title')}
          </AppText>
        </View>
        <View style={styles.streak}>
          <View style={styles.flame}>
            <Icon name="flame" size={18} color={colors.onAccent} />
          </View>
          <AppText variant="button" color={colors.onInk}>
            {t('workout.done.streak', {
              count: streakToday(streak, localDate(now), deviceWeekStart()),
            })}
          </AppText>
        </View>
      </View>

      {/* Full-width body, legend below (QA O-1b). */}
      {stopped || !lit.length ? (
        <View style={styles.bodyRow}>
          <AppText variant="h3">{t('workout.bodyNow')}</AppText>
          <RecoveryBody band={band} sex={sex} states={states} />
          <View style={styles.legend}>
            <LegendRow color={STATE_COLOR.fresh} label={t('workout.legend.main')} />
            <LegendRow color={STATE_COLOR.recovering} label={t('workout.legend.also')} />
            <LegendRow color={STATE_COLOR.neglected} label={t('workout.legend.notYet')} />
            <LegendRow label={t('home.recovery.ready')} />
            <AppText variant="caption" color={colors.muted}>
              {t(derived.mode === 'senior' ? 'workout.legend.fadeSenior' : 'workout.legend.fade')}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={styles.bodyRow}>
          <AppText variant="h3">{t('workout.worked')}</AppText>
          {/* The muscles worked light up one by one (Phase 27, B1), as painted
              areas, front and back side by side (Phase 29, A4). */}
          <LightUpBody
            band={band}
            sex={sex}
            primary={worked.primary}
            secondary={worked.secondary}
            order={lit}
            minutes={minutes}
            senior={derived.mode === 'senior'}
          />
          <View style={styles.legend}>
            <LegendRow color={bodyMapColors.areaPrimary} label={t('workout.legend.main')} />
            <LegendRow color={bodyMapColors.areaSecondary} label={t('workout.legend.also')} />
          </View>
        </View>
      )}

      {/* Narrow or 60+: the tiles wrap 2 + 1, so no value breaks mid-word (QA R8 P2). */}
      <View style={[styles.stats, stackFooter && styles.statsWrap]}>
        <Stat
          wide={stackFooter}
          value={t('workout.minutes', { value: minutes })}
          label={t('workout.done.time')}
        />
        <Stat wide={stackFooter} value={`${sets}`} label={t('workout.done.sets')} />
        {top ? (
          <Stat
            wide={stackFooter}
            value={t('share.sets', { count: top[1] })}
            label={muscleLabel(t, top[0])}
          />
        ) : null}
      </View>

      {moment && !stopped ? (
        <MomentCard
          moment={moment}
          band={band}
          sex={sex}
          canShare={canShare(member, derived.mode)}
        />
      ) : null}

      {stopped ? <Notice tone="warning">{t('workout.done.stoppedBody')}</Notice> : null}
      {/* Never after the very first workout: they just started (Phase 29, A4). */}
      {group && input && !stopped && number > 1 ? (
        <Card tone="dark" style={styles.finish}>
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
            {t('workout.finish.eyebrow')}
          </AppText>
          <AppText color={colors.dark.text}>
            {t(groupNeverTrained ? 'workout.finish.never' : 'workout.finish.stale', {
              group: t(`workout.finish.groups.${group}`),
            })}
          </AppText>
          {focusSaved ? (
            <AppText variant="bodyStrong" color={colors.dark.accentSoft}>
              {t('workout.finish.saved', { group: t(`workout.finish.groups.${group}`) })}
            </AppText>
          ) : (
            // Stacks like the footer when narrow or 60+ (QA R8 P2). 60+ never
            // get "Add 10 min" after the day's workout (Daniel, Phase 19).
            <View style={[styles.row, stackFooter && styles.column]}>
              {derived.mode !== 'senior' ? (
                <View style={stackFooter ? undefined : styles.flex}>
                  {/* One main button per screen (Phase 27, A3): the footer's. */}
                  <Button variant="onDark" label={t('workout.finish.addTen')} onPress={addTen} />
                </View>
              ) : null}
              <View style={stackFooter ? undefined : styles.flex}>
                <Button
                  variant="onDark"
                  label={t('workout.finish.nextTime', {
                    group: t(`workout.finish.short.${group}`),
                  })}
                  onPress={() => {
                    setNextFocus(group);
                    setFocusSaved(true);
                  }}
                />
              </View>
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <AppText variant="h2" style={styles.num}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.muted} style={styles.caps} numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // The streak pill drops below the title when the title needs the room:
  // 60+ type broke "WORKOUT" mid-word (QA R6 P2).
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.md },
  headTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 220 },
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
  },
  flame: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyRow: { gap: spacing.md },
  legend: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  statsWrap: { flexWrap: 'wrap' },
  statWide: { flexBasis: '45%', flexGrow: 1 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  finish: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  column: { flexDirection: 'column' },
}));
