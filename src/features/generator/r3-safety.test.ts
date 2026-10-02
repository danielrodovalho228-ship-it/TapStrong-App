/**
 * QA round 3 — safety fixes: swaps get the generator's filters and dosing
 * (R3-07) and loaded moves that need both hands never reach someone who
 * trains with support (R3-09).
 */
import seed from '../../../supabase/seed/exercises.json';
import { fromSeed, type SeedExercise } from '../exercises/library';
import type { Exercise } from '../exercises/types';
import type { MovementKey } from '../movement/catalog';
import type { MovementLimit } from '../movement/rules';
import { EQUIPMENT_GROUPS, normalizeEquipment } from '../equipment/catalog';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { workoutInput } from '../workout/safety';

import { rampAllowed } from './alternatives';
import {
  blockReason,
  generateSession,
  getAlternatives,
  swapItem,
  type GeneratorInput,
} from './index';

const LIBRARY: Exercise[] = (seed.exercises as SeedExercise[]).map(fromSeed);
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const bySlug = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 40,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const gen = (patch: Partial<GeneratorInput> = {}) => generateSession({ ...base, ...patch });
const usesKnee = (e: Exercise) => e.joints.some((j) => j.joint === 'knee');

describe('R3-07 swaps get the same dosing as generation', () => {
  it('a swapped-in move that loads a restricted knee is light, 12–15', () => {
    const input = { ...base, restrictions: ['knee'] };
    const s = generateSession(input);
    const item = s.items.find((i) => i.role === 'main' && i.targetMuscle === 'quads')!;
    const kneeAlts = getAlternatives(s, item.id, input).filter(usesKnee);
    expect(kneeAlts.length).toBeGreaterThan(0);
    for (const alt of kneeAlts) {
      const swapped = swapItem(s, item.id, alt, input, { reason: 'user_choice' }).session;
      const after = swapped.items.find((i) => i.id === item.id)!;
      if (alt.dose === 'reps') expect(after.reps).toEqual([12, 15]);
      expect(after.loadHint).not.toBe('heavy');
    }
  });

  it('the ramp-up follows a swap only when the new lift may have one', () => {
    const s = gen();
    const ramp = s.items.find((i) => i.part === 'ramp_up')!;
    expect(ramp).toBeTruthy();
    const target = s.items.find((i) => i.role === 'main' && i.exerciseId === ramp.exerciseId)!;
    const kneeLift = LIBRARY.find(
      (e) =>
        e.loaded &&
        usesKnee(e) &&
        e.parts.includes('main') &&
        !e.contraindications.includes('knee') &&
        e.id !== target.exerciseId &&
        blockReason(e, { ...base, restrictions: ['knee'] }) === null,
    )!;
    // Same lift, a knee restriction: no ramp-up after it.
    const restricted = { ...base, restrictions: ['knee'] };
    expect(rampAllowed(kneeLift, restricted)).toBe(false);
    const dropped = swapItem(s, target.id, kneeLift, restricted, { reason: 'user_choice' });
    expect(dropped.session.items.some((i) => i.part === 'ramp_up')).toBe(false);
    // Heart condition: no ramp-up either.
    const heart = { ...base, conditions: ['heart_condition'] };
    const noRamp = swapItem(s, target.id, kneeLift, heart, { reason: 'user_choice' });
    expect(noRamp.session.items.some((i) => i.part === 'ramp_up')).toBe(false);
    // No restriction: the ramp-up follows the new lift.
    const kept = swapItem(s, target.id, kneeLift, base, { reason: 'user_choice' });
    expect(kept.session.items.find((i) => i.part === 'ramp_up')?.exerciseId).toBe(kneeLift.id);
  });

  it('Laura in recovery phase 1 is never offered a hold ruled out for her shoulder', () => {
    const limit: MovementLimit = {
      area: 'shoulder',
      joints: ['shoulder'],
      painful: ['shoulder.abduction' as MovementKey],
      painFree: [],
      score: 3,
      phase: 1,
    };
    const input: GeneratorInput = {
      ...base,
      location: 'home',
      equipment: [],
      muscleGoals: [{ muscleKey: 'shoulders', goal: 'strengthen' }],
      movementLimits: [limit],
    };
    const airplane = bySlug('airplane_arm_hold');
    expect(blockReason(airplane, input)).toBe('painful_movement');
    // Phase 2 keeps the old rule: a gentle hold is fine while pain is low.
    expect(blockReason(airplane, { ...input, movementLimits: [{ ...limit, phase: 2 }] })).toBe(
      null,
    );
    const s = generateSession(input);
    for (const item of s.items.filter((i) => i.role === 'main')) {
      const alts = getAlternatives(s, item.id, input).map((e) => e.slug);
      expect(alts).not.toContain('airplane_arm_hold');
    }
  });

  it('a recovery workout swaps with its recovery rules', () => {
    const input = workoutInput({ kind: 'repair' }, base);
    expect(input.rehab).toBe(true);
    expect(input.allowReducedRange).toBe(false);
    expect(workoutInput({ kind: 'regular' }, base)).toBe(base);
  });
});

