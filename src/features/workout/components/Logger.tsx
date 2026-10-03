import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Icon, IconButton, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import type { SessionItem } from '@/features/generator/types';
import { epley, exerciseRecords, type SessionPoint } from '@/features/library/performance';
import { muscleByKey } from '@/features/muscles';
import { modeOf } from '@/features/onboarding/derived';
import { muscleLabel } from '@/features/onboarding/summaries';
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
  // New bests in this workout, adults only (Phase 31, G): "🏆 2".
  const others = useWorkoutStore((st) => st.workouts).filter((w) => w.id !== workout.id);
  const records = showVolume
    ? mainLogs.filter((l) => {
        if (!l.load) return false;
        const best = bestsOf(others, l.exerciseId, unit).load;
        return best > 0 && convertLoad(l.load, l.unit ?? unit, unit) > best;
      }).length
    : 0;
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
    ...(records
      ? [{ key: 'records', label: t('workout.logger.records'), value: `🏆 ${records}` }]
      : []),
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
          {/* The muscle chip in its group's colour (Phase 31, G). */}
          <View
            style={[
              styles.muscleChip,
              {
                backgroundColor:
                  colors.group[muscleByKey(item.targetMuscle ?? '')?.movementGroup ?? 'push'],
              },
            ]}
            testID="muscle-chip"
          >
            <AppText variant="caption" color={colors.onGroup} style={styles.caps}>
              {item.targetMuscle
                ? muscleLabel(t, item.targetMuscle)
                : targetText(t, item, exercise)}
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
      ...(programItem && rpe ? { rpe } : {}),
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
  const heaviestSet = (() => {
    const top = (records?.sessions ?? []).reduce<SessionPoint | null>(
      (m, x) => ((x.bestLoad ?? 0) > (m?.bestLoad ?? 0) ? x : m),
      null,
    );
    return top?.bestLoad ? { load: top.bestLoad, reps: top.bestReps, date: top.date } : null;
  })();
  const doseLine = hold
    ? t('workout.logger.nextHold', { count: item.sets, range: rangeText(shown) })
    : t('plan.badge', { count: item.sets, reps: rangeText(shown) });

  // Records of a logged set against every other workout (adults only).
  const others = workouts.filter((w) => w.id !== workout.id);
  const before = loaded && !minor ? bestsOf(others, item.exerciseId, unit) : null;
  const prsOf = (l: SetLog, isLastLogged: boolean): string[] => {
    if (!before || !l.load || mode !== 'adult') return [];
    const kg = convertLoad(l.load, l.unit ?? unit, unit);
    const out: string[] = [];
    if (before.load > 0 && kg > before.load) out.push(t('workout.logger.prLoad'));
    if (before.oneRm > 0 && epley(kg, l.reps ?? 0) > before.oneRm)
      out.push(t('workout.logger.prOneRm'));
    if (isLastLogged && before.volume > 0) {
      const volume = logsOf.reduce(
        (n, x) => n + (x.load ? convertLoad(x.load, x.unit ?? unit, unit) * (x.reps ?? 0) : 0),
        0,
      );
      if (volume > before.volume) out.push(t('workout.logger.prVolume'));
    }
    return out;
  };
  const tip = [
    loaded && exercise?.equipment.includes('barbell') ? t('workout.logger.barPlates') : null,
    loaded && exercise?.equipment.includes('dumbbells')
      ? item.perSide || exercise?.unilateral
        ? t('workout.logger.oneDumbbellOneSide')
        : t('workout.logger.oneDumbbell')
      : null,
  ].find(Boolean);
  const lastLogged = logsOf.reduce((m, l) => Math.max(m, l.setNo), 0);
  const allLogged = logsOf.length >= item.sets;
  const rated = logsOf.some((l) => l.rpe != null);
  const askRir = !programItem && !hold && logsOf.length > 0 && !minor;

  return (
    <View style={styles.stack}>
      {points.length && mode === 'adult' ? (
        <MaxLoadChart
          points={points}
          goal={goal ?? adviceLoad(advice)}
          unitLabel={unitLabel}
          best={heaviestSet}
        />
      ) : null}

      {ramp ? (
        // The exercise's warm-up sets: one filled coral card, "Done" on the side.
        <View style={styles.warmCard} testID="ramp-card">
          <View style={styles.warmText}>
            <AppText variant="h2" color={colors.onAccent}>
              {t('workout.logger.warmupTitle')}
            </AppText>
            <AppText variant="bodyStrong" color={colors.onAccent}>
              {rampScheme(t, ramp, !!exercise?.equipment.includes('barbell'))}
            </AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('workout.ramp.skip')}
              onPress={() => skipItem(workout.id, ramp.id)}
            >
              <AppText variant="caption" color={colors.onAccent} style={styles.underline}>
                {t('workout.ramp.skip')}
              </AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.logger.did')}
            onPress={doRamp}
            style={styles.action}
            testID="ramp-done"
          >
            <AppText variant="bodyStrong" color={colors.onAccent}>
              {t('workout.logger.did')}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      <AppText variant="bodyStrong" color={colors.accentText} testID="logger-next">
        {t('workout.logger.next', { dose: doseLine })}
      </AppText>

      <View style={styles.sets} testID="logger-sets">
        {Array.from({ length: item.sets }, (_, n) => n + 1).map((setNo) => {
          const logged = logsOf.find((l) => l.setNo === setNo);
          const split = sideSet(item, setNo);
          const sideLabel = split
            ? t('rehab.player.sideSet', {
                side: t(`rehab.side.${split.side}`),
                n: split.n,
                total: split.total,
              })
            : null;
          const label = sideLabel ?? t('workout.logger.setRow', { n: setNo });
          if (logged) {
            const prs = prsOf(logged, setNo === lastLogged);
            return (
              <View key={setNo} style={[styles.setCard, styles.filled]} testID="set-logged">
                <View style={styles.setMain}>
                  <View style={styles.setCols} accessible accessibilityLabel={label}>
                    {loadShown(logged) ? (
                      <SetValue big={big} value={loadShown(logged)!} tone="onAccent" />
                    ) : null}
                    <SetValue
                      big={big}
                      value={
                        logged.seconds != null && logged.reps == null
                          ? t('workout.logger.seconds', { count: logged.seconds })
                          : t('workout.logger.repsValue', { count: logged.reps ?? 0 })
                      }
                      tone="onAccent"
                      divider={!!loadShown(logged)}
                    />
                  </View>
                  {prs.map((pr) => (
                    <View key={pr} style={styles.prRow} testID="set-pr">
                      <Icon name="trophy" size={16} color={colors.onAccent} />
                      <AppText variant="bodyStrong" color={colors.onAccent}>
                        {pr}
                      </AppText>
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workout.logger.redoA11y', { set: label })}
                  onPress={() => unlogSet(workout.id, item.id, setNo)}
                  style={styles.action}
                >
                  <Icon name="check" size={22} color={colors.onAccent} />
                  <AppText variant="bodyStrong" color={colors.onAccent}>
                    {t('workout.logger.redo')}
                  </AppText>
                </Pressable>
              </View>
            );
          }
          if (setNo === current) {
            const prev = lastLog(setNo);
            const repsLine = hold
              ? t('workout.logger.secondsRange', { range: rangeText(shown) })
              : t('workout.logger.repsRange', { range: rangeText(shown) });
            return (
              <View key={setNo} style={styles.currentWrap}>
                <View style={[styles.setCard, styles.filled]} testID="set-current">
                  <View style={styles.setMain}>
                    {sideLabel ? (
                      <AppText variant="caption" color={colors.onAccent} style={styles.caps}>
                        {sideLabel}
                      </AppText>
                    ) : null}
                    <View style={styles.setCols}>
                      {loaded ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('workout.logger.adjustLoad')}
                          onPress={() => setAdjust((v) => !v)}
                          style={styles.col}
                          testID="current-load"
                        >
                          <AppText variant="caption" color={colors.onAccent}>
                            {t('workout.logger.suggestedNoLast')}
                          </AppText>
                          <AppText variant={big} color={colors.onAccent} style={styles.num}>
                            {loadText}
                          </AppText>
                          {prev?.load ? (
                            <AppText variant="caption" color={colors.onAccent}>
                              {t('workout.logger.lastValue', { value: loadShown(prev) ?? '' })}
                            </AppText>
                          ) : null}
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workout.logger.adjustReps')}
                        onPress={() => setAdjust((v) => !v)}
                        style={[styles.col, loaded && styles.colDivider]}
                        testID="current-reps"
                      >
                        <AppText variant="caption" color={colors.onAccent}>
                          {t('workout.logger.now', { value: reps })}
                        </AppText>
                        <AppText variant={big} color={colors.onAccent} style={styles.num}>
                          {repsLine}
                        </AppText>
                        {prev?.reps ? (
                          <AppText variant="caption" color={colors.onAccent}>
                            {t('workout.logger.lastValue', { value: prev.reps })}
                          </AppText>
                        ) : null}
                      </Pressable>
                    </View>
                    {goal ? (
                      <View style={styles.goalPill} testID="logger-goal">
                        <Icon name="trophy" size={16} color={colors.onAccent} />
                        <AppText variant="bodyStrong" color={colors.onAccent}>
                          {t('workout.logger.goal', { load: `${goal} ${unitLabel}` })}
                        </AppText>
                      </View>
                    ) : tip ? (
                      <AppText variant="bodyStrong" color={colors.onAccent}>
                        {tip}
                      </AppText>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('workout.logger.didA11y')}
                    onPress={() => log(setNo, true)}
                    style={[styles.action, senior && styles.actionBig]}
                    testID="set-done"
                  >
                    <AppText variant={senior ? 'h3' : 'bodyStrong'} color={colors.onAccent}>
                      {t('workout.logger.did')}
                    </AppText>
                  </Pressable>
                </View>
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
                {programItem ? (
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
            <View key={setNo} style={[styles.setCard, styles.future]} testID="set-future">
              <View style={styles.setMain}>
                <View style={styles.setCols} accessible accessibilityLabel={label}>
                  {loaded && load ? (
                    <View style={styles.col}>
                      <AppText variant="caption" color={colors.muted}>
                        {t('workout.logger.suggestedNoLast')}
                      </AppText>
                      <AppText variant={big} color={colors.muted} style={styles.num}>
                        {loadText}
                      </AppText>
                    </View>
                  ) : null}
                  <View style={[styles.col, loaded && !!load && styles.colDividerMuted]}>
                    <AppText variant={big} color={colors.muted} style={styles.num}>
                      {hold
                        ? t('workout.logger.secondsRange', { range: rangeText(shown) })
                        : t('workout.logger.repsRange', { range: rangeText(shown) })}
                    </AppText>
                  </View>
                </View>
              </View>
              <View style={[styles.action, styles.actionMuted]}>
                <Icon name="play" size={22} color={colors.muted} />
              </View>
            </View>
          );
        })}
      </View>

      {askRir && !rated ? (
        // One question per exercise instead of a chip per set (Phase 31, G).
        <View style={styles.rir} testID="rir-card">
          <AppText variant="bodyStrong" style={styles.centerText}>
            {t('workout.logger.rirQuestion')}
          </AppText>
          <View style={styles.rirRow} accessibilityRole="radiogroup">
            {RIR.map(([label, value]) => (
              <Pressable
                key={label}
                accessibilityRole="radio"
                accessibilityLabel={
                  label === '3+'
                    ? t('workout.logger.rirOptionMore')
                    : t('workout.logger.rirOption', { count: Number(label) })
                }
                onPress={() => useWorkoutStore.getState().rateItem(workout.id, item.id, value)}
                style={styles.rirButton}
              >
                <AppText variant="bodyStrong">{label}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {!allLogged ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.logger.logAll')}
            onPress={logAll}
            style={styles.logAll}
          >
            <AppText variant="bodyStrong" color={colors.mutedStrong}>
              {t('workout.logger.logAll')}
            </AppText>
          </Pressable>
        ) : null}
        {!program ? (
          <TextLink
            label={t('workout.logger.customize')}
            accessibilityRole="button"
            onPress={() => setCustomize(true)}
          />
        ) : null}
        {onMachineTaken ? (
          <TextLink
            label={t('workout.machineTaken')}
            accessibilityRole="button"
            onPress={onMachineTaken}
          />
        ) : null}
      </View>

      {nextMain ? (
        <View style={styles.section}>
          <AppText variant="bodyStrong" color={colors.accentText}>
            {t('workout.logger.nextExercise')}
          </AppText>
          <View style={styles.nextCard} testID="logger-next-exercise">
            <ExerciseThumb size={64} slug={nextExercise?.slug} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">
                {exerciseName(t, nextExercise, nextMain.exerciseId)}
              </AppText>
              <AppText color={colors.mutedStrong}>
                {nextMain.reps
                  ? t('plan.badge', { count: nextMain.sets, reps: rangeText(nextMain.reps) })
                  : t('workout.logger.nextHold', {
                      count: nextMain.sets,
                      range: rangeText(nextMain.holdSeconds ?? [30, 30]),
                    })}
              </AppText>
            </View>
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

/** "How many more reps could you do?": 0 → very hard … 3+ → easy (RPE). */
const RIR: [string, number][] = [
  ['0', 10],
  ['1', 9],
  ['2', 8],
  ['3+', 7],
];

/** Best load, estimated 1RM and session volume of an exercise in these workouts. */
function bestsOf(workouts: WorkoutRecord[], exerciseId: string, unit: LoadUnit) {
  let load = 0;
  let oneRm = 0;
  let volume = 0;
  for (const w of workouts) {
    let v = 0;
    for (const l of w.logs) {
      if (l.exerciseId !== exerciseId || !l.load) continue;
      const kg = convertLoad(l.load, l.unit ?? unit, unit);
      load = Math.max(load, kg);
      oneRm = Math.max(oneRm, epley(kg, l.reps ?? 0));
      v += kg * (l.reps ?? 0);
    }
    volume = Math.max(volume, v);
  }
  return { load, oneRm, volume };
}

/** One column of a set card: a big number with its caption. */
function SetValue({
  value,
  big,
  tone,
  divider = false,
}: {
  value: string;
  big: 'h1' | 'h2';
  tone: 'onAccent' | 'muted';
  divider?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.col, divider && styles.colDivider]}>
      <AppText
        variant={big}
        color={tone === 'onAccent' ? colors.onAccent : colors.muted}
        style={styles.num}
      >
        {value}
      </AppText>
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
  const previewLoad = `${load} ${unitLabel}`;
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
        <MaxLoadChart points={points} goal={load} unitLabel={unitLabel} best={null} />
      ) : null}
      <View style={styles.sets}>
        {Array.from({ length: item.sets }, (_, n) => (
          <View key={n} style={[styles.setCard, styles.future]} testID="preview-set">
            <View style={styles.setMain}>
              <View style={styles.setCols}>
                {load ? (
                  <View style={styles.col}>
                    <AppText variant="caption" color={colors.muted}>
                      {t('workout.logger.suggestedNoLast')}
                    </AppText>
                    <AppText variant="h2" color={colors.muted} style={styles.num}>
                      {previewLoad}
                    </AppText>
                  </View>
                ) : null}
                <View style={[styles.col, !!load && styles.colDividerMuted]}>
                  <AppText variant="h2" color={colors.muted} style={styles.num}>
                    {t('workout.logger.repsRange', { range: rangeText(range) })}
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
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
    marginTop: spacing.xxs,
  },
  warmCard: {
    flexDirection: 'row',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.accent,
  },
  warmText: { flex: 1, gap: spacing.xs, padding: spacing.lg },
  underline: { textDecorationLine: 'underline' },
  setCard: { flexDirection: 'row', borderRadius: radius.card, overflow: 'hidden', minHeight: 72 },
  filled: { backgroundColor: colors.accent },
  future: { backgroundColor: colors.sunken },
  setMain: { flex: 1, justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  setCols: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  colDivider: { borderLeftWidth: 1, borderLeftColor: colors.onAccent },
  colDividerMuted: { borderLeftWidth: 1, borderLeftColor: colors.line },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.sm },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.chip,
    backgroundColor: colors.accentPressed,
  },
  action: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderLeftWidth: 1,
    borderLeftColor: colors.onAccent,
  },
  actionBig: { width: 104 },
  actionMuted: { borderLeftColor: colors.line },
  currentWrap: { gap: spacing.sm },
  rir: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.sunken,
  },
  rirRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  rirButton: {
    minWidth: 64,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizes.touchTarget / 2,
    borderWidth: 1,
    borderColor: colors.mutedStrong,
  },
  centerText: { textAlign: 'center' },
  logAll: {
    alignSelf: 'center',
    minWidth: 200,
    minHeight: sizes.touchTarget + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.sunken,
  },
  section: { gap: spacing.sm },
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
  actions: { gap: spacing.md, alignItems: 'center' },
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
