/**
 * Test helper (QA R8 P2): simulates weeks of generated sessions and measures
 * pull vs push over every strict 7-day rolling window.
 */
import type { Exercise } from '../exercises/types';
import { muscleByKey } from '../muscles';
import { planDayInput, type ReadyPlan } from '../program/plans';

import { generateSession } from './generate';
import type { GeneratorInput, RecentSession } from './types';

const groupOf = (k: string) => muscleByKey(muscleByKey(k)?.parentKey ?? k)?.movementGroup;

export const realVerticalPull = (e: Exercise, location: string) =>
  e.pattern === 'vertical_pull' &&
  e.dose !== 'time' &&
  !e.isolation &&
  (location !== 'gym' || e.muscles.find((m) => m.role === 'primary')?.muscleKey === 'lats');

export type SimDay = {
  date: string;
  push: number;
  pull: number;
  vertical: boolean;
  slugs: string[];
  sets: number;
  minutes: number;
  /** Working sets per parent muscle that day. */
  muscleSets: Record<string, number>;
};

export function simulate(o: {
  base: GeneratorInput;
  library: Exercise[];
  plan?: ReadyPlan;
  start: string;
  weekdays: number[];
  weeks: number;
}): SimDay[] {
  const byId = new Map(o.library.map((e) => [e.id, e]));
  const recent: RecentSession[] = [];
  const out: SimDay[] = [];
  let k = 0;
  const startMs = Date.parse(`${o.start}T12:00:00Z`);
  for (let d = 0; d < o.weeks * 7; d++) {
    const date = new Date(startMs + d * 864e5);
    if (!o.weekdays.includes(date.getUTCDay())) continue;
    const day = date.toISOString().slice(0, 10);
    const input = { ...o.base, today: day, now: `${day}T12:00:00Z`, recentSessions: [...recent] };
    const s = generateSession(o.plan ? planDayInput(input, o.plan, k++, o.library) : input);
    const main = s.items.filter((i) => i.role === 'main');
    let push = 0;
    let pull = 0;
    let vertical = false;
    for (const i of main) {
      const e = byId.get(i.exerciseId)!;
      for (const m of e.muscles.filter((x) => x.role === 'primary')) {
        const g = groupOf(m.muscleKey);
        if (g === 'push') push += i.sets;
        if (g === 'pull') pull += i.sets;
      }
      if (realVerticalPull(e, o.base.location)) vertical = true;
    }
    out.push({
      date: day,
      push,
      pull,
      vertical,
      slugs: main.map((i) => byId.get(i.exerciseId)!.slug),
      sets: main.reduce((n, i) => n + i.sets, 0),
      minutes: s.estimatedMinutes ?? 0,
      muscleSets: main.reduce<Record<string, number>>((acc, i) => {
        const e = byId.get(i.exerciseId)!;
        if (['balance', 'mobility', 'stretch', 'breathing'].includes(e.pattern)) return acc;
        const parents = new Set(
          e.muscles
            .filter((m) => m.role === 'primary')
            .map((m) => muscleByKey(m.muscleKey)?.parentKey ?? m.muscleKey),
        );
        for (const p of parents) acc[p] = (acc[p] ?? 0) + i.sets;
        return acc;
      }, {}),
    });
    recent.unshift({
      date: day,
      at: `${day}T12:00:00Z`,
      mainMuscles: main.flatMap((i) =>
        byId
          .get(i.exerciseId)!
          .muscles.filter((m) => m.role === 'primary')
          .map((m) => m.muscleKey),
      ),
      exerciseIds: main.map((i) => i.exerciseId),
      muscleSets: main.reduce<Record<string, number>>((acc, i) => {
        const e = byId.get(i.exerciseId)!;
        if (['balance', 'mobility', 'stretch', 'breathing'].includes(e.pattern)) return acc;
        for (const m of e.muscles.filter((x) => x.role === 'primary'))
          acc[m.muscleKey] = (acc[m.muscleKey] ?? 0) + i.sets;
        return acc;
      }, {}),
    });
  }
  return out;
}

/** Every strict 7-day window ending on a session day, once a full week has passed. */
export function windows(days: SimDay[]) {
  const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
  const first = ms(days[0].date);
  return days
    .filter((d) => ms(d.date) - first >= 6 * 864e5)
    .map((end) => {
      const inside = days.filter(
        (d) => ms(end.date) - ms(d.date) >= 0 && ms(end.date) - ms(d.date) < 7 * 864e5,
      );
      const push = inside.reduce((n, d) => n + d.push, 0);
      const pull = inside.reduce((n, d) => n + d.pull, 0);
      return { end: end.date, push, pull, vertical: inside.some((d) => d.vertical) };
    });
}

/** The most working sets any parent muscle got in any strict 7-day window. */
export function maxWeeklySets(days: SimDay[]): { muscle: string; sets: number; end: string } {
  const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
  let worst = { muscle: '', sets: 0, end: '' };
  for (const end of days) {
    const totals: Record<string, number> = {};
    for (const d of days) {
      const gap = ms(end.date) - ms(d.date);
      if (gap < 0 || gap >= 7 * 864e5) continue;
      for (const [m, n] of Object.entries(d.muscleSets)) totals[m] = (totals[m] ?? 0) + n;
    }
    for (const [m, n] of Object.entries(totals))
      if (n > worst.sets) worst = { muscle: m, sets: n, end: end.date };
  }
  return worst;
}
