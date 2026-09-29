import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Chip, Icon, IconButton, Notice, Screen } from '@/components/ui';
import { canStartWorkout, currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import type { Exercise } from '@/features/exercises/types';
import { dayName, sessionSummary } from '@/features/program/block';
import { WeekStrip } from '@/features/program/components/WeekStrip';
import { usePlacesStore } from '@/features/equipment/store';
import { adviceForItem, advisedReps, loadText } from '@/features/workout/loads';
import type { LoadUnit } from '@/features/workout/types';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import {
  generateSession,
  MOBILITY_MINUTES,
  withAddedExercises,
  swapItem,
  withOneMoreExercise,
} from '@/features/generator';
import type { GeneratorNote, SessionItem } from '@/features/generator/types';
import { muscleLabel } from '@/features/onboarding/summaries';
import { RangeNote } from '@/features/movement/RangeNote';
import { ExerciseThumb, Tag } from '@/features/workout/components/Media';
import {
  machineItems,
  SwapSheet,
  type SwapReasonUi,
} from '@/features/workout/components/SwapSheet';
import { UndoBar } from '@/features/workout/components/UndoBar';
import {
  blockMinutes,
  doseLine,
  durationText,
  exerciseName,
  targetText,
} from '@/features/workout/format';
import { createMobilityWorkout, useSafetyRefresh, useWorkout } from '@/features/workout/hooks';
import { isReviewed } from '@/features/workout/plan';
import { useWorkoutStore } from '@/features/workout/store';
import { useTodayState } from '@/features/workout/useTodayState';
import { track } from '@/lib/analytics';
import { restFor, usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

const SHORT_MINUTES = 15;

type SheetState = { itemId: string | null; reason: SwapReasonUi } | null;

/** Mockup 10 — the generated workout (SPEC §9 /workout/[id]). */
export default function WorkoutScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const prefs = usePrefsStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, byId, input, library } = useWorkout(id);
  // No generator input yet: the restrictive fallback, never adult (QA R8-02).
  const birthMonth = useOnboardingStore((st) => st.birthMonth);
  const birthYear = useOnboardingStore((st) => st.birthYear);
  const mode = input?.mode ?? modeOf({ birthMonth, birthYear });
  const weightKg = useOnboardingStore((st) => st.weightKg);
  const units = useOnboardingStore((st) => st.units);
  const { places, activeId: activePlace, use: choosePlace } = usePlacesStore();
  useSafetyRefresh(workout?.id, input, library);
  const store = useWorkoutStore();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const clearUndo = useCallback(() => setUndoMessage(null), []);
  const today = useTodayState();
  // "+1 exercise?" (Daniel's rule, QA R9): only on an untouched planned
  // workout, never on the day's second workout; built once per session
  // (it runs the generator).
  const planned0 = workout?.status === 'planned';
  const oneMore = useMemo(
    () =>
      workout &&
      input &&
      planned0 &&
      workout.kind === 'regular' &&
      !workout.swaps.length &&
      !workout.fullSession &&
      !today.doneToday
        ? withOneMoreExercise(input, workout.session)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      workout?.session,
      workout?.swaps.length,
      workout?.fullSession,
      planned0,
      today.doneToday,
      input,
    ],
  );

  if (!workout || !input) {
    // Honest reason, with a way forward (QA C-03): "under review" only when
    // there really is no library.
    const reason = !library.length
      ? 'no_library'
      : !input
        ? 'no_profile'
        : (generateSession(input).error ?? 'gone');
    return (
      <Screen
        footer={
          <>
            {reason === 'all_recovering' ? (
              // Everything is recovering: a short mobility session or a rest day (QA R2-08).
              <Button
                variant="accent"
                label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
                onPress={() => {
                  const next = createMobilityWorkout(input);
                  if (next) router.replace({ pathname: '/workout/[id]', params: { id: next } });
                }}
              />
            ) : reason !== 'no_library' ? (
              <Button
                variant="secondary"
                label={t('workout.unavailable.editPlan')}
                onPress={() => router.push('/onboarding/profile')}
              />
            ) : null}
            <Button
              variant={reason === 'all_recovering' ? 'secondary' : 'primary'}
              label={reason === 'all_recovering' ? t('workout.restDay') : t('workout.backHome')}
              onPress={() => router.replace('/home')}
            />
          </>
        }
      >
        <AppText variant="h1" accessibilityRole="header">
          {t('workout.title')}
        </AppText>
        <Notice icon>
          {reason === 'no_library' ? t('workout.underReview') : t(`workout.unavailable.${reason}`)}
        </Notice>
      </Screen>
    );
  }

  const { session } = workout;
  const warm = session.items.filter((i) => i.role === 'warmup');
  const main = session.items.filter((i) => i.role === 'main' || i.role === 'finisher');
  const cool = session.items.filter((i) => i.role === 'cooldown');
  const planned = workout.status === 'planned';
  const machines = machineItems(workout, byId);
  const reviewed = isReviewed(session, library);

  const note = (n: GeneratorNote) => {
    if (n.key === 'generator.notes.balance') {
      return t(n.key, { groups: n.groups.map((g) => t(`generator.notes.groups.${g}`)).join(', ') });
    }
    if (
      n.key === 'generator.notes.rested' ||
      n.key === 'generator.notes.substituted' ||
      n.key === 'generator.notes.recovering' ||
      n.key === 'generator.notes.unavailable' ||
      n.key === 'generator.notes.painToday' ||
      n.key === 'generator.notes.trimmedMuscles'
    ) {
      return t(n.key, { muscles: n.muscles.map((m) => muscleLabel(t, m)).join(', ') });
    }
    if (n.key === 'generator.notes.customLeftOut') return t(n.key, { count: n.count });
    return t(n.key);
  };

  // "3 × 10–12 · 25 lb" (A4): the suggested load from the person's history.
  const unit: LoadUnit = units === 'imperial' ? 'lb' : 'kg';
  const adviceFor = (item: SessionItem, e: Exercise | undefined) =>
    adviceForItem({
      workouts: store.workouts,
      workoutId: workout.id,
      item,
      exercise: e,
      unit,
      generator: { ...input, deload: session.deload },
    });
  const loadLabel = (item: SessionItem, e: Exercise | undefined) =>
    loadText(adviceFor(item, e), t(`workout.units.${unit}`));
  const easierFor = (item: SessionItem, e: Exercise | undefined) => {
    const a = item.role === 'main' ? adviceFor(item, e) : null;
    return a?.kind === 'load' && !!a.easier;
  };
  // "3 × 16" on a "+1 rep" day, not the range (QA R7 P2).
  const doseFor = (item: SessionItem, e: Exercise | undefined) => {
    const aim = item.reps ? advisedReps(adviceFor(item, e)) : null;
    return doseLine(t, aim ? { ...item, reps: [aim, aim] } : item, restFor(item, prefs));
  };

  // Adults and 60+ only; never teens (improvements v1, A3).
  const kcal = sessionSummary(session, mode, weightKg).kcal;

  // "Only 15 min" keeps the swaps already made and can be undone (QA P2).
  const onlyFifteen = () => {
    let short = generateSession({ ...input, minutes: SHORT_MINUTES });
    if (short.error) return;
    for (const swap of workout.swaps) {
      const item = short.items.find((i) => i.exerciseId === swap.fromExerciseId);
      const to = byId.get(swap.toExerciseId);
      if (item && to) short = swapItem(short, item.id, to, input, { reason: swap.reason }).session;
    }
    store.shorten(workout.id, short);
  };

  const start = () => {
    if (planned) {
      // Free plan: 3 workouts a week (SPEC §8); the finisher does not count.
      const check =
        workout.kind === 'regular'
          ? canStartWorkout(
              currentPlan(useBillingStore.getState().entitlement, clock.now()),
              store.workouts,
              clock.now(),
              deviceWeekStart(),
            )
          : ({ allowed: true } as const);
      if (!check.allowed) {
        router.push({ pathname: '/paywall', params: { next: check.nextFreeDay } });
        return;
      }
      store.start(workout.id);
      track('workout_started');
    }
    router.push({ pathname: '/workout/[id]/play', params: { id: workout.id } });
  };

  const swapButton = (item: SessionItem, e: Exercise | undefined) =>
    item.part === 'ramp_up' || workout.skipped.includes(item.id) ? null : (
      <IconButton
        icon="swap"
        variant="outlined"
        accessibilityLabel={t('workout.swap.open', { name: exerciseName(t, e, item.exerciseId) })}
        onPress={() => setSheet({ itemId: item.id, reason: 'user_choice' })}
      />
    );

  const phaseCard = (
    items: SessionItem[],
    titleKey: 'workout.warmup' | 'workout.cooldown',
    minutes: number,
  ) => (
    <Card tone="safety" style={styles.phase}>
      <AppText variant="h3" color={colors.teal}>
        {t(titleKey, { minutes })}
      </AppText>
      {items.map((item) => {
        const e = byId.get(item.exerciseId);
        return (
          <View key={item.id} style={styles.phaseRow}>
            {/* Every item has a demo, warm-up and cool-down too (QA O-2). */}
            <ExerciseThumb size={44} />
            <View style={styles.rowText}>
              <AppText variant="bodyStrong">{exerciseName(t, e, item.exerciseId)}</AppText>
              {e?.custom ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('library.notReviewed')}
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.mutedStrong}>
                {item.part === 'ramp_up'
                  ? t('workout.rampUp', { count: item.sets })
                  : item.durationSeconds
                    ? durationText(t, item.durationSeconds)
                    : doseLine(t, item, restFor(item, prefs))}
              </AppText>
              <RangeNote exercise={e} />
            </View>
            {swapButton(item, e)}
          </View>
        );
      })}
    </Card>
  );

  return (
    <Screen
      header={
        <View style={styles.header}>
          <View style={styles.rowText}>
            <AppText variant="h1" accessibilityRole="header">
              {t('workout.title')}
            </AppText>
            <AppText variant="caption" color={colors.muted} style={styles.caps}>
              {[
                t(`program.day.${dayName(session, library, workout.kind)}`),
                t('workout.summary', {
                  minutes: session.estimatedMinutes,
                  count: session.items.filter((i) => i.role === 'main').length,
                }),
                kcal ? t('program.kcal', { kcal }) : null,
                session.deload ? t('workout.deload') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          <IconButton
            icon="close"
            variant="outlined"
            accessibilityLabel={t('common.close')}
            onPress={() => router.replace('/home')}
          />
        </View>
      }
      footer={
        <>
          <UndoBar message={undoMessage} onDone={clearUndo} />
          <Button
            variant="accent"
            label={planned ? t('workout.startWarmup') : t('workout.continue')}
            onPress={start}
          />
        </>
      }
    >
      {workout.kind === 'regular' ? <WeekStrip /> : null}
      {/* Saved places (improvements v1, C2): switch equipment for a planned workout. */}
      {planned && workout.kind === 'regular' && places.length > 1 ? (
        <View style={styles.places}>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('equipmentSettings.switchTitle')}
          </AppText>
          <View style={styles.placeChips}>
            {places.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={activePlace === p.id}
                onPress={() => {
                  choosePlace(p.id);
                  const placeInput = { ...input, equipment: p.items, location: p.location };
                  const next = generateSession(placeInput);
                  // The exercises added with "+1" come along (QA R9 P2).
                  if (!next.error)
                    store.replaceSession(
                      workout.id,
                      withAddedExercises(placeInput, next, session.addedExercises ?? 0),
                    );
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      {/* Spare time (Daniel, Phases 13 and 21): at the top of the list, the
          real estimate against the chosen time; the person decides. */}
      {oneMore ? (
        <Card style={styles.spare} testID="one-more">
          <AppText variant="bodyStrong">
            {t('workout.spare.long', {
              estimate: session.estimatedMinutes,
              minutes: session.minutes,
            })}
          </AppText>
          <Button
            variant="accent"
            label={t('workout.spare.add')}
            accessibilityHint={t('workout.spare.long', {
              estimate: session.estimatedMinutes,
              minutes: session.minutes,
            })}
            onPress={() => store.replaceSession(workout.id, oneMore)}
          />
        </Card>
      ) : null}
      {session.notes.map((n) => (
        <View key={n.key} style={styles.coachNote}>
          <AppText color={colors.mutedStrong}>{note(n)}</AppText>
        </View>
      ))}

      {phaseCard(warm, 'workout.warmup', blockMinutes(warm))}

      {main.map((item) => {
        const e = byId.get(item.exerciseId);
        const skipped = workout.skipped.includes(item.id);
        return (
          <Card key={item.id} style={[styles.exercise, skipped && styles.skipped]}>
            <ExerciseThumb />
            <View style={styles.rowText}>
              <AppText variant="bodyStrong">{exerciseName(t, e, item.exerciseId)}</AppText>
              {e?.custom ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('library.notReviewed')}
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.mutedStrong}>
                {skipped
                  ? t('workout.skipped')
                  : [doseFor(item, e), loadLabel(item, e)].filter(Boolean).join(' · ')}
              </AppText>
              {/* The same hint as the player, on the list too (QA R8 P2). */}
              {!skipped && easierFor(item, e) ? (
                <AppText variant="caption" color={colors.mutedStrong}>
                  {t('load.easier')}
                </AppText>
              ) : null}
              <RangeNote exercise={e} />
              <Tag
                label={targetText(t, item, e)}
                tone={item.role === 'finisher' ? 'teal' : 'accent'}
              />
            </View>
            {swapButton(item, e)}
          </Card>
        );
      })}

      {phaseCard(cool, 'workout.cooldown', blockMinutes(cool))}

      <View style={styles.actions}>
        {planned && session.minutes > SHORT_MINUTES ? (
          <View style={styles.action}>
            <Button variant="secondary" label={t('workout.only15')} onPress={onlyFifteen} />
          </View>
        ) : null}
        {planned && workout.fullSession ? (
          <View style={styles.action}>
            <Button
              variant="secondary"
              label={t('workout.backToFull')}
              onPress={() => store.restoreFull(workout.id)}
            />
          </View>
        ) : null}
        {machines.length ? (
          <View style={styles.action}>
            <Button
              variant="secondary"
              label={t('workout.machineTaken')}
              onPress={() =>
                setSheet({
                  itemId: machines.length === 1 ? machines[0].id : null,
                  reason: 'machine_taken',
                })
              }
            />
          </View>
        ) : null}
      </View>

      <View style={styles.badge}>
        <Icon name="shield" size={20} color={reviewed ? colors.teal : colors.accentText} />
        <AppText
          variant="caption"
          color={reviewed ? colors.teal : colors.accentText}
          style={styles.rowText}
        >
          {reviewed ? t('workout.reviewed') : t('workout.draftBadge')}
        </AppText>
      </View>

      {sheet ? (
        <SwapSheet
          visible
          workout={workout}
          itemId={sheet.itemId}
          reason={sheet.reason}
          input={input}
          byId={byId}
          onPickItem={(itemId) => setSheet({ ...sheet, itemId })}
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

const useStyles = makeStyles(() => ({
  places: { gap: spacing.xs },
  placeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spare: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingSemi },
  coachNote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  phase: { gap: spacing.sm },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xxs },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skipped: { opacity: 0.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 150 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.card,
  },
}));
