import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton, Notice, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import { alternativeGroups, missingEquipmentOptions, swapItem } from '@/features/generator';
import { isMachine } from '@/features/generator/filters';
import type { GeneratorInput, SessionItem } from '@/features/generator/types';
import { track } from '@/lib/analytics';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { setsLogged } from '../flow';
import { exerciseName } from '../format';
import { useWorkoutStore } from '../store';
import type { WorkoutRecord } from '../types';

import { ExerciseThumb } from './Media';

export type SwapReasonUi = 'user_choice' | 'machine_taken';

type Props = {
  visible: boolean;
  workout: WorkoutRecord;
  /** null with "machine is taken" first asks which machine. */
  itemId: string | null;
  reason: SwapReasonUi;
  input: GeneratorInput;
  byId: Map<string, Exercise>;
  onPickItem: (itemId: string) => void;
  onClose: () => void;
  onSwapped: (exercise: Exercise) => void;
};

/** Items that need a machine — the "Machine is taken" picker (SPEC §8). */
export function machineItems(workout: WorkoutRecord, byId: Map<string, Exercise>): SessionItem[] {
  return workout.session.items.filter(
    (i) =>
      i.part !== 'ramp_up' &&
      !workout.skipped.includes(i.id) &&
      (byId.get(i.exerciseId)?.equipment ?? []).some(isMachine),
  );
}

type Level = 'easier' | 'same' | 'harder';

/** Easier, same or harder than the exercise it replaces (by library level). */
export function levelOf(e: Exercise, current: Exercise | undefined): Level {
  if (!current || e.level === current.level) return 'same';
  return e.level < current.level ? 'easier' : 'harder';
}

/**
 * Swap sheet (SPEC §8 "Swap", Phase 31 C): "SWAP EXERCISE" with a close
 * button; "Same muscle" first, then "Other options", then "More" at the end.
 * Each row is the profile's own-sex poster, the name (with easier / harder
 * when it differs) and an (i) that opens the exercise; tapping the row swaps
 * in place. Only the person's equipment; a swap never adds an exercise.
 */
export function SwapSheet({
  visible,
  workout,
  itemId,
  reason,
  input,
  byId,
  onPickItem,
  onClose,
  onSwapped,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const applySwap = useWorkoutStore((s) => s.applySwap);

  const item = workout.session.items.find((i) => i.id === itemId);
  const current = item ? byId.get(item.exerciseId) : undefined;
  const [showMore, setShowMore] = useState(false);
  const groups = item
    ? alternativeGroups(workout.session, item.id, input, { reason })
    : { same: [], other: [], more: [] };
  const options = [...groups.same, ...groups.other];
  const picking = reason === 'machine_taken' && !item;
  const missing =
    item && reason !== 'machine_taken'
      ? missingEquipmentOptions(workout.session, item.id, input, { reason }).slice(0, 3)
      : [];

  const replace = (next: Exercise) => {
    if (!item) return;
    const { session, record } = swapItem(workout.session, item.id, next, input, {
      reason,
      setsDone: setsLogged(workout, item.id),
    });
    applySwap(workout.id, session, record);
    track('exercise_swapped', { reason });
    onSwapped(next);
  };

  const row = (e: Exercise) => {
    const level = levelOf(e, current);
    const name = exerciseName(t, e, e.id);
    return (
      // One row per option: tap the row to swap (Phase 29, A3).
      <View key={e.id} style={styles.optionRow}>
        <Pressable
          testID="swap-option"
          accessibilityRole="button"
          accessibilityLabel={t('workout.swap.replaceWith', { name })}
          onPress={() => replace(e)}
          style={({ pressed }) => [styles.optionMain, pressed && styles.optionPressed]}
        >
          <ExerciseThumb size={64} slug={e.slug} />
          <View style={styles.optionText}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {name}
            </AppText>
            {level !== 'same' ? (
              <AppText variant="caption" color={colors.mutedStrong} numberOfLines={1}>
                {t(`workout.swap.level.${level}`)}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <IconButton
          icon="info"
          accessibilityLabel={t('workout.swap.info', { name })}
          onPress={() => {
            onClose();
            router.push({ pathname: '/exercise/[id]', params: { id: e.id } });
          }}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <AppText variant="h2" accessibilityRole="header" style={styles.eyebrow}>
              {picking
                ? t('workout.swap.whichMachine')
                : reason === 'machine_taken'
                  ? t('workout.swap.machineEyebrow')
                  : t('workout.swap.sheetTitle')}
            </AppText>
            {!picking ? (
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('workout.swap.title', { name: exerciseName(t, current, '') })}
              </AppText>
            ) : null}
          </View>
          <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {picking ? (
            machineItems(workout, byId).map((i) => (
              <Button
                key={i.id}
                variant="secondary"
                label={exerciseName(t, byId.get(i.exerciseId), i.exerciseId)}
                onPress={() => onPickItem(i.id)}
              />
            ))
          ) : options.length === 0 ? (
            <Notice icon>{t('workout.swap.empty')}</Notice>
          ) : (
            <>
              {(
                [
                  ['same', groups.same],
                  ['other', groups.other],
                ] as const
              ).map(([key, list]) =>
                list.length ? (
                  <View key={key} style={styles.group} testID={`swap-group-${key}`}>
                    <AppText variant="label" color={colors.mutedStrong}>
                      {t(`workout.swap.groups.${key}`)}
                    </AppText>
                    {list.map((e) => row(e))}
                  </View>
                ) : null,
              )}
              {groups.more.length ? (
                <View style={styles.group} testID="swap-group-more">
                  {showMore ? (
                    <>
                      <AppText variant="label" color={colors.mutedStrong}>
                        {t('workout.swap.groups.more')}
                      </AppText>
                      {groups.more.map((e) => row(e))}
                    </>
                  ) : (
                    <TextLink
                      tone="accent"
                      label={t('workout.swap.showMore', { count: groups.more.length })}
                      onPress={() => setShowMore(true)}
                    />
                  )}
                </View>
              ) : null}
            </>
          )}
          {missing.length ? (
            <View style={styles.missing} testID="swap-missing-equipment">
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('workout.swap.missingEquipment', {
                  names: missing.map((e) => exerciseName(t, e, e.id)).join(', '),
                })}
              </AppText>
              <TextLink
                tone="accent"
                label={t('workout.swap.editEquipment')}
                onPress={() => {
                  onClose();
                  router.push('/settings/equipment');
                }}
              />
            </View>
          ) : null}
          {item && setsLogged(workout, item.id) > 0 && options.length > 0 ? (
            <AppText variant="caption" color={colors.muted}>
              {t('workout.swap.remainingOnly')}
            </AppText>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  missing: { gap: spacing.xs, paddingTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
    paddingTop: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headText: { flex: 1, gap: spacing.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  list: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.lg },
  group: { gap: spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 72,
    paddingRight: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  optionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.card,
  },
  optionPressed: { backgroundColor: colors.line },
  optionText: { flex: 1, gap: spacing.xxs },
}));
