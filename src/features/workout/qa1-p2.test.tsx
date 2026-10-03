/**
 * QA round 1 — P2 polish (docs/qa-round-1.md §3), plus the owner decision
 * that minors only see kid and teen body models.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import GoalsScreen from '@/app/goals';
import PaywallScreen from '@/app/paywall';
import PlansScreen from '@/app/plans';
import ReferralLink from '@/app/r/[code]';
import SettingsScreen from '@/app/(tabs)/settings';
import ShareScreen from '@/app/share';
import { useAccountStore } from '@/features/account/store';
import { setBilling } from '@/features/billing/provider';
import { PRODUCTS } from '@/features/billing/rules';
import { FREE, useBillingStore } from '@/features/billing/store';
import { displayBand } from '@/features/bodymap/selection';
import { devLibrary } from '@/features/exercises/library';
import { useFamilyStore } from '@/features/family/store';
import { generateSession } from '@/features/generator';
import { inputFromProfile } from '@/features/generator/fromProfile';
import type { GeneratorInput } from '@/features/generator/types';
import { muscleByKey } from '@/features/muscles';
import { summaryNotes } from '@/features/onboarding/derived';
import { visibleConditions } from '@/features/onboarding/safety';
import { useOnboardingStore } from '@/features/onboarding/store';
import {
  goalForMode,
  sexLabelKey,
  visibleMainGoals,
  visibleMuscleGoals,
} from '@/features/onboarding/visible';
import { rangeTotals, trainedMuscles } from '@/features/progress/stats';
import { clock } from '@/lib/clock';

import { relativeDay } from '@/features/senior/summary';
import i18n from '@/i18n';

import { blockMinutes, durationText } from './format';
import { useWorkoutStore } from './store';
import { initialStreak, recordActiveDay, type StreakState } from './streak';
import type { WorkoutRecord } from './types';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  ensureSession: async () => true,
}));
jest.mock('@/features/account/cloud', () => ({
  loadReferralCode: jest.fn(async () => null),
  referralLink: (code: string) => `tapstrong://r/${code}`,
}));
jest.mock('@/features/notifications/apply', () => ({
  remindersAvailable: true,
  requestPermission: async () => true,
  applyPlan: async () => undefined,
}));

const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;
const LIBRARY = devLibrary();
const NOW = new Date(2026, 8, 26, 12);

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
      mainGoals: ['strength'],
      minutes: 40,
      daysPerWeek: 3,
      muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      onboardingComplete: true,
    });
    useOnboardingStore.getState().setLocation('gym');
    useWorkoutStore.getState().reset();
    useBillingStore.getState().reset();
    useAccountStore.getState().reset();
    useFamilyStore.getState().reset();
  });
  setBilling(null);
  mockParams = {};
  Object.values(mockRouter).forEach((m) => m.mockClear?.());
});

describe('Minors see kid and teen body models only (owner decision)', () => {
  it('an adult model stored on a minor profile is never shown', () => {
    expect(displayBand('adult', 'teen', 'teen')).toBe('teen');
    expect(displayBand('elder', 'kid', 'child')).toBe('kid');
    expect(displayBand('kid', 'teen', 'teen')).toBe('kid');
  });
});

describe('Content for kids', () => {
  it('no "Look better", "Grow" or "Firm", and Boy / Girl instead of Man / Woman', () => {
    expect(visibleMainGoals('child')).not.toContain('look');
    expect(visibleMainGoals('teen')).toContain('look');
    expect(visibleMuscleGoals('child')).toEqual(['strengthen', 'balance', 'mobility']);
    expect(goalForMode('grow', 'child')).toBe('strengthen');
    expect(goalForMode('grow', 'adult')).toBe('grow');
    expect(sexLabelKey('m', 'child')).toBe('sexMinor.m');
    expect(sexLabelKey('f', 'teen')).toBe('sexMinor.f');
    expect(sexLabelKey('f', 'adult')).toBe('sex.f');
  });

  it('the generator never trains a hidden goal for a kid', async () => {
    await act(() =>
      useOnboardingStore.getState().update({
        birthYear: 2016,
        mainGoals: ['look', 'strength'],
        muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }],
      }),
    );
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
    expect(input.mode).toBe('child');
    expect(input.mainGoals).toEqual(['strength']);
    expect(input.muscleGoals[0].goal).toBe('strengthen');
  });

  it('the goal sheet offers a kid no Grow or Firm', async () => {
    await act(() => useOnboardingStore.getState().update({ birthYear: 2016 }));
    mockParams = { muscle: 'upperChest' };
    await render(<GoalsScreen />);
    expect(screen.queryByText('Grow')).toBeNull();
    expect(screen.queryByText('Firm & tone')).toBeNull();
    expect(screen.getAllByRole('radio').length).toBe(3);
  });

  it('pregnancy is not offered at 60+; body-fat note only for weight or firm goals', () => {
    expect(visibleConditions('senior', 'f')).not.toContain('pregnant_postpartum');
    expect(visibleConditions('adult', 'f')).toContain('pregnant_postpartum');
    const base = useOnboardingStore.getState();
    expect(summaryNotes({ ...base, mainGoals: ['look'], muscleGoals: [] }, 'adult')).not.toContain(
      'bodyFat',
    );
    expect(summaryNotes({ ...base, mainGoals: ['lose_weight'] }, 'adult')).toContain('bodyFat');
  });
});

describe('Streak', () => {
  it('a rest day used by a break cannot be used again that week', () => {
    // Weeks start on Sunday: Sep 20–26, 2026.
    let s: StreakState = { ...initialStreak(), current: 5, best: 5, lastActive: '2026-09-20' };
    s = recordActiveDay(s, '2026-09-23', 0).state; // missed 21 (rest) and 22: broken
    expect(s.current).toBe(1);
    s = recordActiveDay(s, '2026-09-25', 0).state; // missed 24: rest already used
    expect(s.current).toBe(1);
  });
});

describe('Generator notes and cool-down follow the real workout', () => {
  const inputs = (): GeneratorInput[] =>
    [15, 20, 30, 45].flatMap((minutes) =>
      [
        [{ muscleKey: 'upperChest', goal: 'grow' as const }],
        [{ muscleKey: 'quads', goal: 'strengthen' as const }],
        [{ muscleKey: 'lats', goal: 'firm' as const }],
      ].map((muscleGoals) => ({
        ...inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!,
        minutes,
        muscleGoals,
      })),
    );
  const byId = new Map(LIBRARY.map((e) => [e.id, e]));
  const root = (k: string) => muscleByKey(k)?.parentKey ?? k;

  it('the balance note only names groups still in the workout', () => {
    for (const input of inputs()) {
      const s = generateSession(input);
      const main = s.items.filter((i) => i.role === 'main');
      const groups = new Set(
        main.flatMap((i) =>
          byId
            .get(i.exerciseId)!
            .muscles.filter((m) => m.role === 'primary')
            .map((m) => muscleByKey(m.muscleKey)?.movementGroup),
        ),
      );
      for (const note of s.notes) {
        if (note.key !== 'generator.notes.balance') continue;
        for (const g of note.groups) expect(groups.has(g)).toBe(true);
      }
    }
  });

  it('cool-down stretches target the muscles that were trained', () => {
    for (const input of inputs()) {
      const s = generateSession(input);
      const trained = new Set(
        s.items
          .filter((i) => i.role === 'main')
          .flatMap((i) => [
            ...(i.targetMuscle ? [root(i.targetMuscle)] : []),
            ...byId
              .get(i.exerciseId)!
              .muscles.filter((m) => m.role !== 'stabilizer')
              .map((m) => root(m.muscleKey)),
          ]),
      );
      const stretches = s.items.filter((i) => i.part === 'cooldown_stretch' && i.targetMuscle);
      expect(stretches.length).toBeGreaterThan(0);
      for (const item of stretches) expect(trained.has(root(item.targetMuscle!))).toBe(true);
    }
  });
});

function doneWorkout(daysAgo: number): WorkoutRecord {
  const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
  const id = useWorkoutStore.getState().create(generateSession(input));
  const w = useWorkoutStore.getState().workouts.find((x) => x.id === id)!;
  const start = new Date(NOW.getTime() - daysAgo * 86400000);
  const main = w.session.items.filter((i) => i.role === 'main');
  const record: WorkoutRecord = {
    ...w,
    status: 'done',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 30 * 60000).toISOString(),
    logs: main.map((i) => ({
      itemId: i.id,
      exerciseId: i.exerciseId,
      setNo: 1,
      loggedAt: start.toISOString(),
    })),
  };
  useWorkoutStore.setState({
    workouts: useWorkoutStore.getState().workouts.map((x) => (x.id === id ? record : x)),
  });
  return record;
}

describe('Share', () => {
  it('"Share my 4 weeks" shows the last 4 weeks, not the daily card', async () => {
    await act(() => {
      doneWorkout(40); // outside the 4 weeks
      doneWorkout(10);
      doneWorkout(3);
      doneWorkout(1);
    });
    const month = rangeTotals(useWorkoutStore.getState().workouts, NOW, 28);
    expect(month.workouts).toHaveLength(3);
    expect(month.minutes).toBe(90);
    mockParams = { range: '4w' };
    await render(<ShareScreen />);
    // Phase 28: the 4 weeks are the month card (3 workouts, 90 min).
    const card = screen.getAllByTestId('share-card-month')[0];
    expect(within(card).getAllByText('3').length).toBeGreaterThan(0);
    expect(within(card).getByText('90 min')).toBeTruthy();
  });

  it('lists the most-trained muscles first, not catalog order', () => {
    const w = doneWorkout(1);
    const order = trainedMuscles([w], LIBRARY);
    const counts = new Map<string, number>();
    for (const l of w.logs)
      for (const m of byIdAll(l.exerciseId)) counts.set(m, (counts.get(m) ?? 0) + 1);
    for (let i = 1; i < order.length; i++)
      expect(counts.get(order[i - 1])!).toBeGreaterThanOrEqual(counts.get(order[i])!);
  });
});

const byIdAll = (id: string) =>
  LIBRARY.find((e) => e.id === id)!
    .muscles.filter((m) => m.role === 'primary')
    .map((m) => m.muscleKey);

const MANAGE = 'Manage my subscription';

describe('Plans and paywall', () => {
  it('the paywall shows the trial end date and resumes the workout after buying', async () => {
    await act(() => useAccountStore.getState().update({ saved: true }));
    await render(<PaywallScreen />);
    const end = new Date(NOW.getTime() + 7 * 86400000).toLocaleDateString('en', {
      month: 'long',
      day: 'numeric',
    });
    expect(screen.getByText(new RegExp(`Free trial ends ${end}`))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start 7-day free trial' }));
    expect(useBillingStore.getState().entitlement.plan).toBe('premium');
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/billing');
  });

  it('a subscriber can switch plans', async () => {
    await act(() => {
      useAccountStore.getState().update({ saved: true });
      useBillingStore.getState().set({
        hadTrial: true,
        entitlement: {
          ...FREE,
          plan: 'premium',
          status: 'active',
          productId: PRODUCTS.premium.monthly,
          expiresAt: '2026-10-26T12:00:00Z',
          willRenew: true,
        },
      });
    });
    await render(<PlansScreen />);
    expect(screen.getByRole('button', { name: MANAGE })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Family, $14.99' }));
    expect(screen.getByRole('button', { name: /^Switch to Family/ })).toBeTruthy();
  });
});

describe('Settings and referral', () => {
  it('Settings leads to Delete account', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/delete-account');
  });

  it('a referral link confirms the invite', async () => {
    mockParams = { code: 'ab3def7' };
    await render(<ReferralLink />);
    expect(screen.getByText('A friend invited you')).toBeTruthy();
    expect(useAccountStore.getState().pendingReferral).toBe('AB3DEF7');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe('Copy and timers', () => {
  const t = i18n.t.bind(i18n) as never;

  it('times read the same in the list and the player, with correct plurals', () => {
    expect(durationText(t, 162)).toBe('2 min 42 s');
    expect(durationText(t, 60)).toBe('1 min');
    expect(i18n.t('workout.rampUp', { count: 1 })).not.toMatch(/sets/);
    const block = [{ durationSeconds: 90 }, { durationSeconds: 90 }, { estSeconds: 60 }];
    expect(blockMinutes(block as never)).toBe(4);
  });

  it('"Last workout" says today or yesterday instead of a weekday', () => {
    const say = (k: 'home.senior.dayToday' | 'home.senior.dayYesterday') => i18n.t(k);
    expect(relativeDay(NOW.toISOString(), NOW, 'en', say)).toBe(i18n.t('home.senior.dayToday'));
    const y = new Date(NOW.getTime() - 86400000).toISOString();
    expect(relativeDay(y, NOW, 'en', say)).toBe(i18n.t('home.senior.dayYesterday'));
  });

  it('"Only 15 min" can go back to the full workout', () => {
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
    const full = generateSession(input);
    const id = useWorkoutStore.getState().create(full);
    useWorkoutStore.getState().shorten(id, generateSession({ ...input, minutes: 15 }));
    expect(useWorkoutStore.getState().workouts[0].session.minutes).toBe(15);
    useWorkoutStore.getState().restoreFull(id);
    expect(useWorkoutStore.getState().workouts[0].session.items).toEqual(full.items);
  });
});
