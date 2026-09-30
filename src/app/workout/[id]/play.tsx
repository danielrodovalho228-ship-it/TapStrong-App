import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Chip, IconButton, Screen, TextLink } from '@/components/ui';
import { MoreOptions } from '@/features/home/MoreOptions';
import { adviceForItem, adviceLoad, advisedReps } from '@/features/workout/loads';
import { restFor, usePrefsStore } from '@/features/settings/store';
import * as Speech from 'expo-speech';
import type { Exercise } from '@/features/exercises/types';
import { isMachine } from '@/features/generator/filters';
import type { SessionItem } from '@/features/generator/types';
import { sameMuscleGroup } from '@/features/muscles';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { exerciseBest } from '@/features/progress/activity';
import { RangeNote } from '@/features/movement/RangeNote';
import { ExerciseDemo } from '@/features/workout/components/ExerciseDemo';
import { SafetyCues } from '@/features/workout/components/SafetyCues';
import { SwapSheet, type SwapReasonUi } from '@/features/workout/components/SwapSheet';
import { useNow } from '@/features/workout/components/TimerRing';
import { UndoBar } from '@/features/workout/components/UndoBar';
import {
  canEndTimedStep,
  cooldownHold,
  currentStep,
  mainItems,
  stepAfter,
  stepKind,
  type Step,
} from '@/features/workout/flow';
import { clockText, exerciseCues, exerciseName, targetText } from '@/features/workout/format';
import { feel } from '@/features/workout/feel';
import { endWorkout, useSafetyRefresh, useWorkout } from '@/features/workout/hooks';
import { LOAD_STEP, targetRange } from '@/features/workout/progression';
import { playTimerEnd } from '@/features/workout/sound';
import { useWorkoutStore } from '@/features/workout/store';
import type { LoadUnit, WorkoutRecord } from '@/features/workout/types';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { noteSetLogged, useUsageStore } from '@/lib/usage';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/** Mockup 11 — the player: warm-up → exercises → cool-down, in order. */
export default function PlayerScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, byId, input, library } = useWorkout(id);
  useSafetyRefresh(workout?.id, input, library);
  const [sheet, setSheet] = useState<SwapReasonUi | null>(null);
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

  const exercise = byId.get(step.item.exerciseId);
  const mains = mainItems(workout);
  const mainIndex = mains.findIndex((i) => i.id === step.item.id);
  const progressLabel =
    mainIndex >= 0
      ? t('workout.player.progress', { n: mainIndex + 1, total: mains.length })
      : t(`workout.player.phase.${step.item.role}`);

  return (
    <Screen
      header={
        <View style={styles.top}>
          <IconButton
            icon="close"
            accessibilityLabel={t('workout.exit.open')}
            onPress={() =>
              router.push({ pathname: '/workout/[id]/exit', params: { id: workout.id } })
            }
          />
          <View style={styles.segments} aria-hidden>
            {mains.map((m, n) => (
              <View
                key={m.id}
                style={[
                  styles.segment,
                  (mainIndex < 0 ? step.item.role !== 'warmup' : n <= mainIndex) &&
                    styles.segmentOn,
                ]}
              />
            ))}
          </View>
          <AppText variant="label" style={styles.progress}>
            {progressLabel}
          </AppText>
          {/* "I feel pain" stays one tap away on every step (SPEC safety). */}
          <Button
            variant="dangerText"
            fullWidth={false}
            label={t('workout.player.pain')}
            onPress={() =>
              router.push({ pathname: '/workout/[id]/pain', params: { id: workout.id } })
            }
          />
        </View>
      }
      footer={<UndoBar message={undoMessage} onDone={clearUndo} />}
    >
      <ExerciseDemo
        slug={exercise?.slug ?? ''}
        unilateral={!!exercise?.unilateral}
        chips={[
          { label: targetText(t, step.item, exercise), strong: true },
          ...(exercise?.muscles ?? [])
            // Never "Upper chest · also Upper chest" (QA round 2).
            .filter(
              (m) =>
                m.role === 'secondary' && !sameMuscleGroup(m.muscleKey, step.item.targetMuscle),
            )
            .slice(0, 1)
            .map((m) => ({
              label: t('workout.player.alsoWorks', {
                muscle: t(`muscles.${m.muscleKey}` as 'muscles.chest'),
              }),
            })),
        ]}
      />
      <View style={styles.titleBlock}>
        <AppText variant="h1" accessibilityRole="header">
          {exerciseName(t, exercise, step.item.exerciseId)}
        </AppText>
        {exercise?.custom ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('library.notReviewed')}
          </AppText>
        ) : null}
        <AppText color={colors.mutedStrong}>{exerciseCues(t, exercise)}</AppText>
        <RangeNote exercise={exercise} />
        <SafetyCues exercise={exercise} />
      </View>

      {stepKind(step.item) === 'timed' || cooldownHold(step.item) ? (
        <TimedStep
          key={`${step.item.id}-${step.setNo}-${step.item.exerciseId}`}
          workout={workout}
          step={step}
          seconds={cooldownHold(step.item) ?? undefined}
          onSwap={() => setSheet('user_choice')}
        />
      ) : (
        <SetStep
          key={`${step.item.id}-${step.setNo}-${step.item.exerciseId}`}
          workout={workout}
          step={step}
          exercise={exercise}
          onSwap={() => setSheet('user_choice')}
          onMachineTaken={
            exercise?.equipment.some(isMachine) ? () => setSheet('machine_taken') : undefined
          }
        />
      )}

      {sheet ? (
        <SwapSheet
          visible
          workout={workout}
          itemId={step.item.id}
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

/**
 * Warm-up, finisher and cool-down steps with a countdown. The countdown
 * starts by itself and the step ends by itself when it reaches zero (Phase
 * 27, A5: nothing to confirm between steps); "Done" ends it early once half
 * of it has passed.
 */
function TimedStep({
  workout,
  step,
  seconds,
  onSwap,
}: {
  workout: WorkoutRecord;
  step: Step;
  /** A cool-down stretch hold counted down (Phase 27, A1). */
  seconds?: number;
  onSwap: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { logSet, skipItem } = useWorkoutStore();
  const [startedAt] = useState(() => clock.now().getTime());
  const [confirmSkip, setConfirmSkip] = useState(false);
  const now = useNow(250);
  const total = seconds ?? step.item.durationSeconds ?? 0;
  const elapsed = (now - startedAt) / 1000;
  const dayHasLoad = workout.session.items.some(
    (i) => i.role === 'main' && i.loadHint !== 'bodyweight',
  );
  const canEnd = canEndTimedStep(step.item, elapsed, dayHasLoad);

  const done = useCallback(() => {
    feel.set();
    logSet(workout.id, {
      itemId: step.item.id,
      exerciseId: step.item.exerciseId,
      setNo: step.setNo,
      seconds: Math.round(Math.min(elapsed, total) || total),
    });
  }, [logSet, workout.id, step.item.id, step.item.exerciseId, step.setNo, elapsed, total]);
  // Time's up: one chime (D4 "Sounds") and the next step, once.
  const timeUp = total > 0 && elapsed >= total;
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

  return (
    <View style={styles.setStack}>
      <Button size="xl" label={t('workout.player.doneStep')} disabled={!canEnd} onPress={done} />
      {/* Swap: one tap, then the pick (Phase 27, A1: at most 2 taps). */}
      <View style={styles.links}>
        <TextLink label={t('workout.player.swap')} onPress={onSwap} />
      </View>
      {step.item.role === 'cooldown' ? (
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
      <Card style={styles.setCard}>
        <AppText variant="caption" color={colors.muted} style={styles.caps}>
          {t(`workout.player.phase.${step.item.role}`)}
        </AppText>
        <AppText
          variant="display"
          style={styles.num}
          accessibilityLabel={t('workout.player.timeLeft', { time: clockText(total - elapsed) })}
        >
          {clockText(total - elapsed)}
        </AppText>
        {!canEnd ? (
          // Say when "Done" unlocks (QA P2).
          <AppText variant="caption" color={colors.muted}>
            {t('workout.player.halfHint')}
            {dayHasLoad ? ` ${t('workout.player.warmupShorten')}` : ''}
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

/** A set of a main exercise (or ramp-up / stretch hold): reps or seconds, and load. */
function SetStep({
  workout,
  step,
  exercise,
  onSwap,
  onMachineTaken,
}: {
  workout: WorkoutRecord;
  step: Step;
  exercise: Exercise | undefined;
  onSwap: () => void;
  onMachineTaken?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const prefs = usePrefsStore();
  const { logSet, workouts } = useWorkoutStore();
  const units = useOnboardingStore((s) => s.units);
  const unit: LoadUnit = units === 'imperial' ? 'lb' : 'kg';
  const item: SessionItem = step.item;
  const hold = stepKind(item) === 'hold';
  const range = targetRange(item) ?? [8, 12];
  const loaded = !!exercise?.loaded && item.loadHint !== 'bodyweight';

  const generator = useWorkout(workout.id).input;
  const advice = generator
    ? adviceForItem({ workouts, workoutId: workout.id, item, exercise, unit, generator })
    : null;
  // Only this exercise's own sets: after a swap the old load doesn't carry over (QA P2).
  const earlier = workout.logs
    .filter((l) => l.itemId === item.id && l.exerciseId === item.exerciseId && l.load != null)
    .pop();
  // A "+1 rep" day keeps the last load (QA R4-10).
  const initialLoad = earlier?.load ?? adviceLoad(advice) ?? 0;

  // The stepper starts at the day's target (QA R5-02): the advised reps on a
  // "+1 rep" day, else the bottom of the range.
  const [value, setValue] = useState(!hold && advice?.kind === 'reps' ? advice.reps : range[0]);
  const [load, setLoad] = useState(initialLoad);
  // How hard the set felt (A4): Easy 6, Solid 8, Very hard 10.
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const askEffort = loaded && item.role === 'main' && !hold;
  const valueStep = hold ? 5 : 1;

  const mode = useOnboardingStore((st) => modeOf(st));
  const done = () => {
    // Feel (Phase 27, B2): a light tap per set, a stronger one when the
    // exercise is complete, a success tap for a new best load (adults only).
    const best = loaded ? exerciseBest(workouts, item.exerciseId, unit).max : 0;
    feel.set();
    if (step.setNo >= item.sets) feel.exercise();
    if (mode === 'adult' && loaded && best > 0 && load > best) feel.record();
    logSet(workout.id, {
      itemId: item.id,
      exerciseId: item.exerciseId,
      setNo: step.setNo,
      ...(hold ? { seconds: value } : { reps: value }),
      ...(loaded ? { load, unit } : {}),
      ...(askEffort && rpe ? { rpe } : {}),
    });
    setRpe(undefined);
    track('set_logged');
    noteSetLogged();
    const next = stepAfter(workout, step);
    if (next && item.restSeconds > 0 && item.role === 'main') {
      router.push({ pathname: '/workout/[id]/rest', params: { id: workout.id } });
    }
  };

  // The advised reps on a "+1 rep" day replace the range (QA R7 P2).
  const aim = hold ? null : advisedReps(advice);
  const shown: [number, number] = aim ? [aim, aim] : range;
  const targetLine = [
    t(hold ? 'workout.player.targetHold' : 'workout.player.targetReps', {
      range: shown[0] === shown[1] ? `${shown[0]}` : `${shown[0]}–${shown[1]}`,
    }),
    item.perSide ? t('workout.eachSide') : null,
    loaded && load > 0 ? `${load} ${t(`workout.units.${unit}`)}` : null,
    item.loadHint ? t(`workout.load.${item.loadHint}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Keyboard and switch users reach "Done with set" first (QA R5 P2: it took
  // 12–14 tabs): it comes first in the tree and the column is reversed, so
  // it still sits at the bottom of the screen.
  return (
    <View style={styles.setStack}>
      <Button size="xl" label={t('workout.player.doneSet')} onPress={done} />
      {/* Swap: one tap, then the pick (Phase 27, A1: at most 2 taps). */}
      {item.part !== 'ramp_up' ? (
        <View style={styles.links}>
          <TextLink label={t('workout.player.swap')} onPress={onSwap} />
        </View>
      ) : null}
      {onMachineTaken || (item.restSeconds > 0 && item.role === 'main') ? (
        <MoreOptions>
          {onMachineTaken ? (
            <Button variant="ghost" label={t('workout.machineTaken')} onPress={onMachineTaken} />
          ) : null}
          {item.restSeconds > 0 && item.role === 'main' ? (
            <Button
              variant="secondary"
              label={t('workout.player.restButton', { seconds: restFor(item, prefs) })}
              onPress={() =>
                router.push({
                  pathname: '/workout/[id]/rest',
                  params: { id: workout.id, manual: '1' },
                })
              }
            />
          ) : null}
        </MoreOptions>
      ) : null}
      <Card style={styles.setCard}>
        <AppText variant="h3">
          {t('workout.player.setOf', { n: step.setNo, total: item.sets })}
        </AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {targetLine}
        </AppText>
        <Counter
          label={t(hold ? 'workout.player.seconds' : 'workout.player.reps')}
          value={value}
          onChange={(v) => setValue(Math.max(0, Math.min(hold ? 300 : 100, v)))}
          step={valueStep}
        />
        {loaded ? (
          <Counter
            label={t('workout.player.load', { unit: t(`workout.units.${unit}`) })}
            value={load}
            onChange={(v) => setLoad(Math.max(0, Math.min(1000, v)))}
            step={LOAD_STEP[unit]}
          />
        ) : null}
        {advice?.kind === 'first' && !earlier ? (
          <AppText variant="caption" color={colors.teal}>
            {t('load.first')}
          </AppText>
        ) : advice?.kind === 'load' && advice.easier ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('load.easier')}
          </AppText>
        ) : advice?.kind === 'reps' && advice.harder ? (
          <AppText variant="caption" color={colors.teal}>
            {t('load.harder')}
          </AppText>
        ) : advice?.kind === 'reps' && advice.change === 'up' ? (
          <AppText variant="caption" color={colors.teal}>
            {advice.load
              ? t('load.repsUp', { reps: advice.reps })
              : t('load.repsUpBodyweight', { reps: advice.reps })}
          </AppText>
        ) : advice?.kind === 'load' && advice.change !== 'same' ? (
          <AppText
            variant="caption"
            color={advice.change === 'up' ? colors.teal : colors.mutedStrong}
          >
            {t(advice.change === 'up' ? 'load.up' : 'load.down', {
              load: advice.load,
              unit: t(`workout.units.${unit}`),
            })}
          </AppText>
        ) : null}
        {askEffort ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('load.effort')}
            style={styles.effort}
          >
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('load.effort')}
            </AppText>
            <View style={styles.effortRow}>
              {(
                [
                  ['easy', 6],
                  ['solid', 8],
                  ['hard', 10],
                ] as const
              ).map(([key, value]) => (
                <Chip
                  key={key}
                  label={t(`load.${key}`)}
                  selected={rpe === value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: rpe === value }}
                  aria-checked={rpe === value}
                  onPress={() => setRpe(rpe === value ? undefined : value)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function Counter({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.counter}>
      <AppText variant="label" style={styles.flex}>
        {label}
      </AppText>
      <IconButton
        icon="minus"
        variant="outlined"
        accessibilityLabel={t('workout.player.decrease', { label })}
        onPress={() => onChange(value - step)}
      />
      <View style={styles.counterValue} accessible accessibilityLabel={`${label}: ${value}`}>
        <AppText variant="h1" style={styles.num}>
          {value}
        </AppText>
      </View>
      <IconButton
        icon="plus"
        variant="outlined"
        accessibilityLabel={t('workout.player.increase', { label })}
        onPress={() => onChange(value + step)}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  setStack: { flexDirection: 'column-reverse', gap: spacing.lg },
  effort: { gap: spacing.xs },
  effortRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  segments: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  segmentOn: { backgroundColor: colors.ink },
  progress: { minWidth: 48, textAlign: 'right' },
  titleBlock: { gap: spacing.xs },
  setCard: { gap: spacing.md },
  caps: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingSemi },
  row: { flexDirection: 'row', gap: spacing.sm },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  num: { fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  confirm: { gap: spacing.sm },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  counterValue: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: radius.button,
  },
}));
