import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Button, Icon, Screen, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import { isMachine } from '@/features/generator/filters';
import { MoreOptions } from '@/features/home/MoreOptions';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { ExerciseDemo } from '@/features/workout/components/ExerciseDemo';
import {
  CountersRow,
  ExerciseHeader,
  ExercisesSheet,
  LoggerStep,
  mainFor,
  NextPreview,
} from '@/features/workout/components/Logger';
import { SafetyCues } from '@/features/workout/components/SafetyCues';
import { SwapSheet, type SwapReasonUi } from '@/features/workout/components/SwapSheet';
import { useNow } from '@/features/workout/components/TimerRing';
import { UndoBar } from '@/features/workout/components/UndoBar';
import {
  canEndTimedStep,
  cooldownHold,
  currentStep,
  mainItems,
  sideSet,
  stepAfter,
  stepKind,
  type Step,
} from '@/features/workout/flow';
import { feel } from '@/features/workout/feel';
import { clockText, exerciseCues, exerciseName } from '@/features/workout/format';
import { endWorkout, useSafetyRefresh, useWorkout } from '@/features/workout/hooks';
import { playTimerEnd } from '@/features/workout/sound';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { useUsageStore } from '@/lib/usage';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * The player (Phase 31, D): warm-up and final stretch as full-screen guided
 * steps, the main work in the set logger, a preview between exercises.
 */
