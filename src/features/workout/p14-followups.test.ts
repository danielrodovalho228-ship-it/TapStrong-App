/**
 * Phase 14 follow-ups (Daniel: "seguir suas recomendações"): a chime when a
 * timer ends, and the swap sheet naming close options that need equipment
 * the person doesn't have — as text only, never as extra replacements.
 */
import { createAudioPlayer } from 'expo-audio';

import { ALL_EQUIPMENT } from '../equipment/catalog';
import { devLibrary } from '../exercises/library';
import {
  generateSession,
  getAlternatives,
  MAX_ALTERNATIVES,
  missingEquipmentOptions,
  type GeneratorInput,
} from '../generator';
import { blockReason } from '../generator/filters';
import { usePrefsStore } from '../settings/store';

import { playTimerEnd } from './sound';

const LIBRARY = devLibrary();
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: ['dumbbells', 'flat_bench'],
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [
    { muscleKey: 'quads', goal: 'strengthen' },
    { muscleKey: 'chest', goal: 'strengthen' },
    { muscleKey: 'lats', goal: 'strengthen' },
  ],
  exercisesPerSession: 4,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: ['knee'],
};

describe('swap sheet: options that need other equipment', () => {
  const s = generateSession(base);
  const mains = s.items.filter((i) => i.role === 'main');

  it('are never offered, and the offer stays at 5 or fewer', () => {
    let named = 0;
    for (const i of mains) {
      const offered = getAlternatives(s, i.id, base);
      const missing = missingEquipmentOptions(s, i.id, base);
      named += missing.length;
      expect(offered.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
      for (const e of missing) {
        expect(offered.map((o) => o.id)).not.toContain(e.id);
        expect(e.equipment.some((q) => !base.equipment.includes(q))).toBe(true);
      }
    }
    expect(named).toBeGreaterThan(0);
  });

  it('pass every safety rule except equipment (the knee restriction still applies)', () => {
    for (const i of mains)
      for (const e of missingEquipmentOptions(s, i.id, base)) {
        expect(e.contraindications).not.toContain('knee');
        expect(blockReason(e, { ...base, equipment: ALL_EQUIPMENT })).toBeNull();
      }
  });
});

describe('timer chime', () => {
  const mocked = createAudioPlayer as jest.Mock;
  beforeEach(() => mocked.mockClear());

  it('plays when Sounds is on, stays quiet when off', () => {
    usePrefsStore.getState().set({ sounds: true });
    playTimerEnd();
    const player = mocked.mock.results[0]?.value as { play: jest.Mock };
    expect(player.play).toHaveBeenCalledTimes(1);
    playTimerEnd();
    expect(mocked).toHaveBeenCalledTimes(1); // one player, reused
    expect(player.play).toHaveBeenCalledTimes(2);
    usePrefsStore.getState().set({ sounds: false });
    playTimerEnd();
    expect(player.play).toHaveBeenCalledTimes(2);
  });
});
