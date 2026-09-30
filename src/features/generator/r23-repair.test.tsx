/**
 * QA R10-02 and Daniel's R10 decision 2: a Repair session built the way the
 * app builds it (repairInput → Repair screen Start) is never cut by the
 * weekly cap; Repair sets count for the muscle cap, not the joint budget.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import RepairPlanScreen from '@/app/repair/plan';
import { devLibrary } from '@/features/exercises/library';
import { muscleByKey } from '@/features/muscles';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { recentSessions, repairInput } from '@/features/workout/plan';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { GYM_EQUIPMENT_OPTIONS } from '@/features/onboarding/options';

import { generateSession } from './generate';
import type { GeneratorInput, RecentSession } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

const LIBRARY = devLibrary();
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
const focus = [{ muscleKey: 'glutes', goal: 'strengthen' as const }];
const main = (s: ReturnType<typeof generateSession>) =>
  s.items.filter((i) => i.role === 'main').map((i) => [i.exerciseId, i.sets]);
const capped = (muscles: string[]): RecentSession[] => [
  {
    date: '2026-09-25',
    at: '2026-09-25T12:00:00Z',
    mainMuscles: muscles,
    exerciseIds: [],
    muscleSets: Object.fromEntries(muscles.map((m) => [m, 30])),
  },
];

it('repairInput builds the same session with glutes at the cap', () => {
  const normal = generateSession(repairInput(base, focus, 20));
  const atCap = generateSession(
    repairInput({ ...base, recentSessions: capped(['glutes']) }, focus, 20),
  );
  expect(main(atCap)).toEqual(main(normal));
  expect(atCap.notes.map((n) => n.key)).not.toContain('generator.notes.weeklyCap');
});

it('every muscle capped: the Repair session still builds', () => {
  const all = [...new Set(LIBRARY.flatMap((e) => e.muscles.map((m) => m.muscleKey)))];
  const s = generateSession(repairInput({ ...base, recentSessions: capped(all) }, focus, 20));
  expect(s.error).toBeUndefined();
  expect(main(s).length).toBeGreaterThan(0);
});

it('the Repair screen Start opens a session at the cap', async () => {
  clock.now = () => new Date('2026-09-28T12:00:00Z');
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1985,
      minutes: 30,
      mainGoals: ['look'],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useProgressStore.getState().setRepairPlan({
      createdAt: '2026-09-20T00:00:00Z',
      weeks: 6,
      sessionsPerWeek: 3,
      focus,
      retestAt: '2026-11-01T00:00:00Z',
    });
    // Every muscle worked past the cap this week (regular workouts): before
    // the fix, Start did nothing here.
    const parent = (k: string) => muscleByKey(k)?.parentKey ?? k;
    const perParent = new Map<string, string>();
    for (const e of LIBRARY)
      if (e.parts.includes('main') && e.pattern !== 'balance')
        for (const m of e.muscles.filter((x) => x.role === 'primary'))
          if (!perParent.has(parent(m.muscleKey))) perParent.set(parent(m.muscleKey), e.id);
    const at = '2026-09-26T09:00:00Z';
    const items = [...perParent.values()].map((exerciseId, n) => ({
      id: `m${n}`,
      role: 'main',
      part: 'main',
      exerciseId,
      targetMuscle: null,
      goal: null,
      sets: 25,
      restSeconds: 60,
      perSide: false,
      loadHint: null,
      estSeconds: 60,
    }));
    useWorkoutStore.setState({
      workouts: [
        {
          id: 'w',
          kind: 'regular',
          status: 'done',
          createdAt: at,
          startedAt: at,
          endedAt: at,
          session: {
            items,
            minutes: 60,
            warmupMinutes: 5,
            cooldownMinutes: 5,
            estimatedMinutes: 60,
            notes: [],
          },
          logs: items.flatMap((i) =>
            Array.from({ length: 25 }, (_, n) => ({
              itemId: i.id,
              exerciseId: i.exerciseId,
              setNo: n + 1,
              reps: 10,
              loggedAt: at,
            })),
          ),
          skipped: [],
          swaps: [],
          pains: [],
        } as unknown as WorkoutRecord,
      ],
    });
  });
  await render(<RepairPlanScreen />);
  await fireEvent.press(screen.getByRole('button', { name: /Repair ·/ }));
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/workout/[id]' }));
  const repair = useWorkoutStore.getState().workouts.find((w) => w.kind === 'repair')!;
  expect(repair.session.items.some((i) => i.role === 'main')).toBe(true);
});

describe("Daniel's R10 decision 2: Repair and the joint budget", () => {
  const repairDone = (id: string, date: string): WorkoutRecord => {
    const squat = LIBRARY.find((e) => e.slug === 'goblet_squat')!;
    const at = `${date}T09:00:00Z`;
    return {
      id,
      kind: 'repair',
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
            exerciseId: squat.id,
            targetMuscle: 'quads',
            goal: 'strengthen',
            sets: 6,
            restSeconds: 60,
            perSide: false,
            loadHint: null,
            estSeconds: 60,
          },
        ],
        minutes: 20,
        warmupMinutes: 5,
        cooldownMinutes: 5,
        estimatedMinutes: 20,
        notes: [],
      },
      logs: Array.from({ length: 6 }, (_, n) => ({
        itemId: 'm',
        exerciseId: squat.id,
        setNo: n + 1,
        reps: 10,
        loggedAt: at,
      })),
      skipped: [],
      swaps: [],
      pains: [],
    } as unknown as WorkoutRecord;
  };

  it('two knee Repair sessions count for quads but not the knee budget', () => {
    const recent = recentSessions(
      [repairDone('a', '2026-09-25'), repairDone('b', '2026-09-26')],
      LIBRARY,
    );
    for (const r of recent) {
      expect(r.muscleSets).toMatchObject({ quads: 6 });
      expect(r.jointSets).toEqual({});
    }
    const s = generateSession({
      ...base,
      painAreas: ['knee'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'grow' }],
      recentSessions: recent,
    });
    // 12 Repair knee sets this week, yet regular knee-loading work still fits.
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    expect(
      s.items.some(
        (i) =>
          i.role === 'main' &&
          byId.get(i.exerciseId)!.joints.some((j) => j.joint === 'knee' && j.range !== 'isometric'),
      ),
    ).toBe(true);
  });
});
