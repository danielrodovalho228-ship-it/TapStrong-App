import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Card, Icon, Notice, Screen, TextLink } from '@/components/ui';
import { MomentCard } from '@/features/moments/MomentCard';
import { funComparison, THINGS } from '@/features/share/fun';
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
import { LightUpBody } from '@/features/workout/components/LightUpBody';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { feel } from '@/features/workout/feel';
import { lightOrder, workedMuscles } from '@/features/workout/lightOrder';
import { mainSetCounts } from '@/features/workout/flow';
import { useWorkout } from '@/features/workout/hooks';
import { convertLoad } from '@/features/workout/loads';
import { stoppedForPain } from '@/features/workout/safety';
import { finisherInput } from '@/features/workout/plan';
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
  const [page, setPage] = useState(0);
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
  // Volume (load × reps) for adults only: minors never see load (Phase 31, D).
  const unit = profile.units === 'imperial' ? 'lb' : 'kg';
  const mainIds = new Set(workout.session.items.filter((i) => i.role === 'main').map((i) => i.id));
  const volume = Math.round(
    workout.logs
      .filter((l) => mainIds.has(l.itemId) && l.load)
      .reduce((n, l) => n + convertLoad(l.load!, l.unit ?? unit, unit) * (l.reps ?? 0), 0),
  );
  const worked = workedMuscles(workout, library);
  const lit = lightOrder(workout, library).filter(
    (k) => worked.primary.includes(k) || worked.secondary.includes(k),
  );

  const exercisesDone = workout.session.items.filter(
    (i) => i.role === 'main' && workout.logs.some((l) => l.itemId === i.id),
  ).length;
  // "I lifted the weight of 3 pianos": this workout's load × reps (adults).
  const volumeKg = unit === 'lb' ? volume * 0.45359237 : volume;
  const fun = derived.mode === 'adult' && !stopped ? funComparison(volumeKg) : null;
  const funEmoji = fun ? (THINGS.find((x) => x.key === fun.thing)?.emoji ?? '') : '';
  const cardWidth = width - spacing.xl * 2;

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
  const streakDays = streakToday(streak, localDate(now), deviceWeekStart());

  return (
    <Screen
      header={
        <View style={styles.top}>
          <TextLink label={t('workout.logger.close')} accessibilityRole="button" onPress={goHome} />
          <AppText variant="h3" style={styles.brand}>
            {t('app.name')}
          </AppText>
          {canShare(member, derived.mode) ? (
            <TextLink
              label={t('workout.done.shareShort')}
              accessibilityRole="button"
              onPress={() => openShare({ template: 'workout', workout: workout?.id })}
            />
          ) : (
            <View style={styles.topSpacer} />
          )}
        </View>
      }
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
                  variant="accent"
                  label={t('workout.done.share')}
                  onPress={() => openShare({ template: 'workout', workout: workout?.id })}
                />
              </View>
            ) : null}
            {/* The free-account offer waits for the second workout (Phase 31, D). */}
            {!account.saved && derived.mode !== 'child' && finished.length >= 2 ? (
              <View style={styles.flex}>
                <Button
                  // One main button (Phase 27, A3): Share when it shows.
                  variant={canShare(member, derived.mode) ? 'secondary' : 'primary'}
                  label={t('workout.done.save')}
                  onPress={() => router.push({ pathname: '/account', params: { from: 'done' } })}
                />
              </View>
            ) : null}
          </View>
          <Button
            variant={
              (account.saved || derived.mode === 'child') && !canShare(member, derived.mode)
                ? 'primary'
                : 'ghost'
            }
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
      {/* "Great job!" and three numbers (Phase 31, G): exercises, load lifted
          (adults) or sets, and time. Never calories. */}
      <View style={styles.titleBlock}>
        <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
          {stopped
            ? t('workout.done.stoppedEyebrow')
            : mobility
              ? t(balance ? 'workout.done.balanceEyebrow' : 'workout.done.mobilityEyebrow')
              : t('workout.done.eyebrow', { n: number })}
        </AppText>
        <AppText
          variant="h1"
          color={stopped ? colors.ink : colors.accentText}
          style={styles.greatJob}
          accessibilityRole="header"
        >
          {stopped
            ? t('workout.done.stoppedTitle')
            : mobility
              ? t(balance ? 'workout.done.balanceTitle' : 'workout.done.mobilityTitle')
              : number === 1
                ? t('workout.done.firstTitle')
                : t('workout.done.title')}
        </AppText>
        {/* No "0 days in a row" chip (Phase 31, G). */}
        {streakDays > 0 ? (
          <View style={styles.streak}>
            <View style={styles.flame}>
              <Icon name="flame" size={18} color={colors.onAccent} />
            </View>
            <AppText variant="button" color={colors.onInk}>
              {t('workout.done.streak', { count: streakDays })}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.stats} testID="done-stats">
        <Stat value={`${exercisesDone}`} label={t('workout.done.exercises')} />
        {derived.mode === 'adult' && volume > 0 ? (
          <Stat
            value={`${volume} ${t(`workout.units.${unit}`)}`}
            label={t('workout.logger.volume')}
            divider
          />
        ) : (
          <Stat value={`${sets}`} label={t('workout.done.sets')} divider />
        )}
        <Stat
          value={t('workout.minutes', { value: minutes })}
          label={t('workout.done.time')}
          divider
        />
      </View>

      {/* A carousel of cards to keep or share: the fun comparison (adults
          with loads), the muscles worked. */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, cardWidth)))
        }
        contentContainerStyle={styles.carousel}
        testID="done-carousel"
      >
        {fun ? (
          <View style={[styles.slide, { width: cardWidth }]} testID="done-fun">
            <AppText variant="h3" style={styles.caps}>
              {t('workout.done.funBefore')}
            </AppText>
            <View style={styles.funBand}>
              <AppText variant="h2" color={colors.onAccent} style={styles.caps}>
                {t(`shareCards.things.${fun.thing as 'panda'}`, { count: fun.count })}
              </AppText>
            </View>
            <AppText variant="h3" style={styles.caps}>
              {t('workout.done.funAfter')}
            </AppText>
            <AppText style={styles.funEmoji}>{funEmoji}</AppText>
          </View>
        ) : null}
        <View style={[styles.slide, { width: cardWidth }]}>
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
                  {t(
                    derived.mode === 'senior' ? 'workout.legend.fadeSenior' : 'workout.legend.fade',
                  )}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.bodyRow}>
              <AppText variant="h3">{t('workout.worked')}</AppText>
              {/* The muscles worked light up one by one (Phase 27, B1), as
                  painted areas, front and back side by side (Phase 29, A4). */}
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
        </View>
      </ScrollView>
      {fun ? (
        <View style={styles.dots} aria-hidden>
          {[0, 1].map((n) => (
            <View key={n} style={[styles.dot, page === n && styles.dotOn]} />
          ))}
        </View>
      ) : null}

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

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <AppText variant="h1" style={styles.num}>
        {value}
      </AppText>
      <AppText color={colors.mutedStrong} numberOfLines={2} style={styles.center}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 48,
  },
  brand: { fontStyle: 'italic', textTransform: 'uppercase' },
  topSpacer: { width: 48 },
  titleBlock: { alignItems: 'center', gap: spacing.xs },
  greatJob: { fontStyle: 'italic', textTransform: 'uppercase', textAlign: 'center' },
  center: { textAlign: 'center' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xs },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.line },
  carousel: { gap: 0 },
  slide: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.card * 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
  },
  funBand: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
  },
  funEmoji: { fontSize: 120, lineHeight: 150, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { width: 22, backgroundColor: colors.accent },
  finish: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  column: { flexDirection: 'column' },
}));
