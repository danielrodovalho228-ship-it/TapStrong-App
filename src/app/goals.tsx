import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, IconButton, RadioCard, Screen, Stepper } from '@/components/ui';
import { hotspotsFor, FRAME } from '@/features/bodymap/hotspots';
import { bodyImage, type BodySex } from '@/features/bodymap/images';
import {
  clampQuantity,
  displayBand,
  firmDescriptionKey,
  QUANTITY_RANGES,
  setGoal,
} from '@/features/bodymap/selection';
import { derive } from '@/features/onboarding/derived';
import type { MuscleGoal } from '@/features/onboarding/options';
import { goalForMode, visibleMuscleGoals } from '@/features/onboarding/visible';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { muscleByKey } from '@/features/muscles';
import { createWorkoutFrom, useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { track } from '@/lib/analytics';
import { bodyMapColors, colors, fonts, makeStyles, radius, spacing } from '@/theme';

const THUMB = 64;
const ZOOM = 0.8; // thumbnail points per frame unit
const HIGHLIGHT = 22;

/** Mockup 09 — Goal for one area + session quantities (SPEC §9 /goals). */
export default function GoalsSheet() {
  const { t } = useTranslation();
  const { muscle } = useLocalSearchParams<{ muscle?: string }>();
  const s = useOnboardingStore();
  const derived = derive(s);
  const entry = s.muscleGoals.find((m) => m.muscleKey === muscle);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  if (!derived || !muscle || !entry || !muscleByKey(muscle)) return <Redirect href="/body" />;

  const band = displayBand(s.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = s.bodyModel.sex ?? (s.sex === 'f' ? 'f' : 'm');
  const view = hotspotsFor(band, sex, 'front').some((h) => h.key === muscle) ? 'front' : 'back';
  const spot = hotspotsFor(band, sex, view).find((h) => h.key === muscle)!;
  const [cx, cy] =
    spot.points.length > 1
      ? [(spot.points[0][0] + spot.points[1][0]) / 2, (spot.points[0][1] + spot.points[1][1]) / 2]
      : spot.points[0];

  const description = (goal: MuscleGoal) => {
    if (goal === 'grow') return t('goalsSheet.goals.grow.desc');
    if (goal === 'firm') return t(firmDescriptionKey(derived.mode));
    return undefined;
  };

  return (
    <Screen
      footer={
        <Button
          variant="accent"
          label={t('goalsSheet.generate')}
          onPress={() => {
            const id = createWorkoutFrom(input, library);
            if (id) track('workout_generated', { mode: derived.mode });
            router.replace({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
          }}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.thumb} accessible={false}>
          <Image
            source={bodyImage(band, sex, view)}
            style={{
              width: FRAME.width * ZOOM,
              height: FRAME.height * ZOOM,
              left: THUMB / 2 - cx * ZOOM,
              top: THUMB / 2 - cy * ZOOM,
            }}
            contentFit="cover"
          />
          {/* The app draws the highlight itself (SPEC §6), never baked into media. */}
          {spot.points.map(([x, y], i) => (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.highlight,
                {
                  left: THUMB / 2 + (x - cx) * ZOOM - HIGHLIGHT / 2,
                  top: THUMB / 2 + (y - cy) * ZOOM - HIGHLIGHT / 2,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.titles}>
          <AppText variant="h2" accessibilityRole="header">
            {muscleLabel(t, muscle)}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {t(`muscleAnatomy.${muscle}` as 'muscleAnatomy.chest')}
          </AppText>
        </View>
        <IconButton
          icon="close"
          variant="outlined"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
        />
      </View>

      <AppText variant="label" style={styles.section}>
        {t('goalsSheet.goalFor')}
      </AppText>
      <View accessibilityRole="radiogroup" style={styles.goals}>
        {visibleMuscleGoals(derived.mode).map((goal) => (
          <RadioCard
            key={goal}
            label={t(`goalsSheet.goals.${goal}.title`)}
            description={description(goal)}
            selected={goalForMode(entry.goal, derived.mode) === goal}
            onPress={() => s.update({ muscleGoals: setGoal(s.muscleGoals, muscle, goal) })}
          />
        ))}
      </View>

      <AppText variant="label" style={styles.section}>
        {t('goalsSheet.wholeWorkout')}
      </AppText>
      <Card style={styles.quantities}>
        <Stepper
          label={t('goalsSheet.exercises')}
          value={s.exercisesPerSession}
          min={QUANTITY_RANGES.exercises[0]}
          max={QUANTITY_RANGES.exercises[1]}
          onChange={(v) => s.update({ exercisesPerSession: clampQuantity('exercises', v) })}
        />
        <View style={styles.divider} />
        <Stepper
          label={t('goalsSheet.sets')}
          value={s.setsPerExercise}
          min={QUANTITY_RANGES.sets[0]}
          max={QUANTITY_RANGES.sets[1]}
          onChange={(v) => s.update({ setsPerExercise: clampQuantity('sets', v) })}
        />
        <View style={styles.divider} />
        <Stepper
          label={t('goalsSheet.days')}
          value={s.daysPerWeek ?? 3}
          min={QUANTITY_RANGES.days[0]}
          max={QUANTITY_RANGES.days[1]}
          onChange={(v) => s.update({ daysPerWeek: clampQuantity('days', v) })}
        />
      </Card>
    </Screen>
  );
}

const styles = makeStyles(() => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.bodyCanvas,
  },
  highlight: {
    position: 'absolute',
    width: HIGHLIGHT,
    height: HIGHLIGHT,
    borderRadius: HIGHLIGHT / 2,
    backgroundColor: bodyMapColors.highlight,
  },
  titles: { flex: 1, gap: spacing.xxs },
  section: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.heading },
  goals: { gap: spacing.sm },
  quantities: { paddingVertical: spacing.xs, gap: 0 },
  divider: { height: 1, backgroundColor: colors.line },
}));
