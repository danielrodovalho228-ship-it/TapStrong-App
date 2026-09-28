import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, IconButton, Notice, TextLink } from '@/components/ui';
import type { Exercise } from '@/features/exercises/types';
import { getAlternatives, missingEquipmentOptions, swapItem } from '@/features/generator';
import { isMachine } from '@/features/generator/filters';
import type { GeneratorInput, SessionItem } from '@/features/generator/types';
import { track } from '@/lib/analytics';
import { colors, radius, spacing } from '@/theme';

import { setsLogged } from '../flow';
import { exerciseCues, exerciseName } from '../format';
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

/**
 * Swap sheet (SPEC §8 "Swap"): up to 5 safe alternatives for the same
 * primary muscle, each with its demo loop; "Replace" swaps in place.
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const applySwap = useWorkoutStore((s) => s.applySwap);

  const item = workout.session.items.find((i) => i.id === itemId);
  const current = item ? byId.get(item.exerciseId) : undefined;
  const options = item ? getAlternatives(workout.session, item.id, input, { reason }) : [];
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
            <AppText variant="caption" color={colors.accent} style={styles.eyebrow}>
              {t(
                reason === 'machine_taken' ? 'workout.swap.machineEyebrow' : 'workout.swap.eyebrow',
              )}
            </AppText>
            <AppText variant="h2" accessibilityRole="header">
              {picking
                ? t('workout.swap.whichMachine')
                : t('workout.swap.title', { name: exerciseName(t, current, '') })}
            </AppText>
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
            options.map((e) => (
              <Card key={e.id} style={styles.option}>
                <View style={styles.optionRow}>
                  <ExerciseThumb size={72} />
                  <View style={styles.optionText}>
                    <AppText variant="bodyStrong">{exerciseName(t, e, e.id)}</AppText>
                    <AppText variant="caption" color={colors.mutedStrong}>
                      {exerciseCues(t, e)}
                    </AppText>
                  </View>
                </View>
                <Button
                  variant="primary"
                  label={t('workout.swap.replace')}
                  accessibilityLabel={t('workout.swap.replaceWith', {
                    name: exerciseName(t, e, e.id),
                  })}
                  onPress={() => replace(e)}
                />
              </Card>
            ))
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

const styles = StyleSheet.create({
  missing: { gap: spacing.xs, paddingTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: colors.ink, opacity: 0.4 },
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
  option: { gap: spacing.md },
  optionRow: { flexDirection: 'row', gap: spacing.md },
  optionText: { flex: 1, gap: spacing.xxs },
});
