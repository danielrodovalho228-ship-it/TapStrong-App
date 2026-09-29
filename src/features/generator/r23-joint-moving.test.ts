/**
 * Daniel, R10 decision 3: the painful-joint budget (12 sets a week) counts
 * only exercises that MOVE the joint. A move where the joint only holds still
 * or stabilises (tagged isometric) doesn't use it. One moving and one
 * isometric example per joint area, in the history and in the generator.
 */
import { devLibrary } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { JOINT_AREA, movedAreas, movementKey, type JointKey } from '../movement/catalog';
import { recentSessions } from '../workout/plan';
import type { WorkoutRecord } from '../workout/types';

import { generateSession, JOINT_CARE_WEEKLY_SETS } from './generate';
import type { GeneratorInput } from './types';

const LIBRARY = devLibrary();
const bySlug = (s: string) => {
  const e = LIBRARY.find((x) => x.slug === s);
  if (!e) throw new Error(s);
  return e;
};

// [area, moves the joint, joint only holds still]
const CASES: [string, string, string][] = [
  ['knee', 'goblet_squat', 'barbell_hip_thrust'],
  ['shoulder', 'push_up', 'barbell_back_squat'],
  ['lower_back', 'back_extension_bench', 'glute_bridge'],
  ['hip', 'glute_bridge', 'bridge_floor_press'],
  ['elbow_wrist', 'dumbbell_curl', 'goblet_squat'],
  // Neck holds are in the Repair library only (never capped); tags and history still checked.
  ['neck', 'crunch', 'chin_tuck'],
];

const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 60,
  mainGoals: ['look'],
  muscleGoals: [],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};

function logged(slug: string, sets = 3): WorkoutRecord {
  const e = bySlug(slug);
  const at = '2026-09-26T09:00:00';
  return {
    id: `w-${slug}`,
    kind: 'regular',
    status: 'done',
    createdAt: at,
    startedAt: at,
    endedAt: at,
    session: {
      items: [
        {
          id: 'm',
          role: 'main',
          part: 'main',
          exerciseId: e.id,
          targetMuscle: e.muscles[0].muscleKey,
          goal: null,
          sets,
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 60,
        },
      ],
      minutes: 30,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 30,
      notes: [],
    },
    logs: Array.from({ length: sets }, (_, n) => ({
      itemId: 'm',
      exerciseId: e.id,
      setNo: n + 1,
      reps: 10,
      loggedAt: at,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  } as unknown as WorkoutRecord;
}

/** The example as a starred exercise for its own muscle, so the generator tries it first. */
function tryPick(area: string, slug: string, used: number) {
  const e = bySlug(slug);
  const muscle = e.muscles.find((m) => m.role === 'primary')!.muscleKey;
  // A painful area judged movement by movement, with the example's own
  // movements rated pain-free: safety lets it through, only the budget decides.
  const joints = (Object.keys(JOINT_AREA) as JointKey[]).filter((j) => JOINT_AREA[j] === area);
  const s = generateSession({
    ...base,
    movementLimits: [
      {
        area,
        joints,
        painful: [],
        painFree: e.joints.map((j) => movementKey(j.joint, j.movement)),
        score: 2,
      },
    ],
    muscleGoals: [{ muscleKey: muscle, goal: 'strengthen' }],
    favourites: [e.id],
    recentSessions: [
      {
        date: '2026-09-26',
        at: '2026-09-26T09:00:00Z',
        mainMuscles: [],
        exerciseIds: [],
        muscleSets: {},
        jointSets: { [area]: used },
      },
    ],
  });
  return s.items.filter((i) => i.role === 'main').map((i) => i.exerciseId);
}

describe.each(CASES)('%s', (area, moving, still) => {
  it(`tags: ${moving} moves it, ${still} only holds it`, () => {
    expect(movedAreas(bySlug(moving).joints)).toContain(area);
    expect(movedAreas(bySlug(still).joints)).not.toContain(area);
    expect(bySlug(still).joints.some((j) => JOINT_AREA[j.joint] === area)).toBe(true);
  });

  it('history: only the moving example uses the budget', () => {
    const [m] = recentSessions([logged(moving)], LIBRARY);
    const [s] = recentSessions([logged(still)], LIBRARY);
    expect(m.jointSets?.[area]).toBe(3);
    expect(s.jointSets?.[area]).toBeUndefined();
  });

  it(`generator, budget used up: ${moving} is left out, ${still} is still picked`, () => {
    // Budget free: the moving example is picked (so the test can fail).
    expect(tryPick(area, moving, 0)).toContain(bySlug(moving).id);
    expect(tryPick(area, moving, JOINT_CARE_WEEKLY_SETS)).not.toContain(bySlug(moving).id);
    if (!bySlug(still).rehab)
      expect(tryPick(area, still, JOINT_CARE_WEEKLY_SETS)).toContain(bySlug(still).id);
  });
});

it("Daniel's knee list: moves where the knee only stabilises don't use the knee budget", () => {
  for (const slug of [
    'dumbbell_shrug',
    'barbell_shrug',
    'dumbbell_farmer_hold',
    'dumbbell_farmer_walk',
    'glute_bridge',
    'barbell_hip_thrust',
    'bridge_floor_press',
    'rx_hip_hinge_hold',
    'band_lateral_walk',
  ])
    expect([slug, movedAreas(bySlug(slug).joints).includes('knee')]).toEqual([slug, false]);
  for (const slug of ['goblet_squat', 'dumbbell_split_squat', 'machine_leg_extension'])
    expect([slug, movedAreas(bySlug(slug).joints).includes('knee')]).toEqual([slug, true]);
});
