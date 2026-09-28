/**
 * QA round 4 — P2 rules: one source for training days, the streak hint on
 * rest days only, "rest today" within 72 h, Single workout trains the picks,
 * short sessions, deload, ramp-ups, one load rounding rule, rest labels,
 * copy and defaults.
 */
import i18n from '@/i18n';

import { defaultEquipment, PRESETS } from '../equipment/catalog';
import { devLibrary } from '../exercises/library';
import { exerciseRecords } from '../library/performance';
import { trainingWeekdays } from '../notifications/plan';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { dayName, deloadSets } from '../program/block';
import { plannedDaysBetween, weekStrip } from '../program/week';
import { measurementsAllowed } from '../progress/checkin';
import { restFor } from '../settings/store';
import { doseLine } from '../workout/format';
import { convertLoad } from '../workout/loads';
import { initialStreak, showStreakHint } from '../workout/streak';
import type { WorkoutRecord } from '../workout/types';

import { listText } from '@/lib/listText';

import { rampable } from './alternatives';
import { blockReason } from './filters';
import {
  generateBalanceSession,
  getAlternatives,
  generateMobilitySession,
  generateSession,
  type GeneratorInput,
} from './index';
import type { RecentSession } from './types';

const LIBRARY = devLibrary();
const bySlug = new Map(LIBRARY.map((e) => [e.slug, e]));
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 45,
  mainGoals: ['strength'],
  muscleGoals: [{ muscleKey: 'midChest', goal: 'strengthen' }],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
  today: '2026-09-28',
  now: '2026-09-28T12:00:00Z',
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

describe('training days: one source', () => {
  it('reminders use the week strip days (5 days: Mon, Tue, Wed, Fri, Sat)', () => {
    expect(trainingWeekdays(5, 0)).toEqual([1, 2, 3, 5, 6]);
    const strip = weekStrip({
      today: '2026-09-27',
      startsOn: 0,
      daysPerWeek: 5,
      workouts: [],
      toLocal: (iso) => iso.slice(0, 10),
    });
    const planned = strip
      .filter((d) => d.mark === 'planned')
      .map((d) => new Date(`${d.date}T12:00:00`).getDay());
    expect(planned).toEqual(trainingWeekdays(5, 0));
    // A Monday-start phone moves both together.
    expect(trainingWeekdays(3, 1)).toEqual([2, 4, 6]);
  });

  it('the "Rest day?" hint never shows on a planned training day', () => {
    const streak = { ...initialStreak(), current: 4, lastActive: '2026-09-27' };
    expect(showStreakHint(streak, '2026-09-28', true)).toBe(false);
    expect(showStreakHint(streak, '2026-09-28', false)).toBe(true);
  });
});

describe('"rest today"', () => {
  const chest = (date: string, patch: Partial<RecentSession> = {}): RecentSession => ({
    date,
    at: `${date}T12:00:00Z`,
    mainMuscles: ['chest', 'midChest'],
    ...patch,
  });
  const rested = (recent: RecentSession[]) =>
    generateSession({ ...base, recentSessions: recent }).notes.some(
      (n) => n.key === 'generator.notes.rested',
    );

  it('applies to two sessions in a row within 72 h', () => {
    expect(rested([chest('2026-09-27'), chest('2026-09-26')])).toBe(true);
  });
  it('not when the older one is more than 72 h ago', () => {
    expect(rested([chest('2026-09-27'), chest('2026-09-24')])).toBe(false);
  });
  it('Custom workouts do not count', () => {
    expect(rested([chest('2026-09-27', { custom: true }), chest('2026-09-26')])).toBe(false);
  });
});

describe('Single workout and short sessions', () => {
  it('Single workout trains only what was picked, not FULL BODY', () => {
    const s = generateSession({
      ...base,
      muscleGoals: [{ muscleKey: 'biceps', goal: 'strengthen' }],
      targetsOnly: true,
      exercisesPerSession: 2,
    });
    expect(main(s).length).toBeGreaterThan(0);
    for (const i of main(s)) expect(i.targetMuscle).toBe('biceps');
    expect(dayName(s, LIBRARY)).not.toBe('fullBody');
  });

  it('short balance is balance moves only', () => {
    const s = generateBalanceSession({ ...base, mode: 'senior', band: 'senior' });
    for (const i of main(s)) expect(bySlug.get(i.exerciseId)?.pattern ?? 'balance').toBe('balance');
  });

  it('short mobility in a deload week is not a deload workout', () => {
    expect(generateMobilitySession({ ...base, deload: true }).deload).toBeFalsy();
    expect(generateBalanceSession({ ...base, deload: true }).deload).toBeFalsy();
  });

  it('deload is at least 40% fewer sets, never below 1', () => {
    for (const sets of [1, 2, 3, 4, 5, 6]) {
      const d = deloadSets(sets);
      expect(d).toBeGreaterThanOrEqual(1);
      if (sets > 1) expect(d).toBeLessThanOrEqual(sets * 0.6);
    }
  });

  it('no ramp-up sets for core work with a dumbbell (dead bug)', () => {
    const deadBug = bySlug.get('dumbbell_dead_bug')!;
    expect(rampable(deadBug)).toBe(false);
    expect(rampable(bySlug.get('goblet_squat')!)).toBe(true);
  });
});

