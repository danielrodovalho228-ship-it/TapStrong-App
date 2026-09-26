import { evaluateAgeGate } from './age-gate';

const today = { year: 2026, month: 9 };
const born = (year: number, month = 1) => ({ year, month });

describe('evaluateAgeGate (SPEC §2.3, §8)', () => {
  it('adult answering for themselves', () => {
    expect(evaluateAgeGate('me', born(1983, 3), today)).toEqual({
      status: 'ok',
      age: 43,
      mode: 'adult',
      band: 'adult',
    });
  });

  it('teen answering for themselves gets teen mode', () => {
    expect(evaluateAgeGate('me', born(2011), today)).toMatchObject({ status: 'ok', mode: 'teen' });
  });

  it('under 13 cannot self-onboard', () => {
    expect(evaluateAgeGate('me', born(2015), today).status).toBe('ask_parent');
  });

  it('a parent adding a child under 13 needs the consent flow', () => {
    expect(evaluateAgeGate('child', born(2015), today).status).toBe('guardian_consent');
  });

  it('a parent adding a teen continues in teen mode', () => {
    expect(evaluateAgeGate('child', born(2010), today)).toMatchObject({
      status: 'ok',
      mode: 'teen',
    });
  });

  it('rejects ages under 9 for anyone', () => {
    expect(evaluateAgeGate('me', born(2019), today).status).toBe('too_young');
    expect(evaluateAgeGate('child', born(2019), today).status).toBe('too_young');
  });

  it('"my child" must be under 18', () => {
    expect(evaluateAgeGate('child', born(2000), today).status).toBe('child_too_old');
  });

  it('parent or grandparent routes to senior mode at 60+', () => {
    expect(evaluateAgeGate('parent', born(1950), today)).toMatchObject({
      status: 'ok',
      mode: 'senior',
      band: 'elder',
    });
    expect(evaluateAgeGate('parent', born(2012), today).status).toBe('parent_too_young');
  });
});
