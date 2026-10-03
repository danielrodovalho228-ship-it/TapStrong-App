import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Icon, IconButton, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import type { SessionItem } from '@/features/generator/types';
import { exerciseRecords } from '@/features/library/performance';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { exerciseBest } from '@/features/progress/activity';
import { programById } from '@/features/rehab/programs';
import { programLoadAdvice } from '@/features/rehab/progress';
import { useRehabStore } from '@/features/rehab/store';
import { usePrefsStore } from '@/features/settings/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { noteSetLogged } from '@/lib/usage';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { useDoseOverrides } from '../doseOverrides';
import { feel } from '../feel';
import { sideSet, stepAfter, type Step } from '../flow';
import { clockText, exerciseName, targetText } from '../format';
import { useWorkout } from '../hooks';
import { adviceForItem, adviceLoad, advisedReps, convertLoad } from '../loads';
import { LOAD_STEP, pastSessions, targetRange } from '../progression';
import { useWorkoutStore } from '../store';
import type { LoadUnit, SetLog, WorkoutRecord } from '../types';

import { MaxLoadChart } from './MaxLoadChart';
import { ExerciseThumb } from './Media';
import { useNow } from './TimerRing';

/** Warm-up sets before the first loaded lift (Phase 29, B5; Phase 31, D). */
export const RAMP_REPS = [10, 5, 3, 1];

/** Program loads (Phase 30, §3): start at 0.5 kg / 1 lb and go up by about that much. */
const PROGRAM_START: Record<LoadUnit, number> = { kg: 0.5, lb: 1 };
const PROGRAM_STEP: Record<LoadUnit, number> = { kg: 0.5, lb: 1 };

/** "10 reps empty bar · 5 light": one part per warm-up set the plan has. */
function rampScheme(t: TFunction, ramp: SessionItem, barbell: boolean): string {
  if (ramp.loadHint !== 'ramp') return t('workout.logger.warmupLight', { reps: RAMP_REPS[0] });
  const parts = [
    t(barbell ? 'workout.logger.rampBar' : 'workout.logger.rampVeryLight', { reps: RAMP_REPS[0] }),
    t('workout.logger.rampLight', { reps: RAMP_REPS[1] }),
    t('workout.logger.rampMedium', { reps: RAMP_REPS[2] }),
    t('workout.logger.rampHeavy', { reps: RAMP_REPS[3] }),
  ];
  return parts.slice(0, Math.max(1, Math.min(parts.length, ramp.sets))).join(' · ');
}

const rangeText = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);

/** The main item a ramp-up item warms up for, or the item itself. */
export function mainFor(workout: WorkoutRecord, item: SessionItem): SessionItem {
  if (item.part !== 'ramp_up') return item;
  const at = workout.session.items.indexOf(item);
  return (
    workout.session.items
      .slice(at + 1)
      .find((i) => i.exerciseId === item.exerciseId && i.part !== 'ramp_up') ?? item
  );
}

/** The ramp-up item before a main item, while it still has sets to do. */
function openRamp(workout: WorkoutRecord, item: SessionItem): SessionItem | null {
  const at = workout.session.items.indexOf(item);
  const ramp = workout.session.items
    .slice(0, Math.max(0, at))
    .reverse()
    .find((i) => i.part === 'ramp_up' && i.exerciseId === item.exerciseId);
  if (!ramp || workout.skipped.includes(ramp.id)) return null;
  const done = workout.logs.filter((l) => l.itemId === ramp.id).length;
  return done < ramp.sets ? ramp : null;
}

