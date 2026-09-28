import { PRESETS } from '../equipment/catalog';
import { act } from '@testing-library/react-native';

import { kvStorage } from '@/lib/storage';

import { summaryNotes } from './derived';
import { initialOnboarding, useOnboardingStore } from './store';

const store = () => useOnboardingStore.getState();

beforeEach(async () => {
  await act(() => store().reset());
});

describe('onboarding store', () => {
  it('fills gym equipment when the place is set to gym', async () => {
    await act(() => store().setLocation('gym'));
    // A gym starts from the full-gym preset (improvements v1, C).
    expect(store().equipment).toEqual(PRESETS.fullGym.items);
    await act(() => store().setLocation('outdoors'));
    expect(store().equipment).toEqual([]);
  });

  it('merges coach answers per step', async () => {
    await act(() => store().applyAnswer('schedule', { location: 'home', minutes: 30 }));
    await act(() => store().applyAnswer('schedule', { daysPerWeek: 4 }));
    expect(store()).toMatchObject({ location: 'home', minutes: 30, daysPerWeek: 4 });

    await act(() =>
      store().applyAnswer('focus', { muscleGoals: [{ muscleKey: 'upperChest', goal: 'grow' }] }),
    );
    await act(() =>
      store().applyAnswer('focus', {
        muscleGoals: [
          { muscleKey: 'upperChest', goal: 'firm' },
          { muscleKey: 'glutes', goal: 'grow' },
        ],
      }),
    );
    expect(store().muscleGoals).toEqual([
      { muscleKey: 'upperChest', goal: 'firm' },
      { muscleKey: 'glutes', goal: 'grow' },
    ]);
  });

  it('muscle chips use the default goal from the main goal', async () => {
    await act(() => store().update({ mainGoals: ['strength'] }));
    await act(() => store().toggleFocusMuscle('quads'));
    expect(store().muscleGoals).toEqual([{ muscleKey: 'quads', goal: 'strengthen' }]);
    await act(() => store().toggleFocusMuscle('quads'));
    expect(store().muscleGoals).toEqual([]);
  });

  it('persists data but not functions', async () => {
    await act(() => store().update({ birthYear: 1983 }));
    const saved = JSON.parse(kvStorage.getItem('onboarding') as string);
    expect(saved.state.birthYear).toBe(1983);
    expect(Object.values(saved.state).some((v) => typeof v === 'function')).toBe(false);
  });
});

describe('summaryNotes (SPEC §2.3: body-fat language adults only)', () => {
  const firm = {
    ...initialOnboarding(),
    muscleGoals: [{ muscleKey: 'chest', goal: 'firm' as const }],
  };

  it('adults see the body-fat note', async () => {
    expect(summaryNotes(firm, 'adult')).toContain('bodyFat');
  });

  it('teens and children never do', async () => {
    expect(summaryNotes(firm, 'teen')).not.toContain('bodyFat');
    expect(summaryNotes({ ...firm, mainGoals: ['look'] }, 'child')).not.toContain('bodyFat');
  });

  it('adds the senior and doctor notes', async () => {
    const s = { ...initialOnboarding(), conditions: ['heart_condition' as const] };
    expect(summaryNotes(s, 'senior')).toEqual(['redFlag', 'senior']);
  });
});

describe('reset', () => {
  it('clears optional answers too', () => {
    useOnboardingStore.getState().update({ birthYear: 1990, location: 'gym', minutes: 40 });
    useOnboardingStore.getState().reset();
    const s = useOnboardingStore.getState();
    expect(s.birthYear).toBeUndefined();
    expect(s.location).toBeUndefined();
    expect(s.minutes).toBeUndefined();
    expect(typeof s.reset).toBe('function');
  });
});
