import { ageFrom, bandForAge, birthYearOptions, modeForAge, recoveryHoursFor } from './age';

describe('ageFrom', () => {
  const today = { year: 2026, month: 9 };
  it('counts the birthday only after the birth month', () => {
    expect(ageFrom({ year: 1983, month: 3 }, today)).toBe(43);
    expect(ageFrom({ year: 2013, month: 8 }, today)).toBe(13);
    // Same month: birthday may not have happened yet — younger side.
    expect(ageFrom({ year: 2013, month: 9 }, today)).toBe(12);
    expect(ageFrom({ year: 2013, month: 10 }, today)).toBe(12);
  });
});

describe('bands (SPEC §5)', () => {
  it.each([
    [8, null],
    [9, 'kid'],
    [12, 'kid'],
    [13, 'teen'],
    [17, 'teen'],
    [18, 'young'],
    [29, 'young'],
    [30, 'adult'],
    [44, 'adult'],
    [45, 'mid'],
    [59, 'mid'],
    [60, 'senior'],
    [74, 'senior'],
    [75, 'elder'],
    [99, 'elder'],
  ])('age %i → %s', (age, band) => {
    expect(bandForAge(age)).toBe(band);
  });
});

describe('modes (SPEC §8)', () => {
  it.each([
    [9, 'child'],
    [12, 'child'],
    [13, 'teen'],
    [17, 'teen'],
    [18, 'adult'],
    [59, 'adult'],
    [60, 'senior'],
    [80, 'senior'],
  ])('age %i → %s', (age, mode) => {
    expect(modeForAge(age)).toBe(mode);
  });

  it('seniors get 96 h recovery, others 72 h', () => {
    expect(recoveryHoursFor('senior')).toBe(96);
    expect(recoveryHoursFor('adult')).toBe(72);
  });
});

describe('birthYearOptions', () => {
  it('runs from 9 years ago back to 110, newest first', () => {
    const years = birthYearOptions({ year: 2026, month: 9 });
    expect(years[0]).toBe(2017);
    expect(years[years.length - 1]).toBe(1916);
  });
});
