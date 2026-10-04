/**
 * Phase 30: the "Shoulder: mobility and strength" program — sessions A/B/C,
 * doses, the stretch timer, the affected side, the schedule, maintenance and
 * load progression (never after "I feel pain" this week).
 */
import { devLibrary } from '../exercises/library';
import { restFor } from '../settings/store';
import { cooldownHold, sideOf, stepKind } from '../workout/flow';
import type { WorkoutRecord } from '../workout/types';

import {
  buildProgramSession,
  programWeek,
  SHOULDER_PROGRAM as P,
  suggestedSession,
} from './programs';
import { programLoadAdvice } from './progress';

const LIBRARY = devLibrary();
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const build = (
  key: 'A' | 'B' | 'C',
  affected: 'right' | 'left' | 'both' = 'right',
  increased = {},
) => buildProgramSession(P, key, { library: LIBRARY, affected, week: 1, increased });
const slugOf = (id: string) => LIBRARY.find((e) => e.id === id)!.slug;

describe('the 18 exercises', () => {
  it('are all in the library (rehab drafts), numbered 1–18 in order', () => {
    expect(P.exercises.map((e) => e.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const ex of P.exercises) expect(bySlug.has(ex.slug)).toBe(true);
    const fresh = [
      'pendulum_swing',
      'crossover_arm_stretch',
      'stick_internal_rotation_stretch',
      'stick_external_rotation_stretch',
      'sleeper_stretch',
      'band_external_rotation_90',
      'band_internal_rotation',
      'band_external_rotation',
      'kneeling_thumbs_up_raise',
      'prone_scapula_setting',
      'prone_table_scapular_retraction',
      'prone_horizontal_abduction',
      'supine_shoulder_rotation_90',
      'side_lying_internal_rotation',
    ];
    for (const slug of fresh) expect(bySlug.get(slug)?.rehab).toBe(true);
  });
});

describe('sessions', () => {
  it('A — mobility: stretches 1–5 only, holds of 30 s with 30 s rest; never behind the back', () => {
    const s = build('A');
    expect(s.missing).toEqual([]);
    // Stretch 3 reaches behind the back (database tag): left out (Phase 32 A1).
    expect(s.excluded).toEqual(['stick_internal_rotation_stretch']);
    expect(s.program).toEqual({ id: P.id, session: 'A', week: 1 });
    expect(s.items.map((i) => slugOf(i.exerciseId))).toEqual([
      'pendulum_swing',
      'crossover_arm_stretch',
      'stick_external_rotation_stretch',
      'sleeper_stretch',
    ]);
    const cross = s.items[1];
    expect(stepKind(cross)).toBe('hold');
    expect(cross.holdSeconds).toEqual([30, 30]);
    expect(cross.restSeconds).toBe(30);
    expect(cooldownHold(cross)).toBe(30);
    // 4 × 30 s on the affected side, then 4 on the other (§1: repeat the other side).
    expect(cross.sets).toBe(8);
    expect(cross.sides).toEqual(['right', 'left']);
    expect([1, 4, 5, 8].map((n) => sideOf(cross, n))).toEqual(['right', 'right', 'left', 'left']);
    // The 30 s rest stays 30 s whatever the Settings rest is.
    expect(restFor(cross, { restStrength: 120, restHold: 90 })).toBe(30);
    // The sleeper stretch is on the affected side only.
    expect(s.items[3].sets).toBe(4);
    expect(s.items[3].sides).toEqual(['right']);
  });

  it('B — bands: warm-up walk first, stretches, bands 6–9 at 3×8–12, stretches again last', () => {
    const s = build('B');
    const blocks = s.items.map((i) => i.block);
    expect(blocks[0]).toBe('warmup');
    expect(s.items[0].durationSeconds).toBe(5 * 60);
    expect(blocks.filter((b) => b === 'band')).toHaveLength(4);
    expect(blocks).not.toContain('dumbbell');
    expect(blocks.at(-1)).toBe('stretch_end');
    expect(s.items.at(-1)!.role).toBe('cooldown');
    for (const i of s.items.filter((x) => x.block === 'band')) {
      expect(i.reps).toEqual([8, 12]);
      expect(i.noteKey).toBe('rehab.notes.cable');
    }
    // The row uses both arms; the rotations only the affected one.
    const row = s.items.find((i) => slugOf(i.exerciseId) === 'band_row')!;
    expect(row.sets).toBe(3);
    expect(row.sides).toBeUndefined();
    const er = s.items.find((i) => slugOf(i.exerciseId) === 'band_external_rotation')!;
    expect(er.sets).toBe(3);
    expect(er.sides).toEqual(['right']);
  });

  it('C — light dumbbells 10–18 with their own doses', () => {
    const s = build('C', 'left');
    const dumbbells = s.items.filter((i) => i.block === 'dumbbell');
    expect(dumbbells.map((i) => slugOf(i.exerciseId))).toEqual(
      P.exercises.filter((e) => e.block === 'dumbbell').map((e) => e.slug),
    );
    const of = (slug: string) => dumbbells.find((i) => slugOf(i.exerciseId) === slug)!;
    expect(of('kneeling_thumbs_up_raise').reps).toEqual([20, 20]);
    expect(of('kneeling_thumbs_up_raise').sides).toEqual(['left']);
    // Exercise 13: 10 holds of 10 s, counted down.
    const setting = of('prone_scapula_setting');
    expect(setting.sets).toBe(10);
    expect(setting.holdSeconds).toEqual([10, 10]);
    expect(cooldownHold(setting)).toBe(10);
    expect(of('rx_side_lying_er').sets).toBe(2);
    expect(of('rx_side_lying_er').reps).toEqual([8, 10]);
    // The AAOS triceps kickback, arm at the side (Phase 32 A1).
    expect(of('dumbbell_kickback').sides).toEqual(['left']);
    expect(of('dumbbell_kickback').noteKey).toBeUndefined();
  });

  it('after raising the load: back to fewer reps', () => {
    const s = build('C', 'right', { kneeling_thumbs_up_raise: true, rx_side_lying_er: true });
    const of = (slug: string) => s.items.find((i) => slugOf(i.exerciseId) === slug)!;
    expect(of('kneeling_thumbs_up_raise').reps).toEqual([15, 15]);
    expect(of('rx_side_lying_er').sets).toBe(3);
    expect(of('rx_side_lying_er').reps).toEqual([5, 5]);
    expect(of('dumbbell_curl').reps).toEqual([8, 12]);
  });

  it('both shoulders: every one-sided exercise on both sides', () => {
    const s = build('A', 'both');
    expect(s.items[3].sides).toEqual(['right', 'left']);
    expect(s.items[3].sets).toBe(8);
  });

  it('an exercise missing from the library is left out and listed, never invented', () => {
    const s = buildProgramSession(P, 'A', {
      library: LIBRARY.filter((e) => e.slug !== 'sleeper_stretch'),
      affected: 'right',
      week: 1,
    });
    expect(s.missing).toEqual(['sleeper_stretch']);
    expect(s.items).toHaveLength(3);
  });
});

describe('schedule', () => {
  const start = '2026-10-05';
  const at = (offset: number) => {
    const d = new Date(Date.parse(`${start}T12:00:00Z`) + offset * 864e5);
    return d.toISOString().slice(0, 10);
  };
  it('weeks 1–2: B on 3 days, A on the others', () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => suggestedSession(P, start, at(d), false).session);
    expect(week).toEqual(['B', 'A', 'B', 'A', 'B', 'A', 'A']);
    expect(programWeek(start, at(13))).toBe(2);
  });

  it('from week 3: C and B take turns on the strength days', () => {
    const days = [14, 16, 18, 21, 23, 25].map(
      (d) => suggestedSession(P, start, at(d), false).session,
    );
    expect(days.filter((x) => x === 'C')).toHaveLength(3);
    expect(days.filter((x) => x === 'B')).toHaveLength(3);
    expect(days[0]).not.toBe(days[1]);
    expect(suggestedSession(P, start, at(15), false).session).toBe('A');
  });

  it('after week 6: nothing unless maintenance, then B or C 3 days a week', () => {
    expect(suggestedSession(P, start, at(42), false)).toEqual({ week: 7, session: null });
    const week = [42, 43, 44, 45, 46, 47, 48].map(
      (d) => suggestedSession(P, start, at(d), true).session,
    );
    expect(week.filter(Boolean)).toHaveLength(3);
    expect(week.filter((x) => x === 'A')).toHaveLength(0);
  });
});

