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
  afterLayout,
  careDay,
  careWeek,
  dailyLayout,
  dailyPlan,
  programWeekStart,
  sessionsToday,
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
  type StrengthTiming,
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
  const plan =
    program && run && !run.maintenance ? dailyPlan(program, today, before, pick, careDays) : null;

  // Around today's main workout (Daniel, Oct 3): on a training day only the
  // stretches go first; the strengthening comes after, unless set to "before".
  const isToday = (w: (typeof workouts)[number]) =>
    localDate(new Date(w.endedAt ?? w.startedAt ?? w.createdAt)) === today;
  const mainToday = workouts.filter(
    (w) => (w.kind === 'regular' || w.kind === 'finisher') && !w.session.program && isToday(w),
  );
  const mainDone = mainToday.some((w) => w.status === 'done' || w.status === 'partial');
  const slugOf = new Map(library.map((e) => [e.id, e.slug]));
  const workoutSlugs = new Set(
    mainToday.flatMap((w) =>
      [...w.session.items.map((i) => i.exerciseId), ...w.logs.map((l) => l.exerciseId)].map(
        (id) => slugOf.get(id) ?? id,
      ),
    ),
  );
  const trainingDay = planned.has(today) || mainToday.length > 0;
  const day =
    program && plan
      ? careDay(program, plan, { trainingDay, timing: run?.strengthTiming, workoutSlugs })
      : null;
  const daily = day?.first ?? null;
  const fullDose = !!run?.fullDose;
  const firstLayout = program && daily ? dailyLayout(program, daily, fullDose) : null;
  const finishLayout =
    program && plan && day?.after.length && plan.block !== 'stretch'
      ? afterLayout(program, plan.block, day.after, { full: fullDose, warm: mainDone })
      : null;
  const doneKeys = sessionsToday(workouts, programId, today);
  doneKeys.delete('sleeper');
  // An earlier whole session of the block (before this split) covers both parts.
  const afterDone = !!finishLayout && doneKeys.has(finishLayout.key);
  const firstDone = doneKeys.size > 0;
  const dailyDone = finishLayout ? afterDone : firstDone;
  const minutesOf = (layout: SessionLayout | null) =>
    program && layout
      ? buildProgramSession(program, layout, { library, affected: run?.side ?? 'right', week })
          .minutes
      : 0;

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
    /** The first part is done (the whole day when it is not split). */
    firstDone,
    dailyMinutes: minutesOf(firstLayout),
    counts,
    startDaily: () => firstLayout && launch(firstLayout),
    /** "Finish with the shoulder": strengthening after the workout (Daniel, Oct 3). */
    finish: finishLayout
      ? {
          block: finishLayout.key as DailyBlock,
          numbers: day!.after,
          minutes: minutesOf(finishLayout),
          done: afterDone,
          /** Today's main workout is over: time for it. */
          due: mainDone && !afterDone,
          start: () => launch(finishLayout),
        }
      : null,
    /** Program exercises already in today's workout: they count, not shown twice. */
    inWorkout: day?.inWorkout ?? [],
    trainingDay,
    setTiming: (timing: StrengthTiming) =>
      useRehabStore.getState().setStrengthTiming(programId, timing),
    /** Do the other block today instead (§6.2); the rest of the week re-plans. */
    swapBlock: (block: DailyBlock) => useRehabStore.getState().pickBlock(programId, today, block),
    startSleeper: () => program && launch(sleeperLayout(program)),
    sleeperToday: sleeperBreaksToday(workouts, programId, today),
    care: run ? careMode(run, today) : 'none',
    /** From week 4 (§1: 4–6 weeks), ask whether the physio released the program. */
    askRelease: !!program && !!run && !run.releasedAt && week > program.weeks[0],
  };
}
