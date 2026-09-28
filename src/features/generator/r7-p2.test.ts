/**
 * QA round 7 — P2 (generator): pull balance on Build-muscle plans, side
 * plank with high blood pressure, no holds as gym main work for any gym
 * goal, and none in a gym-strength Single workout.
 */
import { devLibrary } from '../exercises/library';
import { muscleByKey } from '../muscles';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { planById, planDayInput } from '../program/plans';

import { blockReason } from './filters';
import { generateSession } from './generate';
import type { GeneratorInput, RecentSession } from './types';

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const groupOf = (k: string) => muscleByKey(muscleByKey(k)?.parentKey ?? k)?.movementGroup;
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
  muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

describe('pull balance on ready-made Build muscle plans', () => {
  it.each([
    ['muscle-upperLower-4', [0, 1, 3, 4]],
    ['muscle-fullBody-4', [0, 1, 3, 4]],
    ['muscle-fullBody-3', [0, 2, 4]],
  ] as const)('%s: every calendar week pull ≥ 90%% of push, a real vertical pull', (id, days) => {
    const plan = planById(id)!;
    const recent: RecentSession[] = [];
    let k = 0;
    for (let w = 0; w < 5; w++) {
      let push = 0;
      let pull = 0;
      let vertical = 0;
      for (const dow of days) {
        const day = new Date(Date.parse('2026-09-07T12:00:00Z') + (w * 7 + dow) * 864e5)
          .toISOString()
          .slice(0, 10);
        const input = { ...base, today: day, now: `${day}T12:00:00Z`, recentSessions: [...recent] };
        const s = generateSession(planDayInput(input, plan, k++, LIBRARY));
        for (const i of main(s)) {
          const e = byId.get(i.exerciseId)!;
          const g = groupOf(e.muscles.find((m) => m.role === 'primary')!.muscleKey);
          if (g === 'push') push += i.sets;
          if (g === 'pull') pull += i.sets;
          if (e.pattern === 'vertical_pull') vertical++;
          expect(e.dose).not.toBe('time');
        }
        recent.unshift({
          date: day,
          at: `${day}T12:00:00Z`,
          mainMuscles: main(s).flatMap((i) =>
            byId
              .get(i.exerciseId)!
              .muscles.filter((m) => m.role === 'primary')
              .map((m) => m.muscleKey),
          ),
          exerciseIds: main(s).map((i) => i.exerciseId),
        });
      }
      expect(pull).toBeGreaterThanOrEqual(0.9 * push);
      expect(vertical).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('holds and blood pressure', () => {
  it('side plank is left out for high blood pressure', () => {
    const e = LIBRARY.find((x) => x.slug === 'side_plank')!;
    expect(
      blockReason(e, { ...base, location: e.location[0], conditions: ['high_blood_pressure'] }),
    ).toBe('contraindication');
  });

  it.each(['fitness', 'lose_weight'] as const)('gym "%s": no holds as main work', (goal) => {
    for (let d = 0; d < 6; d++) {
      const day = `2026-09-${String(7 + d).padStart(2, '0')}`;
      const s = generateSession({
        ...base,
        mainGoals: [goal],
        muscleGoals: [
          { muscleKey: 'abs', goal: 'firm' },
          { muscleKey: 'lats', goal: 'firm' },
        ],
        today: day,
      });
      for (const i of main(s)) expect(byId.get(i.exerciseId)!.dose).not.toBe('time');
    }
  });

  it('a gym-strength Single workout for adductors picks a moving exercise', () => {
    const s = generateSession({
      ...base,
      mainGoals: ['strength'],
      targetsOnly: true,
      muscleGoals: [{ muscleKey: 'adductors', goal: 'strengthen' }],
      exercisesPerSession: 2,
      today: '2026-09-28',
    });
    expect(main(s).length).toBeGreaterThan(0);
    for (const i of main(s)) expect(byId.get(i.exerciseId)!.dose).not.toBe('time');
  });
});
