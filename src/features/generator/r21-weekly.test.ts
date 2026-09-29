/**
 * Phase 21 (Daniel): weekly working sets per primary muscle over any 7 days —
 * adults 20, teens 14, 60+ and joint care 12 — in the generator, the extra
 * sets for spare time and the "+1 exercise?" offer.
 */
import { devLibrary } from '../exercises/library';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { planById } from '../program/plans';

import { generateSession, withOneMoreExercise } from './generate';
import { maxWeeklySets, simulate } from './r8-sim';
import type { GeneratorInput, RecentSession } from './types';

const LIBRARY = devLibrary();
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 90,
  mainGoals: ['look'],
  muscleGoals: [{ muscleKey: 'midChest', goal: 'grow' }],
  exercisesPerSession: 6,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};

it.each([
  ['adult PPL 6', {}, 'muscle-ppl-6', [1, 2, 3, 4, 5, 6], 20],
  ['adult Upper/Lower 5', {}, 'muscle-upperLower-5', [1, 2, 3, 4, 5], 20],
  ['adult, no plan, 6 days, 90 min', {}, null, [1, 2, 3, 4, 5, 6], 20],
  ['teen, 4 days', { mode: 'teen', band: 'teen' }, null, [1, 2, 4, 5], 14],
  ['60+, 4 days', { mode: 'senior', band: 'senior' }, null, [1, 2, 4, 5], 12],
  ['joint care (knee), 5 days', { painAreas: ['knee'] }, null, [1, 2, 3, 4, 5], 20],
] as const)('%s never passes its weekly cap', (_n, patch, plan, days, cap) => {
  for (const start of ['2026-09-07', '2026-10-01']) {
    const sim = simulate({
      base: { ...base, ...(patch as Partial<GeneratorInput>) },
      library: LIBRARY,
      plan: plan ? planById(plan) : undefined,
      start,
      weekdays: [...days],
      weeks: 4,
    });
    const worst = maxWeeklySets(sim);
    expect({ start, ...worst, ok: worst.sets <= cap }).toMatchObject({ ok: true });
  }
});

it('a muscle at its cap gets no more sets: the target is skipped', () => {
  const chest = LIBRARY.find((e) => e.slug === 'flat_dumbbell_press')!;
  const full: RecentSession = {
    date: '2026-09-25',
    at: '2026-09-25T12:00:00Z',
    mainMuscles: ['midChest'],
    exerciseIds: [chest.id],
    muscleSets: { midChest: 20 },
  };
  const s = generateSession({
    ...base,
    today: '2026-09-28',
    now: '2026-09-28T12:00:00Z',
    recentSessions: [full],
  });
  const chestSets = s.items
    .filter((i) => i.role === 'main')
    .filter((i) =>
      LIBRARY.find((e) => e.id === i.exerciseId)!.muscles.some(
        (m) =>
          m.role === 'primary' &&
          ['upperChest', 'midChest', 'lowerChest', 'chest'].includes(m.muscleKey),
      ),
    )
    .reduce((n, i) => n + i.sets, 0);
  expect(chestSets).toBe(0);
});

it('a partly used muscle gets only the sets left, and "+1 exercise?" never adds past the cap', () => {
  const recent: RecentSession[] = [
    {
      date: '2026-09-26',
      at: '2026-09-26T12:00:00Z',
      mainMuscles: ['midChest'],
      exerciseIds: [],
      muscleSets: { midChest: 18 },
    },
  ];
  const input = {
    ...base,
    today: '2026-09-28',
    now: '2026-09-28T12:00:00Z',
    recentSessions: recent,
  };
  const first = generateSession(input);
  for (const s of [first, withOneMoreExercise(input, first)]) {
    if (!s) continue;
    const chest = s.items
      .filter((i) => i.role === 'main')
      .filter((i) =>
        LIBRARY.find((e) => e.id === i.exerciseId)!.muscles.some(
          (m) =>
            m.role === 'primary' &&
            ['upperChest', 'midChest', 'lowerChest', 'chest'].includes(m.muscleKey),
        ),
      )
      .reduce((n, i) => n + i.sets, 0);
    expect(chest).toBeLessThanOrEqual(2);
  }
});

it('joint care: a knee move stops at 12 weekly sets for its muscles', () => {
  const recent: RecentSession[] = [
    {
      date: '2026-09-26',
      at: '2026-09-26T12:00:00Z',
      mainMuscles: ['quads'],
      muscleSets: { quads: 12 },
    },
  ];
  const s = generateSession({
    ...base,
    painAreas: ['knee'],
    muscleGoals: [{ muscleKey: 'quads', goal: 'grow' }],
    today: '2026-09-28',
    now: '2026-09-28T12:00:00Z',
    recentSessions: recent,
  });
  for (const i of s.items.filter((x) => x.role === 'main')) {
    const e = LIBRARY.find((x) => x.id === i.exerciseId)!;
    const quads = e.muscles.some((m) => m.role === 'primary' && m.muscleKey === 'quads');
    const knee = e.joints.some((j) => j.joint === 'knee');
    expect(quads && knee).toBe(false);
  }
});
