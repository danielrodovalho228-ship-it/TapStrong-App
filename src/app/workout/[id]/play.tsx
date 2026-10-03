import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Button, Icon, Screen, TextLink } from '@/components/ui';
import { isMachine } from '@/features/generator/filters';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { GuidedStep } from '@/features/workout/components/GuidedStep';
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
import { UndoBar } from '@/features/workout/components/UndoBar';
import { cooldownHold, currentStep, mainItems, stepKind, type Step } from '@/features/workout/flow';
import { exerciseName } from '@/features/workout/format';
import { endWorkout, useSafetyRefresh, useWorkout } from '@/features/workout/hooks';
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

  const swapSheet = sheet ? (
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
  ) : null;

  // Warm-up, finisher and stretch: full screen, edge to edge (Phase 31, G).
  if (guided)
    return (
      <>
        <GuidedStep
          key={`${step.item.id}-${step.setNo}-${step.item.exerciseId}`}
          workout={workout}
          step={step}
          exercise={exercise}
          onSwap={onSwap}
        />
        {swapSheet}
      </>
    );

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
    <Screen
      header={header}
      // "Start exercise" stays at the bottom of the preview (Phase 31, G).
      footer={
        preview ? (
          <Button
            label={t('workout.logger.startExercise')}
            onPress={() => setSeen((s) => [...s, item.id])}
            testID="start-exercise"
          />
        ) : undefined
      }
    >
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

      {preview ? (
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

      {swapSheet}
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
