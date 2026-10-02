/**
 * Phase 30 screens: Rehabilitation → "Shoulder: mobility and strength",
 * the safety rules before the first session with the side question, the
 * program (today, calendar, maintenance, review), and the player: stretch
 * timer with 30 s rest, the side of each set, "I feel pain" in a program.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import RehabProgramScreen from '@/app/rehab/[id]';
import RehabScreen from '@/app/rehab/index';
import RehabSafetyScreen from '@/app/rehab/safety';
import PainScreen from '@/app/workout/[id]/pain';
import PlayerScreen from '@/app/workout/[id]/play';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { useWorkoutStore } from '../workout/store';

import { buildProgramSession, SHOULDER_PROGRAM as P } from './programs';
import { useRehabStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
const mockRouter = jest.requireMock('expo-router').router as Record<string, jest.Mock>;

// Whole screens with the dev library: slow on a busy machine.
jest.setTimeout(20_000);

const LIBRARY = devLibrary();
const TODAY = '2026-10-05';

beforeAll(() => {
  clock.now = () => new Date(`${TODAY}T12:00:00`);
});

async function as(birthYear = 1975) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear,
      sex: 'f',
      mainGoals: ['mobility'],
      minutes: 30,
      onboardingComplete: true,
      units: 'metric',
    });
    useOnboardingStore.getState().setLocation('home');
    useWorkoutStore.getState().reset();
    useRehabStore.getState().reset();
    useRestrictionsStore.getState().reset();
  });
  Object.values(mockRouter).forEach(
    (f) => typeof f === 'function' && 'mockReset' in f && f.mockReset(),
  );
}

describe('Rehabilitation and the program', () => {
  it('lists the shoulder program with its tags', async () => {
    await as();
    await render(<RehabScreen />);
    expect(screen.getByText('Rehabilitation')).toBeTruthy();
    const card = screen.getByTestId(`rehab-program-${P.id}`);
    expect(within(card).getByText('Shoulder: mobility and strength')).toBeTruthy();
    expect(within(card).getByText('Frozen shoulder')).toBeTruthy();
    expect(within(card).getByText('Adhesive capsulitis')).toBeTruthy();
  });

  it('before the first session: the safety rules, then which shoulder', async () => {
    await as();
    mockParams = { id: P.id, mode: 'start' };
    await render(<RehabSafetyScreen />);
    expect(screen.getByText(/with your doctor or physical therapist following you/)).toBeTruthy();
    expect(screen.getByText(/It should not hurt/)).toBeTruthy();
    expect(screen.getByText(/0.5–1 kg \(1–2 lb\)/)).toBeTruthy();
    expect(screen.getByText(/does not replace guidance/)).toBeTruthy();
    const accept = screen.getByRole('button', { name: 'I understand, start' });
    expect(accept.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Left' }));
    await fireEvent.press(screen.getByRole('button', { name: 'I understand, start' }));
    const run = useRehabStore.getState().runs[P.id];
    expect(run.side).toBe('left');
    expect(run.startedAt).toBe(TODAY);
  });

  it('teens see "use it with guidance from your physical therapist"', async () => {
    await as(new Date().getFullYear() - 15);
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    expect(screen.getByText('Use it with guidance from your physical therapist.')).toBeTruthy();
    expect(screen.getByText(/Based on the AAOS shoulder conditioning program/)).toBeTruthy();
  });

  it('the program: today B on day 1, the 6 weeks, the "?" rules, starting a session', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    expect(within(screen.getByTestId('rehab-today')).getByText('Today: session B')).toBeTruthy();
    expect(screen.getByText('Week 1 of 6')).toBeTruthy();
    expect(within(screen.getByTestId('rehab-calendar')).getAllByText(/^W\d$/)).toHaveLength(6);
    await fireEvent.press(screen.getByRole('button', { name: 'Safety rules' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rehab/safety',
      params: { id: P.id, mode: 'help' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start session B' }));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.kind).toBe('repair');
    expect(w.session.program).toEqual({ id: P.id, session: 'B', week: 1 });
    expect(w.session.items[0].block).toBe('warmup');
  });

  it('after week 6: offers maintenance, 2–3 times a week', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', '2026-08-01', 'now'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const offer = screen.getByTestId('rehab-maintenance-offer');
    await fireEvent.press(within(offer).getByRole('button', { name: 'Keep going in maintenance' }));
    expect(useRehabStore.getState().runs[P.id].maintenance).toBe(true);
    expect(screen.getByText('Maintenance: 2 to 3 times a week.')).toBeTruthy();
  });
});

describe('the player in a program', () => {
  async function playA(side: 'right' | 'left' = 'left') {
    await as();
    await act(() => useRehabStore.getState().start(P.id, side, TODAY, 'now'));
    const session = buildProgramSession(P, 'A', { library: LIBRARY, affected: side, week: 1 });
    let id = '';
    await act(() => {
      id = useWorkoutStore.getState().create(session, 'repair');
      useWorkoutStore.getState().start(id);
    });
    mockParams = { id };
    return id;
  }

  it('a stretch: 30 s countdown on the affected side, then 30 s rest', async () => {
    const id = await playA('left');
    // Skip the pendulum (2×10 each side) to reach the crossover stretch.
    await act(() => useWorkoutStore.getState().skipItem(id, 'stretch-1'));
    await render(<PlayerScreen />);
    expect(screen.getByText('Left side · 1 of 4')).toBeTruthy();
    expect(screen.getByText('0:30')).toBeTruthy();
    expect(screen.queryByText('Swap')).toBeNull();
    // Done ends the hold; the next hold of the same stretch waits 30 s.
    await fireEvent.press(screen.getByRole('button', { name: /Done/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/workout/[id]/rest',
      params: { id },
    });
    clock.now = () => new Date(`${TODAY}T12:00:00`);
  });

  it('"I feel pain" in a program: no swap, the exercise is marked to review', async () => {
    const id = await playA('right');
    await render(<PainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Right shoulder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dull / pinch' }));
    expect(screen.getByText(/We marked it to review/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept swap' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip this exercise' }));
    expect(Object.keys(useRehabStore.getState().runs[P.id].review)).toEqual(['pendulum_swing']);
    expect(useWorkoutStore.getState().workouts.find((w) => w.id === id)!.pains).toHaveLength(1);
  });
});
