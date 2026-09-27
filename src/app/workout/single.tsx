import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Header, Notice, Screen } from '@/components/ui';
import { BodyPicker } from '@/features/bodymap/components/BodyPicker';
import { generateSession } from '@/features/generator';
import { defaultMuscleGoal } from '@/features/onboarding/options';
import { muscleLabel } from '@/features/onboarding/summaries';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { colors } from '@/theme';

/**
 * Single workout (A6; mockup 08 body map): pick muscles for one session. The
 * profile's goals and plan stay as they are; every safety rule applies.
 */
export default function SingleWorkoutScreen() {
  const { t } = useTranslation();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const create = useWorkoutStore((s) => s.create);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const build = () => {
    if (!input || !picked.length) return setError(t('single.none'));
    const goal = defaultMuscleGoal(input.mainGoals);
    const session = generateSession({
      ...input,
      muscleGoals: picked.map((muscleKey) => ({ muscleKey, goal })),
      exercisesPerSession: Math.max(input.exercisesPerSession, Math.min(picked.length, 8)),
    });
    if (session.error)
      return setError(
        t(
          session.error === 'no_library'
            ? 'workout.underReview'
            : `workout.unavailable.${session.error}`,
        ),
      );
    const id = create(session);
    router.replace({ pathname: '/workout/[id]', params: { id } });
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('single.title')} />}
      footer={<Button label={t('single.build')} disabled={!picked.length} onPress={build} />}
    >
      <AppText color={colors.mutedStrong}>{t('single.hint')}</AppText>
      <BodyPicker selected={picked} onToggle={toggle} />
      {picked.length ? (
        <AppText variant="bodyStrong">{picked.map((k) => muscleLabel(t, k)).join(', ')}</AppText>
      ) : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </Screen>
  );
}
