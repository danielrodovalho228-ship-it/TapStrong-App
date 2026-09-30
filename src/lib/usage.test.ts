/**
 * Phase 27 "Measure": anonymous usage marks. Only counts and coarse time
 * buckets are reported; the day 7 / day 30 returns report once each.
 */
import { setAnalyticsSink } from './analytics';
import { bucket, noteSetLogged, noteTap, resetTaps, useUsageStore } from './usage';

const events: { event: string; props?: object }[] = [];
setAnalyticsSink((event, props) => events.push({ event, props }));

beforeEach(() => {
  events.length = 0;
  useUsageStore.getState().reset();
  resetTaps();
});

it('taps to the first set: reported once per app open', () => {
  noteTap();
  noteTap();
  noteSetLogged();
  noteTap();
  noteSetLogged();
  expect(events).toEqual([{ event: 'first_set_logged', props: { taps: 2 } }]);
});

it('install → first exercise, in a coarse bucket, once', () => {
  const t0 = new Date('2026-09-30T09:00:00');
  useUsageStore.getState().opened(t0);
  useUsageStore.getState().firstExercise(new Date(t0.getTime() + 75_000));
  useUsageStore.getState().firstExercise(new Date(t0.getTime() + 999_000));
  expect(events).toEqual([{ event: 'first_exercise_started', props: { seconds: 90 } }]);
  expect(bucket(20)).toBe(30);
  expect(bucket(4000)).toBe(601);
});

it('returns on day 7 and day 30 are reported once each', () => {
  const t0 = new Date('2026-09-01T09:00:00');
  const day = (n: number) => new Date(t0.getTime() + n * 86_400_000);
  const s = () => useUsageStore.getState();
  s().opened(t0);
  s().opened(day(3));
  s().opened(day(7));
  s().opened(day(8));
  s().opened(day(31));
  expect(events.map((e) => e.props)).toEqual([{ day: 7 }, { day: 30 }]);
});
