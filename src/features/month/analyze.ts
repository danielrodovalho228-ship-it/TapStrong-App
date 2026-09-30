import { daysBetween, type LocalDate } from '@/lib/dates';

import type { Exercise } from '../exercises/types';
import { needsJointCare, programmablePool } from '../generator/filters';
import { rankForTarget } from '../generator/generate';
import type { GeneratorInput } from '../generator/types';
import { muscleByKey, muscleFamily } from '../muscles';
import type { WorkoutRecord } from '../workout/types';

import { dayOf, finished, previousBlock, workoutsIn, type BlockRange } from './cycle';
import type { Progress, RenewItem } from './renew';

const KG_PER_LB = 0.45359237;
/** "Still progressing" / "stalled" look at the block's last 3 weeks. */
export const PROGRESS_DAYS = 21;
const COMPOUND_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
];

const parentOf = (m: string) => muscleByKey(m)?.parentKey ?? m;

export const isCompound = (e: Exercise | undefined) =>
  !!e && COMPOUND_PATTERNS.includes(e.pattern) && !e.isolation;

/** One number per session for an exercise: kg × reps, else reps, else seconds. */
function sessionScore(
  w: WorkoutRecord,
  exerciseId: string,
): { kind: number; score: number } | null {
  let best: { kind: number; score: number } | null = null;
  for (const l of w.logs) {
    if (l.exerciseId !== exerciseId) continue;
    const s =
      l.load != null && l.load > 0 && l.reps != null
        ? { kind: 2, score: (l.unit === 'lb' ? l.load * KG_PER_LB : l.load) * l.reps }
        : l.reps != null
          ? { kind: 1, score: l.reps }
          : l.seconds != null
            ? { kind: 0, score: l.seconds }
            : null;
    if (s && (!best || s.kind > best.kind || (s.kind === best.kind && s.score > best.score)))
      best = s;
  }
  return best;
}

/**
 * Did the move progress in the block's last 3 weeks (load, reps or time)?
 * 'up' = the best of those weeks beats everything before; 'flat' = it
 * doesn't, over 3 weeks of data; 'unknown' = too little to say.
 */
export function exerciseProgress(
  workouts: WorkoutRecord[],
  exerciseId: string,
  blockEnd: LocalDate,
): Progress {
  const sessions = workouts
    .filter((w) => finished(w) && dayOf(w) < blockEnd)
    .map((w) => ({ day: dayOf(w), s: sessionScore(w, exerciseId) }))
    .filter((x): x is { day: LocalDate; s: { kind: number; score: number } } => !!x.s)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  if (!sessions.length) return 'unknown';
  const kind = Math.max(...sessions.map((x) => x.s.kind));
  const same = sessions.filter((x) => x.s.kind === kind);
  const inWindow = same.filter((x) => daysBetween(x.day, blockEnd) <= PROGRESS_DAYS);
  const before = same.filter((x) => daysBetween(x.day, blockEnd) > PROGRESS_DAYS);
  if (!inWindow.length) return 'unknown';
  const best = (xs: typeof same) => Math.max(...xs.map((x) => x.s.score));
  if (before.length) return best(inWindow) > best(before) ? 'up' : 'flat';
  if (inWindow.length < 2) return 'unknown';
  if (inWindow[inWindow.length - 1].s.score > inWindow[0].s.score) return 'up';
  return daysBetween(inWindow[0].day, inWindow[inWindow.length - 1].day) >= 14 ? 'flat' : 'unknown';
}

/** Regular workouts only: Repair follows its own retest plan, mobility isn't programmed. */
const regular = (w: WorkoutRecord) => w.kind === 'regular' || w.kind === 'finisher';

