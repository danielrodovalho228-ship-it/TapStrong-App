/**
 * Phase 28, B — where cards come from: "Save card" on the exercise page and
 * in the library, a Moment's "Share" opens its achievement card, the end
 * screen and the history open the workout card, the month screen "My month".
 * Every entry point checks canShare and the age mode's templates (E).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import ExerciseScreen from '@/app/exercise/[id]';
import ShareScreen from '@/app/share';
import { useFamilyStore } from '@/features/family/store';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { MomentCard } from '@/features/moments/MomentCard';
import { useMomentsStore } from '@/features/moments/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { shareAllowed } from './open';

const params: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const NOW = new Date('2026-09-30T18:00:00');
const realNow = clock.now;
const squat = devLibrary().find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;

beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});

/** An adult (1985) or a teen (2011), optionally a managed teen on a Family plan. */
async function as(who: 'adult' | 'teen', managed?: { shareAllowed: boolean }) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: who === 'adult' ? 1985 : 2011,
      sex: 'f',
      onboardingComplete: true,
    });
    useFamilyStore.setState({
      profiles: managed
        ? [{ id: 't1', kind: 'child', createdAt: '2026-01-01', ...managed }]
        : [{ id: 'me', kind: 'self', createdAt: '2026-01-01' }],
      activeId: managed ? 't1' : 'me',
    });
    useOwnerIdentityStore.setState({
      ownerId: 'me',
      activeId: managed ? 't1' : 'me',
      minors: managed ? { t1: 'teen' } : {},
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(params)) delete params[k];
});

describe('the rule every entry point uses', () => {
  it('children never; a managed teen only with the switch, and only the minor cards', () => {
    const teen = { id: 't1', kind: 'child' as const, createdAt: '', shareAllowed: true };
    useOwnerIdentityStore.setState({ ownerId: 'me', activeId: 't1', minors: { t1: 'teen' } });
    expect(shareAllowed(null, 'child')).toBe(false);
    expect(shareAllowed({ ...teen, shareAllowed: false }, 'teen', 'workout')).toBe(false);
    expect(shareAllowed(teen, 'teen', 'workout')).toBe(true);
    expect(shareAllowed(teen, 'teen', 'exercise')).toBe(false);
    expect(shareAllowed(teen, 'teen', 'month')).toBe(false);
    expect(shareAllowed(null, 'senior', 'month')).toBe(true);
  });
});

describe('B3 "Save card" on the exercise page', () => {
  it('adults: opens the exercise sheet for this exercise', async () => {
    await as('adult');
    params.id = squat.id;
    await render(<ExerciseScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/share',
      params: { template: 'exercise', exercise: squat.id },
    });
  });

  it('a teen, even with sharing on: no exercise sheet', async () => {
    await as('teen', { shareAllowed: true });
    params.id = squat.id;
    await render(<ExerciseScreen />);
    expect(screen.queryByRole('button', { name: 'Save card' })).toBeNull();
  });
});

describe('B4 a Moment becomes an achievement card', () => {
  const reps = { id: 'm-reps', kind: 'milestone_reps' as const, params: { count: 1000 } };
  const habit = { id: 'm-back', kind: 'first_back' as const, params: {}, muscles: ['lats'] };

  it('"Share" opens the composer on that Moment', async () => {
    await as('adult');
    await render(<MomentCard moment={reps} band="adult" sex="f" canShare />);
    await fireEvent.press(screen.getByRole('link', { name: 'Share' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/share',
      params: { template: 'achievement', moment: 'm-reps' },
    });
  });

  it('a teen with sharing on: habit Moments only', async () => {
    await as('teen', { shareAllowed: true });
    await render(<MomentCard moment={reps} band="teen" sex="f" canShare />);
    expect(screen.queryByRole('link', { name: 'Share' })).toBeNull();
    await render(<MomentCard moment={habit} band="teen" sex="f" canShare />);
    expect(screen.getByRole('link', { name: 'Share' })).toBeTruthy();
  });

  it('sharing the card marks the Moment shared', async () => {
    await as('adult');
    const stored = await act(() =>
      useMomentsStore.getState().record({ ...reps, muscles: [] }, NOW, null),
    );
    params.template = 'achievement';
    params.moment = stored.id;
    await render(<ShareScreen />);
    expect(screen.getAllByTestId('share-card-achievement').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Save to photos' }));
    expect(track).toHaveBeenCalledWith('moment_shared', { kind: 'milestone_reps' });
    expect(useMomentsStore.getState().shown.find((m) => m.id === stored.id)?.shared).toBe(true);
  });
});
