import { Redirect, router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { Screen } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { Skeleton } from '@/features/home/Skeleton';
import { createWorkoutFrom, useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { beginWorkout } from '@/features/workout/start';
import { track } from '@/lib/analytics';

/**
 * Right after onboarding (Phase 27, A1): builds the first workout and opens
 * the player, so the first exercise comes without another screen. Anything
 * that can't start goes to the preview (it explains why) or Home.
 */
export default function StartScreen() {
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !input || !derived) return;
    done.current = true;
    const id = createWorkoutFrom(input, library);
    if (id) track('workout_generated', { mode: derived.mode });
    if (!id) {
      router.replace({ pathname: '/workout/[id]', params: { id: 'unavailable' } });
      return;
    }
    const begun = beginWorkout(id);
    router.replace(
      begun.ok
        ? { pathname: '/workout/[id]/play', params: { id } }
        : { pathname: '/workout/[id]', params: { id } },
    );
  }, [input, library, derived]);

  if (!profile.onboardingComplete || !derived) return <Redirect href="/welcome" />;
  // The shape of the player while the workout is built: never a blank screen (B3).
  return (
    <Screen>
      <Skeleton variant="player" />
    </Screen>
  );
}
