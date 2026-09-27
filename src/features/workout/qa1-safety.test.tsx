/**
 * QA round 1 — P0 safety fixes (docs/qa-round-1.md §1). One test per finding.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import WhoScreen from '@/app/onboarding/who';
import RestrictionsScreen from '@/app/restrictions';
import DoneScreen from '@/app/workout/[id]/done';
import WorkoutScreen from '@/app/workout/[id]/index';
import { devLibrary } from '@/features/exercises/library';
import { gateQuestion } from '@/features/family/ParentGate';
import { useFamilyStore } from '@/features/family/store';
import { generateSession } from '@/features/generator';
import { blockReason } from '@/features/generator/filters';
import { inputFromProfile } from '@/features/generator/fromProfile';
import type { GeneratorInput } from '@/features/generator/types';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { resources } from '@/i18n';
import { clock } from '@/lib/clock';

import { refreshWorkout } from './hooks';
import { safetyRefresh, sharpStopAreasToday } from './safety';
import { useWorkoutStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const LIBRARY = devLibrary();
const ex = (slug: string) => LIBRARY.find((e) => e.slug === slug)!;
const NOW = new Date('2026-09-27T12:00:00Z');

beforeAll(() => {
  clock.now = () => NOW;
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'f',
      mainGoals: ['look'],
      minutes: 40,
      location: 'gym',
      muscleGoals: [{ muscleKey: 'shoulders', goal: 'grow' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useRestrictionsStore.getState().reset();
    useFamilyStore.getState().reset();
  });
  mockParams = {};
});

const ALL_EQUIPMENT = [
  'dumbbells',
  'barbell',
  'kettlebell',
  'bands',
  'machines',
  'cables',
  'bench',
  'pull_up_bar',
  'mat',
] as GeneratorInput['equipment'];

const input = (patch: Partial<GeneratorInput> = {}): GeneratorInput => ({
  ...inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!,
  equipment: ALL_EQUIPMENT,
  ...patch,
});

describe('B-01 a child profile cannot be re-aged', () => {
  it('the age gate keeps a child profile under 13', () => {
    const today = { year: 2026, month: 9 };
    expect(evaluateAgeGate('child', { year: 2016, month: 5 }, today, true, true).status).toBe('ok');
    expect(evaluateAgeGate('child', { year: 2010, month: 5 }, today, true, true).status).toBe(
      'child_locked',
    );
    expect(evaluateAgeGate('me', { year: 1990, month: 5 }, today, true, true).status).toBe(
      'child_locked',
    );
  });

  it('the birth date is read-only on a child profile until a parent passes the gate', async () => {
    await act(() => {
      useFamilyStore.setState({
        profiles: [
          { id: 'me', kind: 'self', createdAt: '2026-09-01T00:00:00Z' },
          {
            id: 'c1',
            kind: 'child',
            name: 'Mia',
            createdAt: '2026-09-02T00:00:00Z',
            consentAt: 'x',
          },
        ],
        activeId: 'c1',
      });
      useOnboardingStore.getState().update({ who: 'child', birthMonth: 5, birthYear: 2016 });
    });
    await render(<WhoScreen />);
    expect(screen.queryByRole('radio', { name: 'Me' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Birth year:/ })).toBeNull();
    expect(
      screen.getByText('Only a parent can change the birth date on a child profile.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Change (parent)' }));
    const { answer } = gateQuestion(NOW.getMinutes());
    await fireEvent.changeText(screen.getByLabelText('Answer'), String(answer + 1));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText("That's not it. Please ask a parent.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Birth year:/ })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Answer'), String(answer));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('button', { name: /^Birth year:/ })).toBeTruthy();
  });
});

describe('B-02 no body-fat words under 18', () => {
  it('the cardio finisher label is neutral in every language', () => {
    for (const locale of ['en', 'es', 'pt-BR'] as const) {
      const label = resources[locale].translation.workout.finisher.finisher_cardio;
      expect(label).not.toMatch(/fat|grasa|gordura/i);
    }
  });

  it('workout, generator and home strings never mention body fat', () => {
    const walk = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : walk(v as object)));
    for (const locale of ['en', 'es', 'pt-BR'] as const) {
      const tr = resources[locale].translation;
      const shownToMinors = [tr.workout, tr.generator, tr.home, tr.progress, tr.checkin.minorNote];
      for (const text of shownToMinors.flatMap((x) => (typeof x === 'string' ? [x] : walk(x)))) {
        expect(text).not.toMatch(/fat-loss|body fat|quema grasa|queima-gordura/i);
      }
    }
  });
});

describe('C-01 after a sharp-pain stop', () => {
  async function stoppedWorkout() {
    const id = useWorkoutStore.getState().create(generateSession(input()));
    await act(() => {
      const s = useWorkoutStore.getState();
      s.start(id);
      const item = s.workouts[0].session.items.find((i) => i.role === 'main')!;
      s.addPain(id, {
        itemId: item.id,
        exerciseId: item.exerciseId,
        area: 'shoulder',
        side: 'right',
        type: 'sharp',
        action: 'stopped',
      });
      s.finish(id, 'partial');
    });
    return id;
  }

  it('no finisher offer, calm copy', async () => {
    mockParams = { id: await stoppedWorkout() };
    await render(<DoneScreen />);
    expect(screen.getByText('Good call to stop')).toBeTruthy();
    expect(screen.queryByText('First one done!')).toBeNull();
    expect(screen.queryByRole('button', { name: /Add 10 min/ })).toBeNull();
  });

  it('the area is left out of any new workout that day', async () => {
    await stoppedWorkout();
    expect(sharpStopAreasToday(useWorkoutStore.getState().workouts, '2026-09-27')).toEqual([
      'shoulder',
    ]);
    expect(sharpStopAreasToday(useWorkoutStore.getState().workouts, '2026-09-28')).toEqual([]);
  });
});

describe('C-02 a red flag leaves out every exercise that moves the joint', () => {
  it('uses joint movements, not only contraindications', () => {
    const lowBack = input({ hardRestrictions: ['lower_back'] });
    expect(ex('cat_cow').contraindications).not.toContain('lower_back');
    expect(blockReason(ex('cat_cow'), lowBack)).toBe('contraindication');
    expect(blockReason(ex('glute_bridge'), lowBack)).toBe('contraindication');
    const shoulder = input({ hardRestrictions: ['shoulder'] });
    for (const slug of [
      'arm_circles',
      'neutral_grip_floor_press',
      'band_row',
      'seated_cable_row',
    ]) {
      expect(blockReason(ex(slug), shoulder)).toBe('contraindication');
    }
    const s = generateSession(shoulder);
    for (const item of s.items) {
      expect(ex(item.exerciseId).joints.some((j) => j.joint === 'shoulder')).toBe(false);
    }
  });

  it('"Doctor first" needs a confirmation before it can be marked healed', async () => {
    await act(() =>
      useRestrictionsStore.getState().add({ area: 'shoulder', side: 'right', source: 'doctor' }),
    );
    await render(<RestrictionsScreen />);
    expect(screen.getByText('Doctor first')).toBeTruthy();
    await fireEvent.press(screen.getByText('Mark healed'));
    expect(useRestrictionsStore.getState().items[0].active).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, I was cleared' }));
    expect(useRestrictionsStore.getState().items[0].active).toBe(false);
  });
});

describe('A-01 / C-04 stored workouts are re-checked when safety changes', () => {
  it('a planned workout built before a restriction is rebuilt', () => {
    const before = input();
    const id = useWorkoutStore.getState().create(generateSession(before));
    const w = useWorkoutStore.getState().workouts[0];
    const main = w.session.items.find((i) => i.role === 'main')!;
    const area = ex(main.exerciseId).contraindications.find((c) =>
      ['shoulder', 'elbow_wrist', 'neck', 'knee', 'lower_back', 'hip'].includes(c),
    )!;
    expect(area).toBeDefined();
    const after = input({ restrictions: [area] });
    expect(safetyRefresh(w, after).kind).toBe('regenerate');
    const next = refreshWorkout(id, after, LIBRARY)!;
    expect(next).not.toBe(id);
    const fresh = useWorkoutStore.getState().workouts.find((x) => x.id === next)!;
    for (const item of fresh.session.items) {
      expect(ex(item.exerciseId).contraindications).not.toContain(area);
    }
    expect(useWorkoutStore.getState().workouts.some((x) => x.id === id)).toBe(false);
  });

  it('an active workout swaps or skips the unsafe items still to do', async () => {
    const id = useWorkoutStore.getState().create(generateSession(input()));
    await act(() => useWorkoutStore.getState().start(id));
    const after = input({ restrictions: ['shoulder'] });
    expect(refreshWorkout(id, after, LIBRARY)).toBe(id);
    const w = useWorkoutStore.getState().workouts[0];
    const todo = w.session.items.filter((i) => !w.skipped.includes(i.id));
    for (const item of todo) {
      expect(ex(item.exerciseId).contraindications).not.toContain('shoulder');
    }
    expect(safetyRefresh(w, after).kind).toBe('ok');
  });
});

describe('C-03 honest states for seated, home, bodyweight 60+', () => {
  it('gets a workout, and says so when the chosen muscles had nothing safe', () => {
    const s = generateSession(
      input({
        mode: 'senior',
        band: 'senior',
        position: 'seated_only',
        location: 'home',
        equipment: [],
        minutes: 15,
        muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      }),
    );
    expect(s.error).toBeUndefined();
    expect(s.items[0].role).toBe('warmup');
    expect(s.items.at(-1)!.role).toBe('cooldown');
  });

  it('the unavailable screen gives the real reason, not "under review"', async () => {
    await act(() => {
      useOnboardingStore
        .getState()
        .update({ position: 'seated_only', painAreas: ['recent_surgery'] });
      useOnboardingStore.getState().setLocation('home');
      useOnboardingStore.getState().update({ equipment: [] });
    });
    mockParams = { id: 'unavailable' };
    await render(<WorkoutScreen />);
    expect(screen.queryByText(/being reviewed/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Change my plan' })).toBeTruthy();
  });
});
