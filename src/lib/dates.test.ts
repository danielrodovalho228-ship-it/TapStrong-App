import { addDays, daysBetween, deviceWeekStart, weekStart } from './dates';

describe('dates', () => {
  it('finds the start of the week for any first weekday', () => {
    expect(weekStart('2026-09-26')).toBe('2026-09-20'); // Saturday → Sunday
    expect(weekStart('2026-09-26', 1)).toBe('2026-09-21'); // → Monday
    expect(weekStart('2026-09-20', 1)).toBe('2026-09-14');
    expect(weekStart('2026-09-20')).toBe('2026-09-20');
  });

  it('adds and counts days across months', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(daysBetween('2026-09-26', '2026-10-03')).toBe(7);
  });

  it('defaults to Sunday when the phone does not say', () => {
    // The test locale mock has no calendar information.
    expect(deviceWeekStart()).toBe(0);
  });
});
