import type { Exercise } from '../exercises/types';
import type { GeneratorInput } from '../generator/types';

import type { MovementCatalog, MovementKey, RecoveryPhase } from './catalog';
import { movementVerdict, type MovementLimit } from './rules';
import type { MovementPain, PainCheck } from './store';

const DAY = 86_400_000;

// --- Traffic light (SPEC §8) -------------------------------------------------

export type Light = 'green' | 'yellow' | 'red';

/** Points above the usual level that count as "worse the next morning". */
export const WORSE_BY = 2;

/** 0–3 green (move on), 4–5 yellow (stay), over 5 red (step back). */
export const lightFor = (score: number): Light =>
  score <= 3 ? 'green' : score <= 5 ? 'yellow' : 'red';

/**
 * The light for one workout: the worse of right after and the next morning.
 * Clearly worse the next morning (2+ points above the usual level, the
 * baseline) is red too.
 */
export function workoutLight(
  after: number | undefined,
  morning: number | undefined,
  baseline: number,
): Light {
  const scores = [after, morning].filter((s): s is number => s != null);
  if (morning != null && morning >= baseline + WORSE_BY) return 'red';
  const worst = Math.max(0, ...scores);
  return lightFor(worst);
}

export const MAX_LEVEL = 6;

export type LightStep = { workoutId: string; light: Light; at: string };

/**
 * Steps through the checks in order, one light per workout. A workout counts
 * once its morning check is in; until then only a red right after counts
 * (step back straight away), and it also counts once a later workout exists.
 */
export function lightHistory(report: MovementPain): LightStep[] {
  const byWorkout = new Map<string, { after?: PainCheck; morning?: PainCheck }>();
  const order: string[] = [];
  for (const c of [...report.checks].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    if (!byWorkout.has(c.workoutId)) {
      byWorkout.set(c.workoutId, {});
      order.push(c.workoutId);
    }
    byWorkout.get(c.workoutId)![c.kind] = c;
  }
  const steps: LightStep[] = [];
  let baseline = report.score;
  order.forEach((id, i) => {
    const { after, morning } = byWorkout.get(id)!;
    const last = i === order.length - 1;
    const light = workoutLight(after?.score, morning?.score, baseline);
    if (last && !morning && light !== 'red') return;
    steps.push({ workoutId: id, light, at: (morning ?? after)!.at });
    if (morning) baseline = morning.score;
  });
  return steps;
}

/** Recovery level 1–6: green moves up, yellow holds, red steps back. */
export function levelFor(report: MovementPain): number {
  let level = 1;
  for (const s of lightHistory(report)) {
    if (s.light === 'green') level = Math.min(MAX_LEVEL, level + 1);
    if (s.light === 'red') level = Math.max(1, level - 1);
  }
  return level;
}

/** Levels 1–2: calm it down; 3–4: strengthen; 5–6: range and load. */
export const phaseFor = (level: number): RecoveryPhase => (level <= 2 ? 1 : level <= 4 ? 2 : 3);

/** Latest pain: the last check, else the last retest average, else the report. */
export function currentScore(report: MovementPain): number {
  const last = [...report.checks].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  return last?.score ?? report.score;
}

// --- Weekly retest ------------------------------------------------------------

export const RETEST_DAYS = 7;
export const PT_AFTER_DAYS = 21;

export const retestAverage = (scores: Partial<Record<MovementKey, number>>) => {
  const values = Object.values(scores).filter((v): v is number => v != null);
  return values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;
};

export function retestDue(report: MovementPain, now: Date): boolean {
  const last = report.retests.at(-1)?.at ?? report.createdAt;
  return now.getTime() - Date.parse(last) >= RETEST_DAYS * DAY;
}

/** Points for the Progress chart: the report itself, then each weekly retest. */
export function retestSeries(report: MovementPain): { at: string; score: number }[] {
  return [
    { at: report.createdAt, score: report.score },
    ...report.retests.map((r) => ({ at: r.at, score: retestAverage(r.scores) })),
  ];
}

/**
 * Recommend a physical therapist (SPEC §8): worse than at the start, or no
 * better after 3 weeks.
 */
export function seeTherapist(report: MovementPain, now: Date): boolean {
  const series = retestSeries(report);
  const first = series[0].score;
  const latest = series.at(-1)!.score;
  if (series.length > 1 && latest > first) return true;
  const weeks = now.getTime() - Date.parse(report.createdAt) >= PT_AFTER_DAYS * DAY;
  return weeks && latest >= first;
}

// --- Generator input ----------------------------------------------------------

export const limitFrom = (report: MovementPain): MovementLimit => ({
  area: report.area,
  joints: report.joints,
  painful: report.painful,
  painFree: report.painFree,
  score: currentScore(report),
});

/**
 * The recovery session for a report (Repair recovery plan, SPEC §8):
 * - phase 1: gentle holds in the painful direction and pain-free range only;
 * - phase 2: strengthening in pain-free range;
 * - phase 3: shorter range of the painful movements allowed, more load.
 * Warm-up and cool-down are untouched (the generator always adds them).
 */
export function recoveryInput(
  input: GeneratorInput,
  report: MovementPain,
  catalog: MovementCatalog,
  minutes = 15,
): GeneratorInput {
  const level = levelFor(report);
  const phase = phaseFor(level);
  const joints = report.joints;
  const focus = [
    ...new Set(joints.flatMap((j) => catalog.joints[j].focus[String(phase) as '1' | '2' | '3'])),
  ];
  const limits = [
    ...(input.movementLimits ?? []).filter((l) => l.area !== report.area),
    limitFrom(report),
  ];
  const library =
    phase === 1
      ? input.library.filter((e) => !e.parts.includes('main') || phaseOneMain(e, report))
      : input.library;
  return {
    ...input,
    library,
    minutes,
    rehab: true,
    movementLimits: limits,
    allowReducedRange: phase === 3,
    exercisesPerSession: 3,
    setsPerExercise: phase === 3 ? 3 : 2,
    muscleGoals: focus.map((muscleKey) => ({ muscleKey, goal: 'strengthen' as const })),
    mainGoals: input.mainGoals.filter((g) => g !== 'lose_weight' && g !== 'fitness'),
  };
}

/** Phase 1 main work: holds for the joint, or exercises using only its pain-free movements. */
function phaseOneMain(e: Exercise, report: MovementPain): boolean {
  const uses = e.joints.filter((j) => report.joints.includes(j.joint));
  if (!uses.length) return false;
  if (uses.some((u) => u.range === 'isometric')) return true;
  return movementVerdict(e, [limitFrom(report)], { allowReducedRange: false }) === 'ok';
}

/** Workouts rated right after that still wait for their morning check. */
export function pendingMorningChecks(reports: MovementPain[]) {
  return reports
    .filter((r) => r.active)
    .flatMap((r) => {
      const after = [...r.checks]
        .filter((c) => c.kind === 'after')
        .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
      if (!after) return [];
      const done = r.checks.some((c) => c.kind === 'morning' && c.workoutId === after.workoutId);
      return done
        ? []
        : [{ reportId: r.id, area: r.area, workoutId: after.workoutId, afterAt: after.at }];
    });
}