/** Machines with a seat or pad (not cable stations). */
const isMachineSeat = (q: string) =>
  !(EQUIPMENT_GROUPS.cables as readonly string[]).includes(q) &&
  (Object.entries(EQUIPMENT_GROUPS).some(
    ([g, items]) => g.startsWith('machines') && (items as readonly string[]).includes(q),
  ) ||
    ['assisted_pull_up_machine', 'dip_station', 'roman_chair', 'exercise_bike', 'rower'].includes(
      q,
    ));

/** Loaded moves a person who holds a chair can still do: a seat, a pad or a free hand. */
const SUPPORTED_OR_ONE_HAND = new Set([
  'cable_kickback',
  'cable_lateral_raise',
  'cable_terminal_knee_extension',
  'chest_supported_dumbbell_row',
  'chest_supported_reverse_fly',
  'dumbbell_kickback',
  'dumbbell_rear_delt_row',
  'dumbbell_seated_calf_raise',
  'dumbbell_wrist_extension',
  'dumbbell_wrist_rotation',
  'incline_prone_y_raise',
  // Phase 30 shoulder program: one arm, lying or kneeling on a bench or bed.
  'kneeling_thumbs_up_raise',
  'prone_horizontal_abduction',
  'prone_table_scapular_retraction',
  'side_lying_internal_rotation',
  'supine_shoulder_rotation_90',
  'lat_pulldown',
  'leaning_lateral_raise',
  'one_arm_dumbbell_row',
  'rp_cable_hip_abduction',
  'rp_cable_hip_adduction',
  'rp_dumbbell_forearm_turns',
  'rp_dumbbell_side_bend',
  'rp_light_suitcase_walk',
  'rp_side_lying_ir_dumbbell',
  'rx_dumbbell_end_hold',
  'rx_dumbbell_wrist_hold',
  'rx_forearm_rotation_partial',
  'rx_suitcase_hold',
  'rx_waiter_hold',
  'seated_cable_row',
  'single_arm_cable_pulldown',
  'single_arm_cable_reverse_fly',
  'single_arm_cable_row',
  'single_arm_high_to_low_cable_fly',
  'staggered_stance_dumbbell_row',
  'wide_grip_cable_row',
]);

describe('R3-09 loaded moves that need both hands are not "with support"', () => {
  it('library audit: every loaded free-weight or cable move tagged with support leaves a hand free or has a seat', () => {
    const offenders = LIBRARY.filter(
      (e) =>
        e.loaded &&
        e.positions.includes('with_support') &&
        !e.equipment.some(isMachineSeat) &&
        !SUPPORTED_OR_ONE_HAND.has(e.slug),
    ).map((e) => e.slug);
    expect(offenders).toEqual([]);
  });

  it('the moves from the report are gone for someone training with support', () => {
    for (const slug of ['dumbbell_split_squat', 'dumbbell_single_leg_rdl', 'dumbbell_curl']) {
      expect(bySlug(slug).positions).not.toContain('with_support');
    }
  });

  it('Rosa (68, fell, osteoporosis, with support, dumbbells) gets no two-handed loaded move', () => {
    for (const minutes of [20, 30, 45]) {
      const s = gen({
        mode: 'senior',
        band: 'senior',
        position: 'with_support',
        location: 'home',
        equipment: normalizeEquipment(['dumbbells', 'bench', 'mat', 'bands']),
        conditions: ['fell_last_year', 'osteoporosis'],
        mainGoals: ['balance', 'strength'],
        muscleGoals: [
          { muscleKey: 'quads', goal: 'strengthen' },
          { muscleKey: 'glutes', goal: 'strengthen' },
          { muscleKey: 'hamstrings', goal: 'strengthen' },
        ],
        minutes,
      });
      for (const item of s.items) {
        const e = byId.get(item.exerciseId)!;
        if (!e.loaded || e.equipment.some(isMachineSeat)) continue;
        expect(SUPPORTED_OR_ONE_HAND.has(e.slug)).toBe(true);
      }
    }
  });
});
