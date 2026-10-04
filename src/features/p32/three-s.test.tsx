/**
 * Phase 32 C: the shoulder program 3S. Simple (three blocks: Today with one
 * big button, Week with 7 squares, Shoulder settings collapsed; the checklist
 * in "See details"), sexy (today's square turns coral, days in a row, only the
 * working side lit), surprising (range of the week, "Week 1 done", the
 * sleeper logged in one tap).
 */
import '@/i18n';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import RehabProgramScreen from '@/app/rehab/[id]';
import { onSide } from '@/features/bodymap/components/MuscleAreaMap';
import { useOnboardingStore } from '@/features/onboarding/store';
import { SHOULDER_PROGRAM as P } from '@/features/rehab/programs';
import {
  programStreak,
  romByWeek,
  weekJustDone,
  WEEK_COMPLETE_DAYS,
} from '@/features/rehab/progress';
import { useRehabStore } from '@/features/rehab/store';
import { clock } from '@/lib/clock';
import { addDays } from '@/lib/dates';

import { useWorkoutStore } from '../workout/store';

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
  Redirect: () => null,
}));
jest.setTimeout(30_000);

const TODAY = '2026-10-07';
beforeAll(() => {
  clock.now = () => new Date(`${TODAY}T12:00:00`);
});

async function started(startedAt = TODAY) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1985,
      sex: 'f',
      mainGoals: ['mobility'],
      minutes: 30,
      onboardingComplete: true,
      units: 'metric',
    });
    useWorkoutStore.getState().reset();
    useRehabStore.getState().reset();
    useRehabStore.getState().start(P.id, 'right', startedAt, 'now', 'unsure');
  });
  mockParams = { id: P.id };
}

describe('the pieces', () => {
  it('days in a row: up to today, or up to yesterday while today is open', () => {
    const days = new Set([addDays(TODAY, -2), addDays(TODAY, -1)]);
    expect(programStreak(days, TODAY)).toBe(2);
    days.add(TODAY);
    expect(programStreak(days, TODAY)).toBe(3);
    expect(programStreak(new Set([addDays(TODAY, -3)]), TODAY)).toBe(0);
  });

  it('"Week 1 done" after 5 days of it, during the next week only', () => {
    const start = '2026-09-28';
    const days = new Set(Array.from({ length: WEEK_COMPLETE_DAYS }, (_, i) => addDays(start, i)));
    expect(weekJustDone(days, start, addDays(start, 6))).toBeNull();
    expect(weekJustDone(days, start, addDays(start, 7))).toBe(1);
    expect(weekJustDone(days, start, addDays(start, 14))).toBeNull();
    days.delete(start);
    expect(weekJustDone(days, start, addDays(start, 7))).toBeNull();
  });

  it('range of the week: the best of each week', () => {
    const start = '2026-09-28';
    const entries = [
      { date: start, degrees: 60 },
      { date: addDays(start, 3), degrees: 75 },
      { date: addDays(start, 8), degrees: 90 },
    ];
    expect(romByWeek(entries, start, 6)).toEqual([75, 90, null, null, null, null]);
  });

  it('a one-sided set lights only that side: front view mirrored, back view not', () => {
    // Frame 288 wide: x 100 is on our left.
    expect(onSide(100, 'front', 'right')).toBe(true);
    expect(onSide(100, 'front', 'left')).toBe(false);
    expect(onSide(100, 'back', 'right')).toBe(false);
    expect(onSide(144, 'front', 'left')).toBe(true);
    expect(onSide(100, 'front')).toBe(true);
  });
});

describe('the program screen, simple', () => {
  it('three blocks: Today with one button, Week, Shoulder settings collapsed; the checklist in details', async () => {
    await started();
    await render(<RehabProgramScreen />);
    expect(screen.getByTestId('rehab-today')).toBeTruthy();
    expect(screen.getByTestId('rehab-week-card')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shoulder settings' })).toBeTruthy();
    // Collapsed: no "0 of 3" rows and no switches until asked.
    expect(screen.queryByTestId('rehab-checklist')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryAllByText(/^0 of 3$/)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'See details' }));
    expect(screen.getByTestId('rehab-checklist')).toBeTruthy();
    // One main button: today's session.
    expect(screen.getByRole('button', { name: 'Start today’s shoulder session' })).toBeTruthy();
  });

  it('today’s square: a coral edge, coral when done; days in a row from 2', async () => {
    await started(addDays(TODAY, -2));
    await render(<RehabProgramScreen />);
    const week = screen.getByTestId('rehab-week');
    expect(within(week).getByTestId('rehab-square-today')).toBeTruthy();
    // Two earlier days done with a sleeper break, then today's with one tap.
    for (const d of [addDays(TODAY, -2), addDays(TODAY, -1), TODAY]) {
      clock.now = () => new Date(`${d}T09:00:00`);
      await act(() => {
        fireEvent.press(screen.getByTestId('rehab-sleeper-log'));
      });
    }
    clock.now = () => new Date(`${TODAY}T12:00:00`);
    await render(<RehabProgramScreen />);
    expect(screen.getAllByTestId('rehab-square-done').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('rehab-streak')).toHaveTextContent('3 days in a row');
  });
});

describe('the program screen, surprising', () => {
  it('the sleeper reminder: one tap logs the break, no player', async () => {
    await started();
    await render(<RehabProgramScreen />);
    await fireEvent.press(screen.getByTestId('rehab-sleeper-log'));
    const w = useWorkoutStore.getState().workouts.at(-1)!;
    expect(w.status).toBe('done');
    expect(w.session.program?.session).toBe('sleeper');
    expect(w.logs.length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('rehab-sleeper')).getByText('1 of 3 today')).toBeTruthy();
  });

  it('range of the week: tap how high the arm went; the week’s bar shows it', async () => {
    await started();
    await render(<RehabProgramScreen />);
    expect(screen.getByTestId('rom-value')).toHaveTextContent('Tap how high it went');
    await fireEvent.press(screen.getByTestId('rom-90'));
    expect(screen.getByTestId('rom-value')).toHaveTextContent('90°');
    expect(useRehabStore.getState().runs[P.id].rom).toEqual([{ date: TODAY, degrees: 90 }]);
    // Same day again: replaced, not added.
    await fireEvent.press(screen.getByTestId('rom-105'));
    expect(useRehabStore.getState().runs[P.id].rom).toEqual([{ date: TODAY, degrees: 105 }]);
  });

  it('"Week 1 done. Your shoulder thanks you." in week 2', async () => {
    const start = addDays(TODAY, -7);
    await started(start);
    await act(() => {
      useWorkoutStore.setState({
        workouts: Array.from({ length: 5 }, (_, i) => ({
          id: `w${i}`,
          kind: 'repair' as const,
          status: 'done' as const,
          createdAt: `${addDays(start, i)}T08:00:00`,
          startedAt: `${addDays(start, i)}T08:00:00`,
          endedAt: `${addDays(start, i)}T08:20:00`,
          session: {
            items: [],
            minutes: 10,
            warmupMinutes: 0,
            cooldownMinutes: 0,
            estimatedMinutes: 10,
            notes: [],
            program: { id: P.id, session: 'stretch' as const, week: 1 },
          },
          logs: [],
          pains: [],
          skipped: [],
          swaps: [],
        })),
      });
    });
    await render(<RehabProgramScreen />);
    expect(screen.getByTestId('rehab-week-done')).toHaveTextContent(
      'Week 1 done. Your shoulder thanks you.',
    );
  });
});
