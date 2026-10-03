import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppText, Button, Icon, TextLink } from '@/components/ui';
import { MuscleAreaMap } from '@/features/bodymap/components/MuscleAreaMap';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import type { Exercise } from '@/features/exercises/types';
import { demoPoster, demoSexFor, demoVideo } from '@/features/exercises/videos';
import { MoreOptions } from '@/features/home/MoreOptions';
import { derive, modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { feel } from '../feel';
import { canEndTimedStep, cooldownHold, sideSet, stepAfter, stepKind, type Step } from '../flow';
import { clockText, exerciseCues, exerciseName } from '../format';
import { playTimerEnd } from '../sound';
import { useWorkoutStore } from '../store';
import type { WorkoutRecord } from '../types';

import { useNow } from './TimerRing';

/**
 * Warm-up, finisher and final stretch, full screen (Phase 31, D and G): the
 * clip edge to edge, back and "I feel pain" on top, the step dots on the
 * side, and at the bottom, on a dark fade (nothing on the actor): "Exercise
 * 1/4", the name, a big countdown or "10 reps", two lines of cues and one
 * light button. A countdown starts by itself, pauses with a tap on the clip
 * and ends by itself (Phase 27, A5); on a loaded day the warm-up button
 * unlocks at half time (SPEC §8).
 */
export function GuidedStep({
  workout,
  step,
  exercise,
  onSwap,
}: {
  workout: WorkoutRecord;
  step: Step;
  exercise: Exercise | undefined;
  onSwap?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { logSet, skipItem } = useWorkoutStore();
  const profile = useOnboardingStore();
  const mode = modeOf(profile);
  const [startedAt] = useState(() => clock.now().getTime());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedFor, setPausedFor] = useState(0);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const now = useNow(250);
  const { item } = step;
  const hold = cooldownHold(item);
  const total = hold ?? (stepKind(item) === 'timed' ? (item.durationSeconds ?? 0) : 0);
  const counting = total > 0;
  const elapsed = (now - startedAt - pausedFor - (pausedAt ? now - pausedAt : 0)) / 1000;
  const dayHasLoad = workout.session.items.some(
    (i) => i.role === 'main' && i.loadHint !== 'bodyweight',
  );
  const canEnd = !counting || canEndTimedStep(item, elapsed, dayHasLoad);
  const split = sideSet(item, step.setNo);
  const phase = workout.session.items.filter((i) => i.role === item.role && i.part !== 'ramp_up');
  const at = phase.indexOf(item);
  const next = stepAfter(workout, step);
  // The ramp-up sets belong to the first lift, not the warm-up screens.
  const lastOfPhase = !next || next.item.role !== item.role || next.item.part === 'ramp_up';

  const done = useCallback(() => {
    feel.set();
    logSet(workout.id, {
      itemId: item.id,
      exerciseId: item.exerciseId,
      setNo: step.setNo,
      ...(counting
        ? { seconds: Math.round(Math.min(elapsed, total) || total) }
        : item.holdSeconds
          ? { seconds: item.holdSeconds[0] }
          : { reps: item.reps?.[0] ?? 10 }),
    });
    // A program stretch (Phase 30): 30 s hold, then 30 s rest before the next one.
    const after = stepAfter(workout, step);
    if (item.countdown && item.restSeconds > 0 && after?.item.id === item.id) {
      router.push({ pathname: '/workout/[id]/rest', params: { id: workout.id } });
    }
  }, [logSet, workout, step, item, elapsed, total, counting]);

  // Time's up: one chime (D4 "Sounds") and the next step, once.
  const timeUp = counting && elapsed >= total;
  const ended = useRef(false);
  useEffect(() => {
    if (timeUp && !ended.current) {
      ended.current = true;
      playTimerEnd();
      done();
    }
  }, [timeUp, done]);

  const mediaSex = demoSexFor(profile);
  const hasMedia =
    !!exercise &&
    !!mediaSex &&
    !!(demoVideo(exercise.slug, mediaSex) || demoPoster(exercise.slug, mediaSex));
  const togglePause = () => {
    if (!counting) return;
    const t0 = clock.now().getTime();
    if (pausedAt) {
      setPausedFor((p) => p + (t0 - pausedAt));
      setPausedAt(null);
    } else setPausedAt(t0);
  };
  const skipCooldown = () => {
    for (const i of workout.session.items.filter((x) => x.role === 'cooldown')) {
      skipItem(workout.id, i.id);
    }
  };

  const buttonLabel = !lastOfPhase
    ? t('workout.guided.next')
    : item.role === 'warmup'
      ? t('workout.guided.finishWarmup')
      : item.role === 'cooldown'
        ? t('workout.guided.finishStretch')
        : t('workout.player.doneStep');
  const amount = counting
    ? clockText(total - elapsed)
    : item.holdSeconds
      ? t('workout.logger.seconds', { count: item.holdSeconds[0] })
      : t('workout.logger.repsValue', { count: item.reps?.[0] ?? 10 });
  const eyebrow = split
    ? t('rehab.player.sideSet', {
        side: t(`rehab.side.${split.side}`),
        n: split.n,
        total: split.total,
      })
    : item.countdown && item.sets > 1
      ? t('rehab.player.holdOf', { n: step.setNo, total: item.sets })
      : t(item.role === 'cooldown' ? 'workout.guided.stretchOf' : 'workout.guided.exerciseOf', {
          n: at + 1,
          total: phase.length,
        });

  return (
    <View style={styles.root} testID="guided-step">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={togglePause}
        accessibilityRole={counting ? 'button' : undefined}
        accessibilityLabel={
          counting ? t(pausedAt ? 'workout.guided.resume' : 'workout.guided.pause') : undefined
        }
        testID="demo-frame"
      >
        <FullMedia exercise={exercise} />
      </Pressable>
      {/* The fade under the text: the actor stays clear above it. */}
      <View style={styles.fade} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
              <Stop offset="0.45" stopColor={colors.background} stopOpacity={0.85} />
              <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#veil)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.exit.open')}
            onPress={() =>
              router.push({ pathname: '/workout/[id]/exit', params: { id: workout.id } })
            }
            style={styles.round}
          >
            <Icon name="chevron-left" size={22} color={colors.onCanvas} />
          </Pressable>
          {/* "I feel pain" stays one tap away on every step (SPEC safety). */}
          <Pressable
            testID="pain-button"
            accessibilityRole="button"
            accessibilityLabel={t('workout.player.pain')}
            onPress={() =>
              router.push({ pathname: '/workout/[id]/pain', params: { id: workout.id } })
            }
            style={styles.pain}
          >
            <Icon name="bandage" size={18} color={colors.onCanvasMuted} />
            <AppText variant="label" color={colors.onCanvasMuted}>
              {t('workout.player.pain')}
            </AppText>
          </Pressable>
        </View>

        {phase.length > 1 ? (
          <View style={styles.dots} aria-hidden testID="guided-dots">
            {phase.map((p, n) => (
              <View key={p.id} style={[styles.dot, n === at && styles.dotOn]} />
            ))}
          </View>
        ) : null}

        {pausedAt ? (
          <View style={styles.playWrap} pointerEvents="none">
            <View style={styles.play}>
              <Icon name="play" size={44} color={colors.onCanvas} />
            </View>
          </View>
        ) : null}

        <View style={styles.bottom}>
          {!hasMedia ? (
            <View style={styles.soon}>
              <Icon name="clock" size={14} color={colors.mutedStrong} />
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('workout.demoSoon')}
              </AppText>
            </View>
          ) : null}
          {counting ? (
            <AppText variant="h3">
              {elapsed < 3
                ? t('workout.guided.getReady')
                : pausedAt
                  ? t('workout.guided.paused')
                  : ''}
            </AppText>
          ) : null}
          <View style={styles.amountRow}>
            <View style={styles.flex}>
              <View style={styles.eyebrow}>
                <AppText variant="bodyStrong">{eyebrow}</AppText>
              </View>
            </View>
            {!counting ? (
              <AppText
                variant="display"
                style={[styles.num, mode === 'senior' && styles.bigger]}
                testID="guided-amount"
              >
                {amount}
              </AppText>
            ) : null}
          </View>
          {counting ? (
            <AppText
              variant="display"
              style={[styles.num, styles.timer, mode === 'senior' && styles.bigger]}
              accessibilityLabel={t('workout.player.timeLeft', {
                time: clockText(total - elapsed),
              })}
              testID="guided-amount"
            >
              {amount}
            </AppText>
          ) : null}
          <AppText variant="h2" accessibilityRole="header">
            {exerciseName(t, exercise, item.exerciseId)}
          </AppText>
          <AppText color={colors.mutedStrong} numberOfLines={2}>
            {exerciseCues(t, exercise)}
          </AppText>
          {!canEnd ? (
            // Say when the button unlocks (QA P2).
            <AppText variant="caption" color={colors.muted}>
              {t('workout.player.halfHint')}
              {dayHasLoad ? ` ${t('workout.player.warmupShorten')}` : ''}
            </AppText>
          ) : null}
          <Button
            size="xl"
            variant="primary"
            label={buttonLabel}
            disabled={!canEnd}
            onPress={done}
            testID="guided-done"
          />
          {/* Swap: one tap, then the pick (Phase 27, A1). A program's
              exercises are fixed (Phase 30). */}
          {onSwap ? (
            <View style={styles.links}>
              <TextLink label={t('workout.player.swap')} onPress={onSwap} />
            </View>
          ) : null}
          {item.role === 'cooldown' ? (
            <MoreOptions>
              {confirmSkip ? (
                <View style={styles.confirm}>
                  <AppText variant="bodyStrong">{t('workout.player.skipCooldownConfirm')}</AppText>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Button
                        variant="secondary"
                        label={t('workout.player.keepCooldown')}
                        onPress={() => setConfirmSkip(false)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        variant="danger"
                        label={t('workout.player.skipCooldown')}
                        onPress={skipCooldown}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Button
                  variant="ghost"
                  label={t('workout.player.skipCooldown')}
                  onPress={() => setConfirmSkip(true)}
                />
              )}
            </MoreOptions>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The clip edge to edge in the profile's own sex, else its poster, else the
 * body with the muscles lit and "Demo coming soon". Never the other sex.
 */
function FullMedia({ exercise }: { exercise: Exercise | undefined }) {
  const styles = useStyles();
  const profile = useOnboardingStore();
  const sex = demoSexFor(profile);
  const derived = derive(profile);
  const slug = exercise?.slug;
  const video = slug && sex ? demoVideo(slug, sex) : null;
  const poster = slug && sex ? demoPoster(slug, sex) : null;
  if (video) {
    // Loaded lazily: only development builds and the preview have clips.
    const { DemoVideo } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./DemoVideo') as typeof import('./DemoVideo');
    return (
      <View style={styles.media} testID="guided-video">
        <DemoVideo source={video} poster={poster} fit="cover" />
      </View>
    );
  }
  if (poster)
    return (
      <View style={styles.media}>
        <Image
          testID="demo-poster"
          source={typeof poster === 'string' ? { uri: poster } : poster}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          accessible={false}
        />
      </View>
    );
  const band = displayBand(
    profile.bodyModel.band,
    derived?.band ?? 'adult',
    derived?.mode ?? 'adult',
  );
  return (
    <View style={[styles.media, styles.mapMedia]} testID="demo-muscle-map">
      {sex && exercise ? (
        <MuscleAreaMap
          band={band}
          sex={sex as BodySex}
          primary={exercise.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey)}
          secondary={exercise.muscles.filter((m) => m.role !== 'primary').map((m) => m.muscleKey)}
          maxHeight={380}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bodyCanvas },
  media: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bodyCanvas,
  },
  mapMedia: { alignItems: 'center', paddingTop: spacing.xxxl * 2 },
  soon: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  links: { flexDirection: 'row', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  round: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: sizes.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bodyCanvas,
  },
  pain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: sizes.touchTarget / 2,
    backgroundColor: colors.bodyCanvas,
  },
  dots: {
    position: 'absolute',
    right: spacing.md,
    top: '45%',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onCanvasMuted },
  dotOn: { height: 22, backgroundColor: colors.onCanvas },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bodyCanvas,
  },
  bottom: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  eyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  num: { fontVariant: ['tabular-nums'], fontFamily: fonts.heading },
  timer: { fontSize: 72, lineHeight: 80 },
  bigger: { fontSize: 80, lineHeight: 88 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  confirm: { gap: spacing.sm },
}));