/** The block's main moves, with what the renewal rules need to know. */
export function renewItems(input: {
  workouts: WorkoutRecord[];
  block: BlockRange;
  library: Exercise[];
  generator: GeneratorInput;
}): RenewItem[] {
  const byId = new Map(input.library.map((e) => [e.id, e]));
  const inBlock = workoutsIn(input.workouts, input.block).filter(regular);
  const pains = new Map<string, 'sharp' | 'dull'>();
  for (const w of inBlock)
    for (const p of w.pains) {
      if (p.type === 'sharp') pains.set(p.exerciseId, 'sharp');
      else if (p.type === 'dull' && pains.get(p.exerciseId) !== 'sharp')
        pains.set(p.exerciseId, 'dull');
    }
  const items: RenewItem[] = [];
  const seen = new Set<string>();
  for (const w of inBlock)
    for (const it of w.session.items) {
      if (it.role !== 'main' || seen.has(it.exerciseId)) continue;
      const e = byId.get(it.exerciseId);
      if (!e || e.custom) continue;
      seen.add(it.exerciseId);
      const top = e.muscles.find((m) => m.role === 'primary')?.muscleKey;
      items.push({
        exerciseId: it.exerciseId,
        muscle: parentOf(it.targetMuscle ?? top ?? ''),
        compound: isCompound(e),
        progress: exerciseProgress(input.workouts, it.exerciseId, input.block.to),
        pain: pains.get(it.exerciseId) ?? null,
        jointCare: needsJointCare(e, input.generator),
      });
    }
  return items;
}

/** Moves done in this block and the one before (replacements avoid them). */
export function recentMoves(workouts: WorkoutRecord[], block: BlockRange): string[] {
  const prev = previousBlock(block);
  const span = { from: prev?.from ?? block.from, to: block.to };
  return [
    ...new Set(
      workoutsIn(workouts, span)
        .filter(regular)
        .flatMap((w) => w.session.items.filter((i) => i.role === 'main').map((i) => i.exerciseId)),
    ),
  ];
}

/**
 * Safe options for the same muscle (every generator filter applies:
 * restrictions, pain, equipment, age, sharp-pain bans), best first, another
 * angle (other pattern or other part of the muscle) ahead of the same one.
 */
export function candidatesFor(generator: GeneratorInput, library: Exercise[]) {
  const pool = programmablePool({ ...generator, avoid: [] });
  const byId = new Map(library.map((e) => [e.id, e]));
  return (item: RenewItem, exclude: ReadonlySet<string>): string[] => {
    const from = byId.get(item.exerciseId);
    const ranked = rankForTarget(
      pool,
      { muscle: item.muscle, family: muscleFamily(item.muscle), goal: 'grow' },
      generator.mode,
    ).filter((e) => !exclude.has(e.id) && e.id !== item.exerciseId);
    const top = (e: Exercise) => e.muscles.find((m) => m.role === 'primary')?.muscleKey;
    const otherAngle = (e: Exercise) =>
      !from || e.pattern !== from.pattern || top(e) !== top(from) ? 1 : 0;
    // Keep the kind of slot: a compound for a compound, an accessory for an accessory.
    const sameSlot = (e: Exercise) => (isCompound(e) === item.compound ? 1 : 0);
    return ranked
      .map((e, i) => ({ e, i }))
      .sort(
        (a, b) => sameSlot(b.e) - sameSlot(a.e) || otherAngle(b.e) - otherAngle(a.e) || a.i - b.i,
      )
      .map((x) => x.e.id);
  };
}

/** Days since each parent muscle was last trained, as of `today`. */
export function daysSinceTrained(
  workouts: WorkoutRecord[],
  library: Exercise[],
  today: LocalDate,
): Record<string, number> {
  const byId = new Map(library.map((e) => [e.id, e]));
  const out: Record<string, number> = {};
  for (const w of workouts) {
    if (!finished(w)) continue;
    const d = daysBetween(dayOf(w), today);
    for (const l of w.logs) {
      const e = byId.get(l.exerciseId);
      for (const m of e?.muscles ?? []) {
        if (m.role !== 'primary') continue;
        const p = parentOf(m.muscleKey);
        out[p] = Math.min(out[p] ?? Number.POSITIVE_INFINITY, d);
      }
    }
  }
  return out;
}
