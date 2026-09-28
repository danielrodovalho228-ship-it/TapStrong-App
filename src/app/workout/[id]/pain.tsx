import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Checkbox, Chip, Notice } from '@/components/ui';
import { swapItem } from '@/features/generator';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { ExerciseThumb } from '@/features/workout/components/Media';
import { currentStep, setsLogged } from '@/features/workout/flow';
import { exerciseCues, exerciseName } from '@/features/workout/format';
import { endWorkout, useWorkout } from '@/features/workout/hooks';
import {
  PAIN_SPOTS,
  PAIN_TYPES,
  painSwap,
  planFor,
  withRestriction,
} from '@/features/workout/pain';
import { useWorkoutStore } from '@/features/workout/store';
import type { PainAction, PainType } from '@/features/workout/types';
import { track } from '@/lib/analytics';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

/** Mockup 21 — pain during a set (SPEC §2.2, §9 /workout/[id]/pain). */
export default function PainScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, input } = useWorkout(id);
  const store = useWorkoutStore();
  const addRestriction = useRestrictionsStore((s) => s.add);
  const [spotKey, setSpotKey] = useState<string | null>(null);
  const [type, setType] = useState<PainType | null>(null);
  const [save, setSave] = useState(true);

  const step = workout ? currentStep(workout) : null;
  if (!workout || !input || !step) return <Redirect href="/home" />;

  const spot = PAIN_SPOTS.find((s) => s.key === spotKey);
  const plan = type ? planFor(type) : null;
  const swap =
    spot && plan === 'swap' ? painSwap(workout.session, step.item.id, input, spot.area) : null;
  const canSave = !!spot && spot.area !== 'other' && plan !== 'rest';
  const spotLabel = spot ? t(`workout.pain.spots.${spot.key as 'neck'}`) : '';

  const record = (action: PainAction) => {
    if (!spot || !type) return;
    store.addPain(workout.id, {
      itemId: step.item.id,
      exerciseId: step.item.exerciseId,
      area: spot.area,
      side: spot.side,
      type,
      action,
    });
    // Health details never go to analytics — only the pain type (SPEC §10).
    track('pain_reported', { type });
    if (canSave && save && spot.area !== 'other') {
      addRestriction({ area: spot.area, side: spot.side, source: 'pain_report' });
    }
  };

  const endNow = () => {
    record('stopped');
    endWorkout(workout.id, 'partial');
    router.replace({ pathname: '/workout/[id]/done', params: { id: workout.id } });
  };

  const acceptSwap = () => {
    if (!swap || !spot) return;
    const { session, record: swapRecord } = swapItem(
      workout.session,
      step.item.id,
      swap,
      withRestriction(input, spot.area),
      { reason: 'pain', setsDone: setsLogged(workout, step.item.id) },
    );
    record('swapped');
    store.applySwap(workout.id, session, swapRecord);
    track('exercise_swapped', { reason: 'pain' });
    router.back();
  };

  const skipExercise = () => {
    record('skipped');
    store.skipItem(workout.id, step.item.id);
    router.back();
  };

  const keepGoing = () => {
    record('continued');
    router.back();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppText variant="caption" color={colors.accentText} style={styles.caps}>
            {t('workout.pain.eyebrow')}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {t('workout.pain.title')}
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PAIN_SPOTS.map((s) => (
              <Chip
                key={s.key}
                label={t(`workout.pain.spots.${s.key as 'neck'}`)}
                selected={spotKey === s.key}
                onPress={() => setSpotKey(s.key)}
              />
            ))}
          </View>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PAIN_TYPES.map((k) => (
              <Chip
                key={k}
                label={t(`workout.pain.types.${k}`)}
                selected={type === k}
                onPress={() => setType(k)}
              />
            ))}
          </View>

          {spot && plan === 'stop' ? (
            <Notice tone="warning" title={t('workout.pain.stopTitle')}>
              {t('workout.pain.stopBody')}
            </Notice>
          ) : null}

          {spot && plan === 'swap' ? (
            swap ? (
              <>
                <AppText variant="caption" style={styles.caps}>
                  {t('workout.pain.suggested', { area: spotLabel })}
                </AppText>
                <Card style={styles.swapCard}>
                  <ExerciseThumb size={72} />
                  <View style={styles.flex}>
                    <AppText variant="caption" color={colors.teal} style={styles.caps}>
                      {t('workout.pain.swapTo')}
                    </AppText>
                    <AppText variant="bodyStrong">{exerciseName(t, swap, swap.id)}</AppText>
                    <AppText variant="caption" color={colors.mutedStrong}>
                      {exerciseCues(t, swap)}
                    </AppText>
                  </View>
                </Card>
              </>
            ) : (
              <Notice icon>{t('workout.swap.empty')}</Notice>
            )
          ) : null}

          {spot && plan === 'rest' ? <Notice>{t('workout.pain.tiredBody')}</Notice> : null}

          {canSave ? (
            <Checkbox
              label={t('workout.pain.save', { area: spotLabel })}
              checked={save}
              onChange={setSave}
            />
          ) : null}
        </ScrollView>

        {spot && plan ? (
          <View style={styles.footer}>
            <View style={styles.flex}>
              <Button variant="danger" label={t('workout.pain.end')} onPress={endNow} />
            </View>
            {plan === 'swap' ? (
              <View style={styles.flex}>
                {swap ? (
                  <Button label={t('workout.pain.accept')} onPress={acceptSwap} />
                ) : (
                  <Button label={t('workout.pain.skipExercise')} onPress={skipExercise} />
                )}
              </View>
            ) : null}
            {plan === 'rest' ? (
              <View style={styles.flex}>
                <Button label={t('workout.pain.keepGoing')} onPress={keepGoing} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.flex}>
              <Button
                variant="secondary"
                label={t('workout.pain.cancel')}
                onPress={() => router.back()}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, opacity: 0.5 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card * 2,
    borderTopRightRadius: radius.card * 2,
  },
  content: { padding: spacing.xl, gap: spacing.lg },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swapCard: { flexDirection: 'row', gap: spacing.md, borderWidth: 2, borderColor: colors.ink },
  flex: { flex: 1, gap: spacing.xxs },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },
}));
