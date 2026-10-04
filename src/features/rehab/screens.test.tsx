/**
 * Phase 30 screens: Rehabilitation → "Shoulder: mobility and strength",
 * the safety rules before the first session with the side and physio
 * questions, the program (today's block, the week checklist, sleeper breaks,
 * the regular workout's protection, calendar, release, review), the Home
 * card, and the player: stretch timer with 30 s rest, the side of each set,
 * "I feel pain" in a program and in the regular workout.
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import RehabProgramScreen from '@/app/rehab/[id]';
import RehabScreen from '@/app/rehab/index';
import RehabSafetyScreen from '@/app/rehab/safety';
import PainScreen from '@/app/workout/[id]/pain';
import PlayerScreen from '@/app/workout/[id]/play';
import { useOnboardingStore } from '@/features/onboarding/store';
import { CareHomeCards } from '@/features/rehab/CareHomeCard';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';
import { useWorkoutStore } from '../workout/store';
import type { WorkoutRecord } from '../workout/types';

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

/** Marks a workout finished today. */
const finish = (id: string) =>
  useWorkoutStore.setState((st) => ({
    workouts: st.workouts.map((w) =>
      w.id === id ? { ...w, status: 'done' as const, endedAt: `${TODAY}T12:00:00` } : w,
    ),
  }));

