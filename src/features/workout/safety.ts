import { getAlternatives, swapItem } from '../generator/alternatives';
import { blockReason } from '../generator/filters';
import type { GeneratedSession, GeneratorInput } from '../generator/types';

import { localDate } from '@/lib/dates';

import type { WorkoutRecord } from './types';

const localDay = (iso: string) => localDate(new Date(iso));

/** Block reasons that make an already planned item unsafe (QA A-01, C-04). */
const SAFETY_REASONS = new Set([
  'contraindication',
  'painful_movement',
  'position',
  'age',
  'impact',
  // Equipment or place changed in Settings (QA R4-09).
  'equipment',
  'location',
]);

export type SafetyRefresh =
  | { kind: 'ok' }
  /** Not started: throw it away and build a fresh one. */
  | { kind: 'regenerate' }
  /** In progress: unsafe items still to do are swapped, or skipped when nothing fits. */
  | { kind: 'patch'; session: GeneratedSession; skip: string[] };

/**
 * The input a stored workout is swapped and re-checked with (QA R3-07): a
 * recovery session keeps its recovery rules — rehab dosing and no shorter
 * range of a painful movement — so a swap never offers what the recovery
 * plan left out.
 */
export function workoutInput(
  w: { kind?: WorkoutRecord['kind'] } | undefined,
  input: GeneratorInput,
): GeneratorInput {
  return w?.kind === 'repair' ? { ...input, rehab: true, allowReducedRange: false } : input;
}

/**
 * Re-checks a stored workout against today's safety input: restrictions,
 * red flags, "Movement that hurts" reports and health answers may have
 * changed since it was generated. Only items still to do are touched.
 */
export function safetyRefresh(w: WorkoutRecord, input: GeneratorInput): SafetyRefresh {
  const check = workoutInput(w, input);
  const byId = new Map(check.library.map((e) => [e.id, e]));
  const logged = (itemId: string) => w.logs.filter((l) => l.itemId === itemId).length;
  const unsafe = w.session.items.filter((item) => {
    if (w.skipped.includes(item.id) || logged(item.id) >= item.sets) return false;
    const e = byId.get(item.exerciseId);
    if (!e) return false;
    const reason = blockReason(e, check);
    return reason !== null && SAFETY_REASONS.has(reason);
  });
  if (!unsafe.length) return { kind: 'ok' };
  // A planned regular workout is rebuilt; recovery sessions are patched (their
  // input comes from the recovery plan, not from here).
  if (w.status === 'planned' && w.kind === 'regular') return { kind: 'regenerate' };

  let session = w.session;
  const skip: string[] = [];
  for (const item of unsafe) {
    const next = getAlternatives(session, item.id, check, { limit: 1, reason: 'pain' })[0];
    if (next) {
      session = swapItem(session, item.id, next, check, {
        reason: 'pain',
        setsDone: logged(item.id),
      }).session;
    } else skip.push(item.id);
  }
  return { kind: 'patch', session, skip };
}

/** Areas where sharp pain stopped a workout today: left out until tomorrow (QA C-01). */
export function sharpStopAreasToday(workouts: WorkoutRecord[], today: string): string[] {
  const areas = new Set<string>();
  for (const w of workouts) {
    for (const p of w.pains) {
      if (p.type === 'sharp' && p.action === 'stopped' && p.area !== 'other') {
        if (localDay(p.reportedAt) === today) areas.add(p.area);
      }
    }
  }
  return [...areas];
}

/** The workout was stopped for sharp pain. */
export const stoppedForPain = (w: WorkoutRecord) =>
  w.pains.some((p) => p.type === 'sharp' && p.action === 'stopped');

/** Changes whenever the safety side of the input changes (to re-run the check). */
export const safetyKey = (input: GeneratorInput | null) =>
  input
    ? JSON.stringify([
        input.painAreas,
        input.conditions,
        input.position,
        input.restrictions,
        input.hardRestrictions ?? [],
        input.painToday ?? [],
        input.stoppedToday ?? [],
        input.movementLimits ?? [],
        input.location,
        [...input.equipment].sort(),
      ])
    : '';

/** Areas with dull pain reported today (swapped or skipped): ruled out whole today. */
export function dullPainAreasToday(workouts: WorkoutRecord[], today: string): string[] {
  const areas = new Set<string>();
  for (const w of workouts)
    for (const p of w.pains)
      if (p.type === 'dull' && p.area !== 'other' && localDay(p.reportedAt) === today)
        areas.add(p.area);
  return [...areas];
}
