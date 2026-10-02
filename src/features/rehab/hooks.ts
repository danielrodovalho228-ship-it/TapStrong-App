import { router } from 'expo-router';

import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';

import { buildProgramSession, programById, programWeek, suggestedSession } from './programs';
import { useRehabStore } from './store';

/** Everything a program screen needs about the person's run (Phase 30). */
export function useRehabRun(programId: string) {
  const program = programById(programId);
  const run = useRehabStore((s) => s.runs[programId]);
  const library = useExerciseLibrary();
  const workouts = useWorkoutStore((s) => s.workouts);
  const create = useWorkoutStore((s) => s.create);
  const mode = useOnboardingStore((s) => derive(s)?.mode ?? 'adult');
  const today = localDate(clock.now());
  const week = run ? programWeek(run.startedAt, today) : 1;
  const suggestion =
    program && run ? suggestedSession(program, run.startedAt, today, run.maintenance) : null;
  // Exercises not in this build's library (not released yet): the program can't start.
  const missing = program
    ? buildProgramSession(program, 'B', { library, affected: 'right', week: 1 }).missing.concat(
        buildProgramSession(program, 'C', { library, affected: 'right', week: 1 }).missing,
      )
    : [];
  const done = workouts.filter(
    (w) => w.session.program?.id === programId && (w.status === 'done' || w.status === 'partial'),
  );

  const start = (key: 'A' | 'B' | 'C') => {
    if (!program || !run) return;
    const increased = Object.fromEntries(
      Object.entries(run.increased).map(([slug, n]) => [slug, n > 0]),
    );
    const session = buildProgramSession(program, key, {
      library,
      affected: run.side,
      week,
      increased,
    });
    // No analytics event: a rehab program is health data (SPEC §10).
    const id = create(session, 'repair');
    router.push({ pathname: '/workout/[id]', params: { id } });
  };

  return {
    program,
    run,
    week,
    suggestion,
    missing,
    done,
    today,
    minor: mode === 'child' || mode === 'teen',
    start,
  };
}