describe('units and labels', () => {
  it('one rounding rule: 40 lb reads 17.5 kg in the workout and on the exercise page', () => {
    expect(convertLoad(40, 'lb', 'kg')).toBe(17.5);
    const w = {
      id: 'w',
      kind: 'regular',
      createdAt: '2026-09-27T10:00:00Z',
      endedAt: '2026-09-27T11:00:00Z',
      status: 'done',
      session: { items: [] },
      logs: [
        {
          itemId: 'i',
          exerciseId: 'x',
          setNo: 1,
          reps: 8,
          load: 40,
          unit: 'lb',
          loggedAt: '2026-09-27T10:10:00Z',
        },
      ],
      skipped: [],
      swaps: [],
      pains: [],
    } as unknown as WorkoutRecord;
    expect(exerciseRecords([w], 'x', 'kg').heaviest).toBe(17.5);
    expect(exerciseRecords([w], 'x', 'lb').heaviest).toBe(40);
  });

  it('the rest label shows the rest the timer runs', () => {
    const item = main(generateSession(base))[0];
    const line = doseLine(i18n.t, item, restFor(item, { restStrength: 90, restHold: 30 }));
    expect(line).toContain('90');
  });

  it('localized "and" and zero counts', async () => {
    expect(listText(['Peito', 'Costas', 'Pernas'], 'e')).toBe('Peito, Costas e Pernas');
    expect(listText(['Chest'], '&')).toBe('Chest');
    await i18n.changeLanguage('pt-BR');
    expect(i18n.t('custom.chosen', { count: 0 })).toBe('Nenhum exercício escolhido ainda');
    expect(i18n.t('custom.chosen', { count: 2 })).toBe('2 exercícios escolhidos');
    await i18n.changeLanguage('en');
  });
});

describe('ages and defaults', () => {
  it('body numbers are for adults 18–59 only', () => {
    expect(measurementsAllowed('adult')).toBe(true);
    expect(measurementsAllowed('senior')).toBe(false);
    expect(measurementsAllowed('teen')).toBe(false);
  });

  it('teens can do Inchworm lite', () => {
    expect(
      blockReason(bySlug.get('wu_inchworm_lite')!, { ...base, mode: 'teen', band: 'teen' }),
    ).not.toBe('age');
  });

  it('an onboarding without a preset starts from the matching one', () => {
    expect(defaultEquipment('home')).toEqual(PRESETS.bodyweight.items);
    expect(defaultEquipment('gym')).toEqual(PRESETS.fullGym.items);
  });

  it('after a sharp stop, a chosen muscle gets one note with the real reason', () => {
    const s = generateSession({
      ...base,
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      stoppedToday: ['knee'],
      painToday: ['knee'],
    });
    const keys = s.notes.map((n) => n.key);
    expect(keys).toContain('generator.notes.painToday');
    expect(keys).not.toContain('generator.notes.unavailable');
    expect(keys).not.toContain('generator.notes.substituted');
  });
});

describe('warm-up swaps for a seated 60+ at home', () => {
  it('every warm-up move offers at least 3 safe swaps', () => {
    const laura: GeneratorInput = {
      ...base,
      mode: 'senior',
      band: 'senior',
      position: 'seated_only',
      location: 'home',
      equipment: PRESETS.bodyweight.items,
      minutes: 30,
      mainGoals: ['mobility'],
      muscleGoals: [{ muscleKey: 'shoulders', goal: 'mobility' }],
      exercisesPerSession: 3,
    };
    const s = generateSession(laura);
    const warm = s.items.filter((i) => i.role === 'warmup' && i.part === 'warmup_mobility');
    expect(warm.length).toBeGreaterThan(0);
    for (const i of warm) {
      const alts = getAlternatives(s, i.id, laura);
      expect(alts.length).toBeGreaterThanOrEqual(3);
      for (const e of alts) expect(blockReason(e, laura)).toBeNull();
    }
  });
});

describe('static rendering safety', () => {
  it('a route param that is not a date never loops (the export hung on "[date]")', () => {
    expect(plannedDaysBetween('2026-09-28', '[date]', 0, 3)).toEqual([]);
    expect(plannedDaysBetween('2026-09-28', '2030-01-01', 0, 7).length).toBeLessThanOrEqual(366);
  });
});
