/**
 * QA round 5 — P2: pull keeps up with push, gym strength fillers, day names,
 * plan filters, 60+ plans, Single workout limits, 60+ dosing, the pain-today
 * reason in the Library, sharing by the secure record, and free-plan
 * reminders on extra days.
 */
import { useOwnerIdentityStore } from '../family/ownerIdentity';
import { canShare } from '../family/store';
import { devLibrary } from '../exercises/library';
import { libraryView } from '../library/browse';
import { muscleByKey } from '../muscles';
import { planNotifications } from '../notifications/plan';
import { GYM_EQUIPMENT_OPTIONS } from '../onboarding/options';
import { dayName } from '../program/block';
import { findPlans, READY_PLANS } from '../program/plans';

import { rampAllowed } from './alternatives';
import { doseFor } from './dosage';
import { generateSession } from './generate';
import type { GeneratorInput, RecentSession } from './types';

const LIBRARY = devLibrary();
const byId = new Map(LIBRARY.map((e) => [e.id, e]));
const groupOf = (k: string) => muscleByKey(muscleByKey(k)?.parentKey ?? k)?.movementGroup;
const base: GeneratorInput = {
  library: LIBRARY,
  includeDrafts: true,
  mode: 'adult',
  band: 'adult',
  position: 'standing',
  location: 'gym',
  equipment: GYM_EQUIPMENT_OPTIONS,
  minutes: 50,
  mainGoals: ['look'],
  muscleGoals: [
    { muscleKey: 'midChest', goal: 'grow' },
    { muscleKey: 'shoulders', goal: 'grow' },
  ],
  exercisesPerSession: 5,
  setsPerExercise: 3,
  painAreas: [],
  conditions: [],
  restrictions: [],
};
const main = (s: ReturnType<typeof generateSession>) => s.items.filter((i) => i.role === 'main');

describe('pull keeps up with push', () => {
  it('over 4 weeks of push-heavy goals: pull ≥ 90% of push sets, vertical pulls weekly', () => {
    const recent: RecentSession[] = [];
    let push = 0;
    let pull = 0;
    let vertical = 0;
    for (let d = 0; d < 28; d += 2) {
      const day = new Date(Date.parse('2026-09-01T12:00:00Z') + d * 864e5)
        .toISOString()
        .slice(0, 10);
      const s = generateSession({
        ...base,
        today: day,
        now: `${day}T12:00:00Z`,
        recentSessions: [...recent],
      });
      for (const i of main(s)) {
        const e = byId.get(i.exerciseId)!;
        const g = groupOf(e.muscles.find((m) => m.role === 'primary')!.muscleKey);
        if (g === 'push') push += i.sets;
        if (g === 'pull') pull += i.sets;
        if (e.pattern === 'vertical_pull') vertical++;
      }
      recent.unshift({
        date: day,
        at: `${day}T12:00:00Z`,
        mainMuscles: main(s).flatMap((i) =>
          byId
            .get(i.exerciseId)!
            .muscles.filter((m) => m.role === 'primary')
            .map((m) => m.muscleKey),
        ),
        exerciseIds: main(s).map((i) => i.exerciseId),
      });
    }
    expect(pull).toBeGreaterThanOrEqual(0.9 * push);
    expect(vertical).toBeGreaterThanOrEqual(4);
  });

  it('gym strength fillers are never holds, bands or rehab moves', () => {
    for (let d = 0; d < 7; d++) {
      const day = new Date(Date.parse('2026-09-28T12:00:00Z') + d * 864e5)
        .toISOString()
        .slice(0, 10);
      const s = generateSession({
        ...base,
        mainGoals: ['strength'],
        muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
        today: day,
        now: `${day}T12:00:00Z`,
      });
      for (const i of main(s).slice(1)) {
        const e = byId.get(i.exerciseId)!;
        if (e.pattern === 'balance') continue;
        expect(e.dose).not.toBe('time');
        expect(e.rehab).toBeFalsy();
        expect(e.equipment.some((q) => q.includes('band'))).toBe(false);
      }
    }
  });
});