export default function PlayerScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, byId, input, library } = useWorkout(id);
  useSafetyRefresh(workout?.id, input, library);
  const mode = useOnboardingStore((st) => modeOf(st));
  const [sheet, setSheet] = useState<SwapReasonUi | null>(null);
  const [list, setList] = useState(false);
  // Exercises whose "Start exercise" preview was already seen.
  const [seen, setSeen] = useState<string[]>([]);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const clearUndo = useCallback(() => setUndoMessage(null), []);

  const step = workout ? currentStep(workout) : null;
  const finished = !!workout && !step;

  // Everything logged or skipped: the workout is complete.
  useEffect(() => {
    if (finished && workout && (workout.status === 'active' || workout.status === 'planned')) {
      endWorkout(workout.id, 'done');
      router.replace({ pathname: '/workout/[id]/done', params: { id: workout.id } });
    }
  }, [finished, workout]);

  // Install → first exercise on screen (Phase 27 "Measure"), once.
  useEffect(() => {
    if (step) useUsageStore.getState().firstExercise(clock.now());
  }, [step]);

  // Voice cues (Settings, D4): the exercise name is read out when it starts.
  const voice = usePrefsStore((st) => st.voice);
  const stepExercise = step ? byId.get(step.item.exerciseId) : undefined;
  const spoken = step && voice ? exerciseName(t, stepExercise, step.item.exerciseId) : null;
  useEffect(() => {
    if (spoken) Speech.speak(spoken, { language: i18n.language });
  }, [spoken, i18n.language]);

  if (!workout || !input) return <Redirect href="/home" />;
  if (!step) {
    return workout.status === 'done' || workout.status === 'partial' ? (
      <Redirect href={{ pathname: '/workout/[id]/done', params: { id: workout.id } }} />
    ) : null;
  }

  const guided = isGuided(step);
  const item = guided ? step.item : mainFor(workout, step.item);
  const exercise = byId.get(item.exerciseId);
  const mains = mainItems(workout);
  const mainIndex = mains.findIndex((i) => i.id === item.id);
  const title = guided
    ? t(`workout.player.phase.${step.item.role}`)
    : t('workout.logger.exerciseOf', { n: mainIndex + 1, total: mains.length });
  const program = !!workout.session.program;
  const onSwap = program ? undefined : () => setSheet('user_choice');

  // Between exercises: what comes next, before its first set (Gymverse-like).
  const preview =
    !guided &&
    step.item.role === 'main' &&
    step.setNo === 1 &&
    !seen.includes(item.id) &&
    workout.focus !== item.id &&
    !workout.logs.some((l) => l.itemId === item.id) &&
    mains.slice(0, Math.max(0, mainIndex)).some((m) => workout.logs.some((l) => l.itemId === m.id));

  const header = (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <TextLink
          label={t('workout.logger.exit')}
          accessibilityRole="button"
          accessibilityLabel={t('workout.exit.open')}
          onPress={() =>
            router.push({ pathname: '/workout/[id]/exit', params: { id: workout.id } })
          }
        />
        <AppText variant="label" style={[styles.caps, styles.title]} testID="player-title">
          {title}
        </AppText>
        <TextLink
          label={t('workout.logger.exercises')}
          accessibilityRole="button"
          onPress={() => setList(true)}
        />
      </View>
      <View style={styles.segments} aria-hidden>
        {mains.map((m, n) => (
          <View
            key={m.id}
            style={[
              styles.segment,
              (mainIndex < 0 ? step.item.role !== 'warmup' : n <= mainIndex) && styles.segmentOn,
            ]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Screen header={header}>
      {/* "I feel pain" stays one tap away on every step (SPEC safety), in the
          secondary text color with an icon so it never outshouts the exercise
          (Phase 29, A6). */}
      <Pressable
        testID="pain-button"
        accessibilityRole="button"
        accessibilityLabel={t('workout.player.pain')}
        hitSlop={4}
        onPress={() => router.push({ pathname: '/workout/[id]/pain', params: { id: workout.id } })}
        style={({ pressed }) => [styles.pain, pressed && styles.painPressed]}
      >
        <Icon name="bandage" size={18} color={colors.mutedStrong} />
        <AppText variant="label" color={colors.mutedStrong}>
          {t('workout.player.pain')}
        </AppText>
      </Pressable>

      <UndoBar message={undoMessage} onDone={clearUndo} />

      {guided ? (
        <GuidedStep
          key={`${step.item.id}-${step.setNo}-${step.item.exerciseId}`}
          workout={workout}
          step={step}
          exercise={exercise}
          onSwap={onSwap}
        />
      ) : preview ? (
        <NextPreview
          workout={workout}
          item={item}
          exercise={exercise}
          onStart={() => setSeen((s) => [...s, item.id])}
        />
      ) : (
        <View style={styles.stack}>
          <CountersRow workout={workout} showVolume={mode === 'adult'} />
          <ExerciseHeader exercise={exercise} item={item} onSwap={onSwap} />
          {exercise?.custom ? (
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('library.notReviewed')}
            </AppText>
          ) : null}
          <SafetyCues exercise={exercise} />
          {item.noteKey ? (
            <AppText variant="caption" color={colors.teal} testID="program-note">
              {t(item.noteKey as 'rehab.notes.cable')}
            </AppText>
          ) : null}
          <LoggerStep
            key={`${item.id}-${item.exerciseId}-${item.sets}`}
            workout={workout}
            step={step}
            exercise={exercise}
            byId={byId}
            onMachineTaken={
              !program && exercise?.equipment.some(isMachine)
                ? () => setSheet('machine_taken')
                : undefined
            }
          />
        </View>
      )}

      {list ? (
        <ExercisesSheet
          workout={workout}
          byId={byId}
          onClose={() => setList(false)}
          onPick={(itemId) => setSeen((s) => [...s, itemId])}
        />
      ) : null}

      {sheet ? (
        <SwapSheet
          visible
          workout={workout}
          itemId={item.id}
          reason={sheet}
          input={input}
          byId={byId}
          onPickItem={() => undefined}
          onClose={() => setSheet(null)}
          onSwapped={(e) => {
            setSheet(null);
            setUndoMessage(t('workout.swap.done', { name: exerciseName(t, e, e.id) }));
          }}
        />
      ) : null}
    </Screen>
  );
}

/** Warm-up, cool-down and timed steps run full screen; sets go to the logger. */
function isGuided(step: Step): boolean {
  const { item } = step;
  if (item.part === 'ramp_up') return false;
  if (stepKind(item) === 'timed' || cooldownHold(item) != null) return true;
  return item.role === 'warmup' || item.role === 'cooldown';
}

/**
 * A warm-up, finisher or stretch step (Phase 31, D): the clip full width with
 * nothing on top of it, "Exercise 1/4", the name, a big countdown or "10
 * reps", two lines of cues and one button. A countdown starts and ends by
 * itself (Phase 27, A5); the button ends it early once half has passed on a
 * day with loaded work (SPEC §8).
 */
function GuidedStep({
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
  const mode = useOnboardingStore((st) => modeOf(st));
  const [startedAt] = useState(() => clock.now().getTime());
  const [confirmSkip, setConfirmSkip] = useState(false);
  const now = useNow(250);
  const { item } = step;
  const hold = cooldownHold(item);
  const total = hold ?? (stepKind(item) === 'timed' ? (item.durationSeconds ?? 0) : 0);
  const counting = total > 0;
  const elapsed = (now - startedAt) / 1000;
  const dayHasLoad = workout.session.items.some(
    (i) => i.role === 'main' && i.loadHint !== 'bodyweight',
  );
  const canEnd = !counting || canEndTimedStep(item, elapsed, dayHasLoad);
  const split = sideSet(item, step.setNo);
  const phase = workout.session.items.filter((i) => i.role === item.role && i.part !== 'ramp_up');
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

  return (
    <View style={styles.stack} testID="guided-step">
      <ExerciseDemo
        slug={exercise?.slug ?? ''}
        unilateral={!!exercise?.unilateral}
        muscles={exercise?.muscles}
        chips={[]}
      />
      <AppText variant="caption" color={colors.accentText} style={styles.caps}>
        {split
          ? t('rehab.player.sideSet', {
              side: t(`rehab.side.${split.side}`),
              n: split.n,
              total: split.total,
            })
          : item.countdown && item.sets > 1
            ? t('rehab.player.holdOf', { n: step.setNo, total: item.sets })
            : t('workout.guided.exerciseOf', {
                n: phase.indexOf(item) + 1,
                total: phase.length,
              })}
      </AppText>
      <AppText variant="h1" accessibilityRole="header">
        {exerciseName(t, exercise, item.exerciseId)}
      </AppText>
      <AppText
        variant="display"
        style={[styles.num, mode === 'senior' && styles.bigger]}
        accessibilityLabel={
          counting ? t('workout.player.timeLeft', { time: clockText(total - elapsed) }) : amount
        }
        testID="guided-amount"
      >
        {amount}
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
        variant="accent"
        label={buttonLabel}
        disabled={!canEnd}
        onPress={done}
        testID="guided-done"
      />
      {/* Swap: one tap, then the pick (Phase 27, A1). A program's exercises
          are fixed (Phase 30). */}
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
  );
}

const useStyles = makeStyles(() => ({
  stack: { gap: spacing.md },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
  },
  title: { flex: 1, textAlign: 'center' },
  segments: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  segmentOn: { backgroundColor: colors.accent },
  pain: {
    alignSelf: 'flex-end',
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.chip,
  },
  painPressed: { backgroundColor: colors.line },
  caps: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingSemi },
  num: { fontVariant: ['tabular-nums'] },
  bigger: { fontSize: 64, lineHeight: 72 },
  row: { flexDirection: 'row', gap: spacing.sm },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  confirm: { gap: spacing.sm },
}));
