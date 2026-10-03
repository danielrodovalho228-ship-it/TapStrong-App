import { router } from 'expo-router';

import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { plannedDaysBetween } from '@/features/program/week';
import { useTrainingDaysPerWeek } from '@/features/program/useTrainingDays';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart, localDate } from '@/lib/dates';

import {
  careWeek,
  dailyDoneToday,
  dailyLayout,
  dailyPlan,
  programWeekStart,
  sleeperBreaksToday,
  sleeperLayout,
  weekCounts,
} from './daily';
import {
  buildProgramSession,
  programById,
  programWeek,
  suggestedSession,
  type DailyBlock,
  type ProgramSessionKey,
  type SessionLayout,
} from './programs';
import { careMode } from './protect';
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
  // Maintenance after the release: B or C 2–3 times a week (§1, §6.5).
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

  // The daily rhythm (addendum §6.2–6.3): planned from what was done this
  // week before today, so finishing today's session doesn't change today's plan.
  const monday = programWeekStart(today);
  const before = program ? weekCounts(workouts, program, library, monday, today) : {};
  const counts = program ? weekCounts(workouts, program, library, monday, addDays(today, 1)) : {};
  const pick = run?.pick?.date === today ? run.pick.block : undefined;
  // The longer block on rest days of the main plan (Daniel, Oct 3).
  const trainingDays = useTrainingDaysPerWeek();
  const planned = new Set(
    plannedDaysBetween(monday, addDays(monday, 7), deviceWeekStart(), trainingDays),
  );
  const careDays = program
    ? careWeek(
        program,
        Array.from({ length: 7 }, (_, i) => planned.has(addDays(monday, i))),
      )
    : undefined;
  const daily =
    program && run && !run.maintenance ? dailyPlan(program, today, before, pick, careDays) : null;
  const dailyDone = dailyDoneToday(workouts, programId, today);
  const dailySession =
    program && daily
      ? buildProgramSession(program, dailyLayout(program, daily, !!run?.fullDose), {
          library,
          affected: run?.side ?? 'right',
          week,
        })
      : null;

  const launch = (layout: ProgramSessionKey | SessionLayout) => {
    if (!program || !run) return;
    const increased = Object.fromEntries(
      Object.entries(run.increased).map(([slug, n]) => [slug, n > 0]),
    );
    const session = buildProgramSession(program, layout, {
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
    start: (key: ProgramSessionKey) => launch(key),
    daily,
    dailyDone,
    dailyMinutes: dailySession?.minutes ?? 0,
    counts,
    startDaily: () => program && daily && launch(dailyLayout(program, daily, !!run?.fullDose)),
    /** Do the other block today instead (§6.2); the rest of the week re-plans. */
    swapBlock: (block: DailyBlock) => useRehabStore.getState().pickBlock(programId, today, block),
    startSleeper: () => program && launch(sleeperLayout(program)),
    sleeperToday: sleeperBreaksToday(workouts, programId, today),
    care: run ? careMode(run, today) : 'none',
    /** From week 4 (§1: 4–6 weeks), ask whether the physio released the program. */
    askRelease: !!program && !!run && !run.releasedAt && week > program.weeks[0],
  };
}