describe('load progression', () => {
  const curl = bySlug.get('dumbbell_curl')!;
  const session = (id: string, day: string, rpe: number, pain = false): WorkoutRecord => ({
    id,
    kind: 'repair',
    createdAt: `${day}T09:00:00Z`,
    startedAt: `${day}T09:00:00Z`,
    endedAt: `${day}T09:40:00Z`,
    status: 'done',
    session: { ...build('C'), program: { id: P.id, session: 'C', week: 1 } },
    logs: [1, 2, 3].map((setNo) => ({
      itemId: 'dumbbell-10',
      exerciseId: curl.id,
      setNo,
      reps: 12,
      load: 1,
      unit: 'kg' as const,
      rpe,
      loggedAt: `${day}T09:10:00Z`,
    })),
    skipped: [],
    swaps: [],
    pains: pain
      ? [
          {
            itemId: 'stretch-2',
            exerciseId: bySlug.get('crossover_arm_stretch')!.id,
            area: 'shoulder',
            type: 'dull' as const,
            action: 'continued' as const,
            reportedAt: `${day}T09:20:00Z`,
          },
        ]
      : [],
  });
  const now = new Date('2026-10-20T12:00:00Z');

  it('two sessions in a row "easy and painless" → raise', () => {
    const w = [session('a', '2026-10-15', 6), session('b', '2026-10-17', 6)];
    expect(programLoadAdvice({ workouts: w, programId: P.id, exercise: curl, now })).toEqual({
      kind: 'raise',
    });
  });

  it('one hard session → not yet', () => {
    const w = [session('a', '2026-10-15', 8), session('b', '2026-10-17', 6)];
    expect(programLoadAdvice({ workouts: w, programId: P.id, exercise: curl, now }).kind).toBe(
      'keep',
    );
  });

  it('"I feel pain" this week blocks it, on any exercise', () => {
    const w = [session('a', '2026-10-15', 6), session('b', '2026-10-17', 6, true)];
    expect(programLoadAdvice({ workouts: w, programId: P.id, exercise: curl, now })).toEqual({
      kind: 'keep',
      reason: 'pain',
    });
    // A week later the block is gone again.
    const later = new Date('2026-10-26T12:00:00Z');
    const w2 = [...w, session('c', '2026-10-22', 6), session('d', '2026-10-24', 6)];
    expect(
      programLoadAdvice({ workouts: w2, programId: P.id, exercise: curl, now: later }).kind,
    ).toBe('raise');
  });
});
