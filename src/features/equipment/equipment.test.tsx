/**
 * Improvements v1, package C — detailed equipment: catalog, presets, old
 * answers read as items, exact filtering, saved places, settings screen.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import EquipmentScreen from '@/app/settings/equipment';
import { generateSession, getAlternatives, type GeneratorInput } from '@/features/generator';
import { useOnboardingStore } from '@/features/onboarding/store';

import { devLibrary } from '../exercises/library';
import { inputFromProfile } from '../generator/fromProfile';

import {
  ALL_EQUIPMENT,
  EQUIPMENT_GROUPS,
  isEquipmentItem,
  normalizeEquipment,
  PRESET_KEYS,
  PRESETS,
  presetOf,
} from './catalog';
import { usePlacesStore } from './store';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));

const LIBRARY = devLibrary();

describe('catalog (C1)', () => {
  it('about 60 items in groups, every seed exercise uses only catalog items', () => {
    expect(ALL_EQUIPMENT.length).toBeGreaterThanOrEqual(55);
    expect(Object.keys(EQUIPMENT_GROUPS)).toEqual(
      expect.arrayContaining([
        'benches',
        'freeWeights',
        'cables',
        'machinesLegs',
        'accessories',
        'cardio',
      ]),
    );
    const unknown = LIBRARY.flatMap((e) =>
      e.equipment.filter((q) => !isEquipmentItem(q)).map((q) => `${e.slug}:${q}`),
    );
    expect(unknown).toEqual([]);
  });

  it('old coarse answers become exact items; detailed lists stay as they are', () => {
    expect(normalizeEquipment(['bands'])).toEqual(['long_bands', 'mini_bands']);
    expect(normalizeEquipment(['dumbbells', 'bench'])).toEqual([
      'dumbbells',
      'flat_bench',
      'adjustable_bench',
    ]);
    expect(normalizeEquipment(['dumbbells', 'mat'])).toEqual(['dumbbells', 'mat']);
    expect(normalizeEquipment(['leg_press', 'dumbbells'])).toEqual(['leg_press', 'dumbbells']);
    expect(normalizeEquipment(['machines'])).toContain('leg_press');
  });
});

describe('presets (C2)', () => {
  it('Full gym, Small gym, Home gym, Bodyweight only, Hotel', () => {
    expect(PRESET_KEYS).toEqual(['fullGym', 'smallGym', 'homeGym', 'bodyweight', 'hotel']);
    expect(PRESETS.bodyweight.items).not.toContain('dumbbells');
    expect(presetOf(PRESETS.homeGym.items, 'home')).toBe('homeGym');
    expect(presetOf(['dumbbells'], 'home')).toBeNull();
  });

  it('the generator uses only the exact items the person has', () => {
    const base: GeneratorInput = {
      library: LIBRARY,
      includeDrafts: true,
      mode: 'adult',
      band: 'adult',
      position: 'standing',
      location: 'gym',
      equipment: ['dumbbells', 'flat_bench', 'leg_press'],
      minutes: 45,
      mainGoals: ['strength'],
      muscleGoals: [
        { muscleKey: 'quads', goal: 'strengthen' },
        { muscleKey: 'chest', goal: 'strengthen' },
      ],
      exercisesPerSession: 4,
      setsPerExercise: 3,
      painAreas: [],
      conditions: [],
      restrictions: [],
    };
    const s = generateSession(base);
    const byId = new Map(LIBRARY.map((e) => [e.id, e]));
    for (const i of s.items) {
      for (const q of byId.get(i.exerciseId)!.equipment) expect(base.equipment).toContain(q);
      if (i.role === 'main' || i.role === 'cooldown')
        for (const a of getAlternatives(s, i.id, base))
          for (const q of a.equipment) expect(base.equipment).toContain(q);
    }
  });

  it('the profile input reads old answers as items', async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore.getState().update({
        birthMonth: 3,
        birthYear: 1985,
        minutes: 40,
        daysPerWeek: 3,
        mainGoals: ['strength'],
        muscleGoals: [{ muscleKey: 'chest', goal: 'strengthen' }],
        location: 'home',
        equipment: ['dumbbells', 'bands'],
      });
    });
    const input = inputFromProfile(useOnboardingStore.getState(), LIBRARY, true)!;
    expect(input.equipment).toEqual(
      expect.arrayContaining(['dumbbells', 'long_bands', 'mini_bands']),
    );
  });
});

describe('saved places and the settings screen (C2, C4)', () => {
  beforeEach(async () => {
    await act(() => {
      useOnboardingStore.getState().reset();
      useOnboardingStore
        .getState()
        .update({ birthMonth: 3, birthYear: 1985, location: 'home', equipment: [] });
      usePlacesStore.getState().reset();
    });
  });

  it('a preset fills the list; a switch removes one item; a place is saved and used', async () => {
    await render(<EquipmentScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Home gym' }));
    expect(useOnboardingStore.getState().equipment).toEqual(PRESETS.homeGym.items);
    await fireEvent(screen.getByLabelText('Dumbbells'), 'valueChange', false);
    expect(useOnboardingStore.getState().equipment).not.toContain('dumbbells');
    await fireEvent.changeText(screen.getByLabelText('Place name'), 'Home');
    await fireEvent.press(screen.getByRole('button', { name: 'Save as a place' }));
    const [home] = usePlacesStore.getState().places;
    expect(home.name).toBe('Home');
    await fireEvent.press(screen.getByRole('button', { name: 'Full gym' }));
    expect(useOnboardingStore.getState().location).toBe('gym');
    await act(() => usePlacesStore.getState().use(home.id));
    expect(useOnboardingStore.getState().location).toBe('home');
    expect(useOnboardingStore.getState().equipment).not.toContain('dumbbells');
  });
});