/** Today's finished gym workout with one exercise logged. */
function gymWorkout(exerciseId: string): WorkoutRecord {
  return {
    id: 'gym-today',
    kind: 'regular',
    createdAt: `${TODAY}T10:00:00`,
    startedAt: `${TODAY}T10:00:00`,
    endedAt: `${TODAY}T11:00:00`,
    status: 'done',
    session: {
      items: [],
      minutes: 45,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 45,
      notes: [],
    },
    logs: [{ itemId: 'x', exerciseId, setNo: 1, reps: 10, loggedAt: `${TODAY}T10:30:00` }],
    skipped: [],
    swaps: [],
    pains: [],
  };
}
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
    // Nothing comes pre-selected (Phase 32 A2).
    for (const r of screen.getAllByRole('radio'))
      expect(r.props.accessibilityState?.checked).toBe(false);
    await fireEvent.press(screen.getByRole('radio', { name: 'Left' }));
    // Addendum §6.4: one question about the regular workout, required too.
    expect(accept.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Did your physio clear shoulder and arm training?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Not sure' }));
    // "Not sure" = mobility only until the physio clears it.
    expect(screen.getByTestId('rehab-strength-locked')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'I understand, start' }));
    const run = useRehabStore.getState().runs[P.id];
    expect(run.side).toBe('left');
    expect(run.startedAt).toBe(TODAY);
    expect(run.cleared).toBe(false);
    expect(run.clearance).toBe('unsure');
    // Off until the physio says so (Phase 32 A3).
    expect(run.fullDose).toBe(false);
    expect(run.strengthTiming).toBe('after');
  });

  it('teens see "use it with guidance from your physical therapist"', async () => {
    await as(new Date().getFullYear() - 15);
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    expect(screen.getByText('Use it with guidance from your physical therapist.')).toBeTruthy();
    expect(screen.getByText(/Based on the AAOS shoulder conditioning program/)).toBeTruthy();
  });

  it('the program: Monday is block A, the week checklist, the 6 weeks, the "?" rules', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const today = screen.getByTestId('rehab-today');
    expect(within(today).getByText('Shoulder today')).toBeTruthy();
    expect(within(today).getByText('Block A — standing, band and dumbbell')).toBeTruthy();
    expect(within(today).getAllByText(/^\d+\. /)).toHaveLength(6);
    // Monday is a training day: stretches first, strengthening after (Daniel, Oct 3).
    expect(within(today).getByTestId('rehab-split-first')).toBeTruthy();
    expect(within(today).getByTestId('rehab-split-after')).toBeTruthy();
    expect(screen.getByText('Week 1 of 6')).toBeTruthy();
    const checklist = screen.getByTestId('rehab-checklist');
    expect(within(checklist).getAllByText('0 of 3')).toHaveLength(13);
    expect(within(screen.getByTestId('rehab-calendar')).getAllByText(/^W\d$/)).toHaveLength(6);
    expect(screen.getByTestId('rehab-care-protected')).toBeTruthy();
    // The day's dose by default, the physio's full dose on request.
    expect(screen.getByTestId('rehab-dose-note')).toHaveTextContent(/Reduced dose to fit your day/);
    await fireEvent.press(screen.getByRole('switch', { name: 'Full dose (from your physio)' }));
    expect(useRehabStore.getState().runs[P.id].fullDose).toBe(true);
    await fireEvent.press(screen.getByRole('switch', { name: 'Full dose (from your physio)' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Safety rules' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rehab/safety',
      params: { id: P.id, mode: 'help' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start today’s shoulder session' }));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.kind).toBe('repair');
    // Before the workout: only the daily stretches.
    expect(w.session.program).toEqual({ id: P.id, session: 'stretch', week: 1 });
    expect(w.session.items.every((i) => i.block === 'stretch')).toBe(true);
    // Stretches done: the footer offers the strengthening.
    await act(() => finish(w.id));
    await fireEvent.press(screen.getByRole('button', { name: 'Start strengthening' }));
    const after = useWorkoutStore.getState().workouts.at(-1)!;
    expect(after.session.program).toEqual({ id: P.id, session: 'standing', week: 1 });
    // No main workout yet today: the short warm-up comes first.
    expect(after.session.items[0].block).toBe('warmup');
  });

  it('"Strengthening before the workout": the whole block goes first', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Strengthening before the workout' }));
    expect(useRehabStore.getState().runs[P.id].strengthTiming).toBe('before');
    expect(screen.queryByTestId('rehab-split-first')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start today’s shoulder session' }));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.session.program?.session).toBe('standing');
    expect(w.session.items[0].block).toBe('warmup');
  });

  it('after the workout: "Finish with the shoulder"; exercises already done are not repeated', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    // Today's workout had a block A exercise (a row or a curl, say).
    const shared = P.exercises.find((x) => x.n === P.daily.blocks.standing[0])!;
    const ex = LIBRARY.find((e) => e.slug === shared.slug)!;
    await act(() =>
      useWorkoutStore.setState((st) => ({ workouts: [...st.workouts, gymWorkout(ex.id)] })),
    );
    await render(<CareHomeCards />);
    const card = screen.getByTestId(`care-finish-${P.id}`);
    expect(within(card).getByText(/^Finish with the shoulder/)).toBeTruthy();
    await fireEvent.press(card);
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.session.program?.session).toBe('standing');
    // Right after the workout the body is warm: no warm-up, cool-down stretches last.
    expect(w.session.items[0].block).not.toBe('warmup');
    expect(w.session.items.at(-1)!.block).toBe('stretch_end');
    // The shared exercise counts for both and is not in the session twice.
    expect(w.session.items.some((i) => i.exerciseId === ex.id)).toBe(false);
    expect(w.session.items.filter((i) => i.block === 'band' || i.block === 'dumbbell').length).toBe(
      P.daily.blocks.standing.length - 1,
    );
  });

  it('swap today to block B; the fixed sessions A, B and C stay available', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    await fireEvent.press(screen.getByText('Do Block B today instead'));
    const today = screen.getByTestId('rehab-today');
    expect(within(today).getByText('Block B — bench and mat')).toBeTruthy();
    expect(within(today).getAllByText(/^\d+\. /)).toHaveLength(7);
    await fireEvent.press(screen.getByRole('button', { name: 'Start session C' }));
    expect(useWorkoutStore.getState().workouts.at(-1)!.session.program?.session).toBe('C');
  });

  it('"Not sure" about the physio: only mobility (session A); B and C stay locked (Phase 32 A2)', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'unsure'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const today = screen.getByTestId('rehab-today');
    expect(within(today).getByText('Stretches only')).toBeTruthy();
    expect(within(today).queryAllByText(/^\d+\. /)).toHaveLength(0);
    expect(within(today).getByTestId('rehab-strength-locked')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Strengthening before the workout' })).toBeNull();
    expect(screen.getByTestId('rehab-locked-B')).toBeTruthy();
    expect(screen.getByTestId('rehab-locked-C')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start session B' })).toBeNull();
    const care = screen.getByTestId('rehab-care');
    expect(
      within(care).getByRole('radio', { name: 'Not sure' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Start today’s shoulder session' }));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.session.items.every((i) => i.block === 'stretch')).toBe(true);
    // Once the physio says yes, the strengthening opens.
    await fireEvent.press(within(care).getByRole('radio', { name: 'Yes' }));
    expect(screen.queryByTestId('rehab-locked-B')).toBeNull();
  });

  it('the regular workout: changing the physio answer switches the protection', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'no'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const care = screen.getByTestId('rehab-care');
    expect(within(care).getByText(/leaves out exercises that move the shoulder/)).toBeTruthy();
    await fireEvent.press(within(care).getByRole('radio', { name: 'Yes' }));
    expect(useRehabStore.getState().runs[P.id].cleared).toBe(true);
    expect(within(care).getByText(/side raises only up to shoulder height/)).toBeTruthy();
  });

  it('a sleeper break: 2 min, apart from the session; reminders are app-only on the web', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const card = screen.getByTestId('rehab-sleeper');
    expect(within(card).getByText('0 of 3 today')).toBeTruthy();
    await fireEvent.press(within(card).getByRole('button', { name: 'Stretch now (2 min)' }));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.session.program?.session).toBe('sleeper');
    expect(w.session.items).toHaveLength(1);
  });

  it('after week 4: "has your physio released you?" — yes turns on maintenance', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', '2026-08-01', 'now'));
    mockParams = { id: P.id };
    await render(<RehabProgramScreen />);
    const ask = screen.getByTestId('rehab-release');
    await fireEvent.press(within(ask).getByRole('button', { name: 'Yes, I was released' }));
    const run = useRehabStore.getState().runs[P.id];
    expect(run.maintenance).toBe(true);
    expect(run.releasedAt).toBe(TODAY);
    expect(screen.getByText('Maintenance: 2 to 3 times a week.')).toBeTruthy();
    expect(screen.getByTestId('rehab-care-returning')).toBeTruthy();
    expect(screen.queryByTestId('rehab-checklist')).toBeNull();
  });

  it('Home: "Shoulder today" next to the workout; done after today’s session', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    await render(<CareHomeCards />);
    const card = screen.getByTestId(`care-home-${P.id}`);
    expect(within(card).getByText('Shoulder today')).toBeTruthy();
    // A training day: only the stretches before the workout.
    expect(within(card).getByText(/Stretches only/)).toBeTruthy();
    expect(within(card).getByTestId('care-home-hint')).toHaveTextContent(/only the stretches/);
    await fireEvent.press(card);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/rehab/[id]', params: { id: P.id } });
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
    await fireEvent.press(screen.getByTestId('guided-done'));
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

  it('shoulder pain in the regular workout tells the program (addendum §6.4)', async () => {
    await as();
    await act(() => useRehabStore.getState().start(P.id, 'right', TODAY, 'now', 'yes'));
    const row = LIBRARY.find((e) => e.slug === 'band_row')!;
    const session = {
      items: [
        {
          id: 'main-1',
          role: 'main' as const,
          part: 'main' as const,
          exerciseId: row.id,
          targetMuscle: 'upperBack',
          goal: null,
          sets: 3,
          reps: [10, 12] as [number, number],
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 300,
        },
      ],
      minutes: 10,
      warmupMinutes: 0,
      cooldownMinutes: 0,
      estimatedMinutes: 10,
      notes: [],
    };
    let id = '';
    await act(() => {
      id = useWorkoutStore.getState().create(session, 'regular');
      useWorkoutStore.getState().start(id);
    });
    mockParams = { id };
    await render(<PainScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Right shoulder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dull / pinch' }));
    expect(screen.getByTestId('care-pain-note')).toBeTruthy();
    await fireEvent.press(
      screen.queryByRole('button', { name: 'Accept swap' }) ??
        screen.getByRole('button', { name: 'Skip this exercise' }),
    );
    expect(Object.keys(useRehabStore.getState().runs[P.id].review)).toEqual(['band_row']);
  });
});