describe('day names', () => {
  const session = (slugs: string[]) =>
    ({ items: slugs.map((s, i) => ({ id: `i${i}`, role: 'main', exerciseId: s })) }) as never;
  const pick = (pattern: string) =>
    LIBRARY.find((e) => e.pattern === pattern && e.parts.includes('main'))!.id;

  it('legs only is "Legs", core only is "Core"', () => {
    expect(dayName(session([pick('squat'), pick('hinge')]), LIBRARY)).toBe('legs');
    expect(dayName(session([pick('core_flexion')]), LIBRARY)).toBe('core');
    expect(dayName(session([pick('horizontal_pull'), pick('core_flexion')]), LIBRARY)).toBe(
      'upper',
    );
  });
});

describe('plans', () => {
  it('the muscle filter keeps plans with a day for that group', () => {
    const push = findPlans('adult', { muscleGroup: 'push' });
    expect(push.length).toBeGreaterThan(0);
    for (const p of push) expect(p.split).not.toBe('fullBody');
    expect(push.some((p) => p.goal === 'mobilityBalance')).toBe(false);
  });

  it('no push/pull/legs on 5–6 days for 60+', () => {
    for (const p of READY_PLANS.filter((x) => x.split === 'ppl' && x.daysPerWeek >= 5))
      expect(p.modes).not.toContain('senior');
  });
});

describe('Single workout and 60+ dosing', () => {
  it('at most two moves per picked muscle, weighted first for gym strength', () => {
    const s = generateSession({
      ...base,
      mainGoals: ['strength'],
      muscleGoals: [{ muscleKey: 'quads', goal: 'strengthen' }],
      targetsOnly: true,
      exercisesPerSession: 5,
    });
    expect(main(s).length).toBeLessThanOrEqual(2);
    for (const i of main(s)) expect(byId.get(i.exerciseId)!.equipment.length).toBeGreaterThan(0);
  });

  it('60+: no ramp-up sets, strength rest at least 60 s', () => {
    const row = LIBRARY.find((e) => e.loaded && e.pattern === 'horizontal_pull')!;
    const senior = { ...base, mode: 'senior' as const, band: 'senior' as const };
    expect(rampAllowed(row, senior)).toBe(false);
    expect(doseFor('balance', 'senior', row, 2).restSeconds).toBeGreaterThanOrEqual(60);
    expect(doseFor('firm', 'senior', row, 2).restSeconds).toBeGreaterThanOrEqual(60);
  });
});

describe('Library reason after a pain stop', () => {
  it('says "left out today", not "ruled out by a restriction"', () => {
    const view = libraryView(
      { ...base, stoppedToday: ['knee'] },
      { muscle: 'quads' },
      (e) => e.slug,
    );
    expect(view.notForYou.some((x) => x.reason === 'painToday')).toBe(true);
    expect(view.notForYou.some((x) => x.reason === 'restriction')).toBe(false);
  });
});

describe('sharing follows the secure record', () => {
  it('a minor edited to "self" still needs the parent switch', () => {
    useOwnerIdentityStore.setState({ minors: { t1: 'teen' } });
    const edited = { id: 't1', kind: 'self' as const, createdAt: '' };
    expect(canShare(edited, 'teen')).toBe(false);
    expect(canShare({ ...edited, shareAllowed: true }, 'teen')).toBe(true);
    useOwnerIdentityStore.setState({ minors: {} });
  });
});

describe('free plan with more days than free workouts', () => {
  it('extra days remind about short mobility, not a workout', () => {
    const plan = planNotifications({
      prefs: {
        reminders: true,
        reminderTime: '18:00',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
      daysPerWeek: 5,
      startsOn: 0,
      freePlan: true,
      streak: 0,
      lastActive: null,
      now: new Date('2026-09-28T12:00:00Z'),
    } as Parameters<typeof planNotifications>[0]);
    const reminders = plan.filter((p) => p.kind === 'reminder');
    expect(reminders).toHaveLength(5);
    expect(reminders.filter((p) => 'mobility' in p && p.mobility)).toHaveLength(2);
    const paid = planNotifications({
      prefs: {
        reminders: true,
        reminderTime: '18:00',
        streakSaver: false,
        streakSaverTime: '20:00',
      },
      daysPerWeek: 5,
      startsOn: 0,
      freePlan: false,
      streak: 0,
      lastActive: null,
      now: new Date('2026-09-28T12:00:00Z'),
    } as Parameters<typeof planNotifications>[0]);
    expect(paid.some((p) => 'mobility' in p && p.mobility)).toBe(false);
  });
});