/** Workout time, volume (load × reps, adults) and reps so far (Phase 31, D). */
export function CountersRow({
  workout,
  showVolume,
}: {
  workout: WorkoutRecord;
  showVolume: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const now = useNow(1000);
  const units = useOnboardingStore((s) => s.units);
  const unit: LoadUnit = units === 'imperial' ? 'lb' : 'kg';
  const started = Date.parse(workout.startedAt ?? workout.createdAt);
  const mainIds = new Set(workout.session.items.filter((i) => i.role === 'main').map((i) => i.id));
  const mainLogs = workout.logs.filter((l) => mainIds.has(l.itemId));
  const reps = mainLogs.reduce((n, l) => n + (l.reps ?? 0), 0);
  const volume = Math.round(
    mainLogs.reduce(
      (n, l) => n + (l.load ? convertLoad(l.load, l.unit ?? unit, unit) * (l.reps ?? 0) : 0),
      0,
    ),
  );
  const cells = [
    { key: 'time', label: t('workout.logger.time'), value: clockText((now - started) / 1000) },
    showVolume
      ? {
          key: 'volume',
          label: t('workout.logger.volume'),
          value: `${volume} ${t(`workout.units.${unit}`)}`,
        }
      : { key: 'sets', label: t('workout.logger.sets'), value: `${mainLogs.length}` },
    { key: 'reps', label: t('workout.logger.reps'), value: `${reps}` },
  ];
  return (
    <View style={styles.counters} testID="logger-counters">
      {cells.map((c) => (
        <View key={c.key} style={styles.counterCell} testID={`counter-${c.key}`}>
          <AppText variant="h3" style={styles.num}>
            {c.value}
          </AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {c.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Thumbnail, name, muscle chip and notes; tap for the exercise detail (Phase 31, D). */
export function ExerciseHeader({
  exercise,
  item,
  onSwap,
}: {
  exercise: Exercise | undefined;
  item: SessionItem;
  onSwap?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const name = exerciseName(t, exercise, item.exerciseId);
  const open = () =>
    exercise && router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } });
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('workout.logger.openDetail', { name })}
        onPress={open}
        style={styles.headerMain}
        testID="logger-header"
      >
        <ExerciseThumb size={56} slug={exercise?.slug} />
        <View style={styles.flex}>
          <AppText variant="h2" accessibilityRole="header" numberOfLines={2}>
            {name}
          </AppText>
          <View style={styles.muscleChip}>
            <AppText variant="caption" color={colors.accentText}>
              {targetText(t, item, exercise)}
            </AppText>
          </View>
        </View>
      </Pressable>
      {onSwap ? (
        <IconButton
          icon="swap"
          accessibilityLabel={t('workout.swap.open', { name })}
          onPress={onSwap}
        />
      ) : null}
      <IconButton icon="note" accessibilityLabel={t('workout.logger.notes')} onPress={open} />
    </View>
  );
}

/**
 * The set logger (Phase 31, D): the exercise's warm-up sets as one card,
 * "Next: 5 sets × 10–12 reps", every set as a row — logged rows with
 * "Redo", the current one in coral with "Done", the rest dimmed — the goal,
 * "Log all sets", "Customize exercise" and the next exercise. Minors log
 * reps only, never a load; 60+ get bigger numbers and buttons.
 */
export function LoggerStep({
  workout,
  step,
  exercise,
  byId,
  onMachineTaken,
}: {
  workout: WorkoutRecord;
  step: Step;
  exercise: Exercise | undefined;
  byId: Map<string, Exercise>;
  onMachineTaken?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { logSet, unlogSet, skipItem, workouts } = useWorkoutStore();
  const units = useOnboardingStore((s) => s.units);
  const unit: LoadUnit = units === 'imperial' ? 'lb' : 'kg';
  const unitLabel = t(`workout.units.${unit}`);
  const mode = useOnboardingStore((st) => modeOf(st));
  const minor = mode === 'child' || mode === 'teen';
  const senior = mode === 'senior';
  const item = mainFor(workout, step.item);
  const ramp = step.item.part === 'ramp_up' ? step.item : openRamp(workout, item);
  const hold = !!item.holdSeconds && !item.reps;
  const range = targetRange(item) ?? [8, 12];
  const loaded = !!exercise?.loaded && item.loadHint !== 'bodyweight' && !minor;
  const generator = useWorkout(workout.id).input;
  const program = workout.session.program;
  const programItem = !!program && (item.block === 'band' || item.block === 'dumbbell');
  // Settings → "Smart weights and reps" off: no suggestion (Phase 31, F).
  const smartLoads = usePrefsStore((st) => st.smartLoads);
  const advice =
    generator && !program && smartLoads
      ? adviceForItem({ workouts, workoutId: workout.id, item, exercise, unit, generator })
      : null;
  const logsOf = workout.logs.filter(
    (l) => l.itemId === item.id && l.exerciseId === item.exerciseId,
  );
  const earlier = [...logsOf].reverse().find((l) => l.load != null);
  const last = pastSessions(workouts, item.exerciseId, workout.id)[0];
  const initialLoad =
    earlier?.load ??
    adviceLoad(advice) ??
    (program && loaded
      ? (lastLoad(workouts, item.exerciseId, workout.id) ?? PROGRAM_START[unit])
      : 0);
  const aim = hold ? null : advisedReps(advice);
  const shown: [number, number] = aim ? [aim, aim] : range;
  const [reps, setReps] = useState(!hold && advice?.kind === 'reps' ? advice.reps : range[0]);
  const [load, setLoad] = useState(initialLoad);
  const [adjust, setAdjust] = useState(false);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [customize, setCustomize] = useState(false);
  const askEffort = ((loaded && item.role === 'main') || programItem) && !hold;
  const loadStep = program ? PROGRAM_STEP[unit] : LOAD_STEP[unit];
  const current = ramp ? null : step.setNo;
  const nextMain = nextMainAfter(workout, item);
  const nextExercise = nextMain ? byId.get(nextMain.exerciseId) : undefined;

  const log = (setNo: number, withRest: boolean) => {
    const best = loaded ? exerciseBest(workouts, item.exerciseId, unit).max : 0;
    feel.set();
    if (setNo >= item.sets) feel.exercise();
    if (mode === 'adult' && loaded && best > 0 && load > best) feel.record();
    logSet(workout.id, {
      itemId: item.id,
      exerciseId: item.exerciseId,
      setNo,
      ...(hold ? { seconds: reps } : { reps }),
      ...(loaded ? { load, unit } : {}),
      ...(askEffort && rpe ? { rpe } : {}),
    });
    setRpe(undefined);
    setAdjust(false);
    track('set_logged');
    noteSetLogged();
    if (withRest && item.restSeconds > 0) {
      const after = stepAfter(workout, { ...step, item, setNo });
      if (after) router.push({ pathname: '/workout/[id]/rest', params: { id: workout.id } });
    }
  };

  const doRamp = () => {
    if (!ramp) return;
    feel.set();
    const doneSets = workout.logs.filter((l) => l.itemId === ramp.id).length;
    for (let setNo = doneSets + 1; setNo <= ramp.sets; setNo++)
      logSet(workout.id, {
        itemId: ramp.id,
        exerciseId: ramp.exerciseId,
        setNo,
        reps: RAMP_REPS[setNo - 1] ?? RAMP_REPS.at(-1),
      });
  };

  const logAll = () => {
    for (let setNo = 1; setNo <= item.sets; setNo++)
      if (!logsOf.some((l) => l.setNo === setNo)) log(setNo, false);
  };

  // 60+: bigger numbers, still on one line at 390 px.
  const big = senior ? 'h1' : 'h2';
  // Minors never see a load, not even one logged before (Phase 29, B4).
  const loadText = `${load} ${unitLabel}`;
  const loadShown = (l: SetLog) =>
    l.load && !minor ? `${convertLoad(l.load, l.unit ?? unit, unit)} ${unitLabel}` : null;
  const lastLog = (setNo: number) => last?.logs.find((l) => l.setNo === setNo) ?? last?.logs.at(-1);
  const goal = loaded && advice?.kind === 'load' && advice.change === 'up' ? advice.load : null;
  const records = loaded && !minor ? exerciseRecords(workouts, item.exerciseId, unit) : null;
  const points = (records?.sessions ?? [])
    .map((s) => s.bestLoad ?? 0)
    .filter((v) => v > 0)
    .slice(-8);
  const doseLine = hold
    ? t('workout.logger.nextHold', { count: item.sets, range: rangeText(shown) })
    : t('plan.badge', { count: item.sets, reps: rangeText(shown) });

  return (
    <View style={styles.stack}>
      {points.length && mode === 'adult' ? (
        <MaxLoadChart points={points} goal={goal ?? adviceLoad(advice)} unitLabel={unitLabel} />
      ) : null}

      {ramp ? (
        <View style={styles.warmCard} testID="ramp-card">
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{t('workout.logger.warmupTitle')}</AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {rampScheme(t, ramp, !!exercise?.equipment.includes('barbell'))}
            </AppText>
            <TextLink
              label={t('workout.ramp.skip')}
              onPress={() => skipItem(workout.id, ramp.id)}
            />
          </View>
          <Button label={t('workout.logger.did')} onPress={doRamp} testID="ramp-done" />
        </View>
      ) : null}

      <AppText variant="label" color={colors.mutedStrong} testID="logger-next">
        {t('workout.logger.next', { dose: doseLine })}
      </AppText>

      {goal ? (
        <View style={styles.goal} testID="logger-goal">
          <Icon name="flame" size={18} color={colors.accentText} />
          <AppText variant="caption" color={colors.accentText} style={styles.flex}>
            {t('workout.logger.goal', { load: `${goal} ${unitLabel}` })}
          </AppText>
        </View>
      ) : null}

      <View style={styles.sets} testID="logger-sets">
        {Array.from({ length: item.sets }, (_, n) => n + 1).map((setNo) => {
          const logged = logsOf.find((l) => l.setNo === setNo);
          const split = sideSet(item, setNo);
          const label = split
            ? t('rehab.player.sideSet', {
                side: t(`rehab.side.${split.side}`),
                n: split.n,
                total: split.total,
              })
            : t('workout.logger.setRow', { n: setNo });
          if (logged)
            return (
              <View key={setNo} style={styles.loggedRow} testID="set-logged">
                <AppText variant="caption" color={colors.mutedStrong} style={styles.setLabel}>
                  {label}
                </AppText>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {[
                    loadShown(logged),
                    logged.seconds != null && logged.reps == null
                      ? t('workout.logger.seconds', { count: logged.seconds })
                      : t('workout.logger.repsValue', { count: logged.reps ?? 0 }),
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </AppText>
                <Icon name="check" size={18} color={colors.teal} />
                <TextLink
                  label={t('workout.logger.redo')}
                  onPress={() => unlogSet(workout.id, item.id, setNo)}
                />
              </View>
            );
          if (setNo === current) {
            const prev = lastLog(setNo);
            return (
              <View key={setNo} style={styles.currentRow} testID="set-current">
                <View style={styles.currentTop}>
                  <View style={styles.flex}>
                    <AppText variant="caption" color={colors.accentText} style={styles.caps}>
                      {label}
                    </AppText>
                    {loaded ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workout.logger.adjustLoad')}
                        onPress={() => setAdjust((a) => !a)}
                        testID="current-load"
                      >
                        <AppText variant="caption" color={colors.mutedStrong}>
                          {prev?.load
                            ? t('workout.logger.suggested', { last: loadShown(prev) })
                            : t('workout.logger.suggestedNoLast')}
                        </AppText>
                        <AppText variant={big} style={styles.num}>
                          {loadText}
                        </AppText>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('workout.logger.adjustReps')}
                      onPress={() => setAdjust((a) => !a)}
                      testID="current-reps"
                    >
                      <AppText
                        variant={loaded ? 'bodyStrong' : big}
                        style={styles.num}
                        color={loaded ? colors.mutedStrong : colors.ink}
                      >
                        {hold
                          ? t('workout.logger.holdLine', { range: rangeText(shown), value: reps })
                          : prev?.reps
                            ? t('workout.logger.repsLine', {
                                range: rangeText(shown),
                                value: reps,
                                last: prev.reps,
                              })
                            : t('workout.logger.repsLineNoLast', {
                                range: rangeText(shown),
                                value: reps,
                              })}
                      </AppText>
                    </Pressable>
                  </View>
                  <Button
                    size={senior ? 'xl' : undefined}
                    label={t('workout.logger.did')}
                    accessibilityLabel={t('workout.logger.didA11y')}
                    onPress={() => log(setNo, true)}
                    testID="set-done"
                  />
                </View>
                {loaded && exercise?.equipment.includes('barbell') ? (
                  <AppText variant="caption" color={colors.mutedStrong}>
                    {t('workout.logger.barPlates')}
                  </AppText>
                ) : null}
                {adjust ? (
                  <View style={styles.adjust} testID="quick-adjust">
                    <Counter
                      label={t(hold ? 'workout.player.seconds' : 'workout.player.reps')}
                      value={reps}
                      step={hold ? 5 : 1}
                      onChange={(v) => setReps(Math.max(0, Math.min(hold ? 300 : 100, v)))}
                    />
                    {loaded ? (
                      <Counter
                        label={t('workout.player.load', { unit: unitLabel })}
                        value={load}
                        step={loadStep}
                        onChange={(v) => setLoad(Math.max(0, Math.min(1000, v)))}
                      />
                    ) : null}
                  </View>
                ) : null}
                {askEffort ? (
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel={t('load.effort')}
                    style={styles.effort}
                  >
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
                ) : null}
                {advice && !earlier ? <AdviceNote advice={advice} unitLabel={unitLabel} /> : null}
                {programItem && exercise && program ? (
                  <ProgramLoadNote
                    programId={program.id}
                    exercise={exercise}
                    workoutId={workout.id}
                    loaded={loaded}
                    onRaised={() => loaded && setLoad(load + loadStep)}
                  />
                ) : null}
              </View>
            );
          }
          return (
            <View key={setNo} style={styles.futureRow} testID="set-future">
              <AppText variant="caption" color={colors.muted} style={styles.setLabel}>
                {label}
              </AppText>
              <AppText color={colors.muted} style={styles.flex}>
                {[
                  loaded && load ? `${load} ${unitLabel}` : null,
                  t('workout.logger.repsValue', { count: shown[0] }),
                ]
                  .filter(Boolean)
                  .join(' | ')}
              </AppText>
              <Icon name="play" size={14} color={colors.muted} />
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button variant="secondary" label={t('workout.logger.logAll')} onPress={logAll} />
        {!program ? (
          <Button
            variant="ghost"
            label={t('workout.logger.customize')}
            onPress={() => setCustomize(true)}
          />
        ) : null}
        {onMachineTaken ? (
          <Button variant="ghost" label={t('workout.machineTaken')} onPress={onMachineTaken} />
        ) : null}
      </View>

      {nextMain ? (
        <View style={styles.nextCard} testID="logger-next-exercise">
          <ExerciseThumb size={48} slug={nextExercise?.slug} />
          <View style={styles.flex}>
            <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
              {t('workout.logger.nextExercise')}
            </AppText>
            <AppText variant="bodyStrong">
              {exerciseName(t, nextExercise, nextMain.exerciseId)}
            </AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {nextMain.reps
                ? t('plan.badge', { count: nextMain.sets, reps: rangeText(nextMain.reps) })
                : t('workout.logger.nextHold', {
                    count: nextMain.sets,
                    range: rangeText(nextMain.holdSeconds ?? [30, 30]),
                  })}
            </AppText>
          </View>
        </View>
      ) : null}

      {customize ? (
        <CustomizeSheet
          item={item}
          onClose={() => setCustomize(false)}
          onApply={(dose, scope) => {
            useWorkoutStore.getState().updateItem(workout.id, item.id, dose);
            if (scope === 'plan') useDoseOverrides.getState().set(item.exerciseId, dose);
            setCustomize(false);
          }}
        />
      ) : null}
    </View>
  );
}

function nextMainAfter(workout: WorkoutRecord, item: SessionItem): SessionItem | null {
  const mains = workout.session.items.filter(
    (i) => i.role === 'main' && i.part !== 'ramp_up' && !workout.skipped.includes(i.id),
  );
  const at = mains.indexOf(item);
  return at >= 0 ? (mains[at + 1] ?? null) : null;
}

/** Why today's suggestion is what it is (load advice, Phase 14–20). */
function AdviceNote({
  advice,
  unitLabel,
}: {
  advice: NonNullable<ReturnType<typeof adviceForItem>>;
  unitLabel: string;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  if (advice.kind === 'first')
    return (
      <AppText variant="caption" color={colors.teal}>
        {t('load.first')}
      </AppText>
    );
  if (advice.kind === 'load' && advice.easier)
    return (
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('load.easier')}
      </AppText>
    );
  if (advice.kind === 'reps' && advice.harder)
    return (
      <AppText variant="caption" color={colors.teal}>
        {t('load.harder')}
      </AppText>
    );
  if (advice.kind === 'reps' && advice.change === 'up')
    return (
      <AppText variant="caption" color={colors.teal}>
        {advice.load
          ? t('load.repsUp', { reps: advice.reps })
          : t('load.repsUpBodyweight', { reps: advice.reps })}
      </AppText>
    );
  if (advice.kind === 'load' && advice.change !== 'same')
    return (
      <AppText variant="caption" color={advice.change === 'up' ? colors.teal : colors.mutedStrong}>
        {t(advice.change === 'up' ? 'load.up' : 'load.down', {
          load: advice.load,
          unit: unitLabel,
        })}
      </AppText>
    );
  return null;
}

/** The last load used on this exercise in another workout, if any. */
function lastLoad(workouts: WorkoutRecord[], exerciseId: string, except: string) {
  for (const w of [...workouts].reverse()) {
    if (w.id === except) continue;
    const l = [...w.logs].reverse().find((x) => x.exerciseId === exerciseId && x.load != null);
    if (l) return l.load;
  }
  return undefined;
}

/**
 * "Customize exercise" (Phase 31, D): sets −/+, reps −/+ and where it applies
 * — the whole plan or only this exercise — with Discard and Done.
 */
function CustomizeSheet({
  item,
  onClose,
  onApply,
}: {
  item: SessionItem;
  onClose: () => void;
  onApply: (dose: { sets: number; reps: [number, number] }, scope: 'plan' | 'this') => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sets, setSets] = useState(item.sets);
  const [reps, setReps] = useState<[number, number]>(item.reps ?? [10, 12]);
  const [scope, setScope] = useState<'plan' | 'this'>('this');
  const shift = (d: number) =>
    setReps(([a, b]) => [Math.max(1, Math.min(30, a + d)), Math.max(1, Math.min(30, b + d))]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('workout.logger.discard')}
      />
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
        testID="customize-sheet"
      >
        <AppText variant="h2" accessibilityRole="header">
          {t('workout.logger.customize')}
        </AppText>
        <Counter
          label={t('workout.logger.sets')}
          value={sets}
          step={1}
          onChange={(v) => setSets(Math.max(1, Math.min(6, v)))}
        />
        {item.reps ? (
          <View style={styles.repsRow}>
            <AppText variant="label" style={styles.flex}>
              {t('workout.logger.reps')}
            </AppText>
            <IconButton
              icon="minus"
              variant="outlined"
              accessibilityLabel={t('workout.player.decrease', { label: t('workout.logger.reps') })}
              onPress={() => shift(-1)}
            />
            <AppText variant="h2" style={styles.num}>
              {rangeText(reps)}
            </AppText>
            <IconButton
              icon="plus"
              variant="outlined"
              accessibilityLabel={t('workout.player.increase', { label: t('workout.logger.reps') })}
              onPress={() => shift(1)}
            />
          </View>
        ) : null}
        <AppText variant="label" color={colors.mutedStrong}>
          {t('workout.logger.applyTo')}
        </AppText>
        <View style={styles.effort} accessibilityRole="radiogroup">
          {(['plan', 'this'] as const).map((s) => (
            <Chip
              key={s}
              label={t(s === 'plan' ? 'workout.logger.applyPlan' : 'workout.logger.applyThis')}
              selected={scope === s}
              accessibilityRole="radio"
              accessibilityState={{ checked: scope === s }}
              onPress={() => setScope(s)}
            />
          ))}
        </View>
        <View style={styles.sheetButtons}>
          <View style={styles.flex}>
            <Button variant="secondary" label={t('workout.logger.discard')} onPress={onClose} />
          </View>
          <View style={styles.flex}>
            <Button
              label={t('workout.logger.doneButton')}
              onPress={() =>
                onApply({ sets, ...(item.reps ? { reps } : { reps: item.reps ?? reps }) }, scope)
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Between exercises (Phase 31, D): the next exercise with its max load and
 * suggested sets, dimmed, before "Start exercise".
 */
export function NextPreview({
  workout,
  item,
  exercise,
  onStart,
}: {
  workout: WorkoutRecord;
  item: SessionItem;
  exercise: Exercise | undefined;
  onStart: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const workouts = useWorkoutStore((s) => s.workouts);
  const units = useOnboardingStore((s) => s.units);
  const mode = useOnboardingStore((st) => modeOf(st));
  const unit: LoadUnit = units === 'imperial' ? 'lb' : 'kg';
  const unitLabel = t(`workout.units.${unit}`);
  const generator = useWorkout(workout.id).input;
  const minor = mode === 'child' || mode === 'teen';
  const loaded = !!exercise?.loaded && item.loadHint !== 'bodyweight' && !minor;
  const smartLoads = usePrefsStore((st) => st.smartLoads);
  const advice =
    generator && !workout.session.program && smartLoads
      ? adviceForItem({ workouts, workoutId: workout.id, item, exercise, unit, generator })
      : null;
  const load = loaded ? adviceLoad(advice) : null;
  const range = targetRange(item) ?? [8, 12];
  const records = loaded ? exerciseRecords(workouts, item.exerciseId, unit) : null;
  const points = (records?.sessions ?? [])
    .map((s) => s.bestLoad ?? 0)
    .filter((v) => v > 0)
    .slice(-8);
  return (
    <View style={styles.stack} testID="next-preview">
      <View style={styles.previewTop}>
        <TextLink label={t('workout.logger.close')} onPress={onStart} />
      </View>
      <ExerciseHeader exercise={exercise} item={item} />
      {points.length && mode === 'adult' ? (
        <MaxLoadChart points={points} goal={load} unitLabel={unitLabel} />
      ) : null}
      <View style={styles.sets}>
        {Array.from({ length: item.sets }, (_, n) => (
          <View key={n} style={styles.futureRow}>
            <AppText variant="caption" color={colors.muted} style={styles.setLabel}>
              {t('workout.logger.setRow', { n: n + 1 })}
            </AppText>
            <AppText color={colors.muted} style={styles.flex}>
              {[
                load ? `${load} ${unitLabel}` : null,
                t('workout.logger.repsValue', { count: range[0] }),
              ]
                .filter(Boolean)
                .join(' | ')}
            </AppText>
          </View>
        ))}
      </View>
      <Button
        variant="accent"
        label={t('workout.logger.startExercise')}
        onPress={onStart}
        testID="start-exercise"
      />
    </View>
  );
}

/** "Exercises" in the player (Phase 31, D): jump to another exercise. */
export function ExercisesSheet({
  workout,
  byId,
  onClose,
  onPick,
}: {
  workout: WorkoutRecord;
  byId: Map<string, Exercise>;
  onClose: () => void;
  onPick?: (itemId: string) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const setFocus = useWorkoutStore((s) => s.setFocus);
  const mains = workout.session.items.filter((i) => i.role === 'main' && i.part !== 'ramp_up');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
        testID="exercises-sheet"
      >
        <View style={styles.repsRow}>
          <AppText variant="h2" accessibilityRole="header" style={styles.flex}>
            {t('workout.logger.exercises')}
          </AppText>
          <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.sets}>
          {mains.map((m) => {
            const e = byId.get(m.exerciseId);
            const done = workout.logs.filter((l) => l.itemId === m.id).length;
            const skipped = workout.skipped.includes(m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                disabled={skipped || done >= m.sets}
                onPress={() => {
                  setFocus(workout.id, m.id);
                  onPick?.(m.id);
                  onClose();
                }}
                style={styles.loggedRow}
                testID="exercises-row"
              >
                <ExerciseThumb size={44} slug={e?.slug} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {exerciseName(t, e, m.exerciseId)}
                </AppText>
                <AppText
                  variant="caption"
                  color={done >= m.sets ? colors.teal : colors.mutedStrong}
                >
                  {t('workout.logger.setsDone', { done, total: m.sets })}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * The program's load note (Phase 30, §3): raise only after two sessions in a
 * row "easy and painless", then back to fewer reps; never after "I feel pain"
 * this week. The first time: start with the lightest band or 0.5–1 kg.
 */
function ProgramLoadNote({
  programId,
  exercise,
  workoutId,
  loaded,
  onRaised,
}: {
  programId: string;
  exercise: Exercise;
  workoutId: string;
  loaded: boolean;
  onRaised: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const workouts = useWorkoutStore((s) => s.workouts);
  const raised = useRehabStore((s) => s.runs[programId]?.increased[exercise.slug] ?? 0);
  const raiseLoad = useRehabStore((s) => s.raiseLoad);
  const [done, setDone] = useState(false);
  const def = programById(programId)?.exercises.find((e) => e.slug === exercise.slug);
  const others = workouts.filter((w) => w.id !== workoutId);
  const first = !others.some((w) => w.logs.some((l) => l.exerciseId === exercise.id));
  const advice = programLoadAdvice({ workouts: others, programId, exercise, now: clock.now() });
  const fewer = def?.dose.kind === 'reps' ? def.dose.afterIncrease.reps[0] : null;
  if (done)
    return (
      <AppText variant="caption" color={colors.teal}>
        {t('rehab.load.raised', { reps: fewer ?? '' })}
      </AppText>
    );
  if (advice.kind === 'raise')
    return (
      <View style={{ gap: spacing.xs }} testID="program-load-raise">
        <AppText variant="caption" color={colors.teal}>
          {t(loaded ? 'rehab.load.raise' : 'rehab.load.raiseBand', { reps: fewer ?? '' })}
        </AppText>
        <Button
          variant="secondary"
          label={t(loaded ? 'rehab.load.raiseButton' : 'rehab.load.raiseBandButton')}
          onPress={() => {
            raiseLoad(programId, exercise.slug);
            setDone(true);
            onRaised();
          }}
        />
      </View>
    );
  if (advice.reason === 'pain')
    return (
      <AppText variant="caption" color={colors.mutedStrong} testID="program-load-pain">
        {t('rehab.load.pain')}
      </AppText>
    );
  return (
    <AppText variant="caption" color={colors.mutedStrong}>
      {first && !raised ? t('rehab.load.start') : t('rehab.load.easyHint')}
    </AppText>
  );
}

export function Counter({
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
    <View style={styles.repsRow}>
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
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  caps: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingSemi },
  counters: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  counterCell: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  muscleChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.xxs,
  },
  warmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.primarySoft,
  },
  sets: { gap: spacing.xs },
  setLabel: { minWidth: 64 },
  loggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  currentRow: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  currentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  futureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.sm,
    opacity: 0.6,
  },
  adjust: { gap: spacing.sm },
  effort: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { gap: spacing.sm },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  previewTop: { flexDirection: 'row', justifyContent: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    padding: spacing.xl,
    gap: spacing.md,
  },
  repsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  counterValue: { minWidth: 64, alignItems: 'center', borderRadius: radius.button },
  sheetButtons: { flexDirection: 'row', gap: spacing.sm },
}));
