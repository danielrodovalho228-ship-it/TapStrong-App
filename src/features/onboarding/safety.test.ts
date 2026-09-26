import { hasRedFlag, restrictionAreas, toggleInList, visibleConditions } from './safety';

describe('safety check rules (SPEC §2.2)', () => {
  it('flags heart condition, pregnancy/postpartum and recent surgery', () => {
    expect(hasRedFlag([], ['heart_condition'])).toBe(true);
    expect(hasRedFlag([], ['pregnant_postpartum'])).toBe(true);
    expect(hasRedFlag(['recent_surgery'], [])).toBe(true);
  });

  it('does not flag other answers', () => {
    expect(hasRedFlag(['knee', 'lower_back'], ['diabetes', 'high_blood_pressure'])).toBe(false);
    expect(hasRedFlag([], [])).toBe(false);
  });

  it('pain areas become restrictions; surgery does not', () => {
    expect(restrictionAreas(['knee', 'recent_surgery', 'neck'])).toEqual(['knee', 'neck']);
  });

  it('hides pregnancy for children and the male body', () => {
    expect(visibleConditions('child', 'f')).not.toContain('pregnant_postpartum');
    expect(visibleConditions('adult', 'm')).not.toContain('pregnant_postpartum');
    expect(visibleConditions('adult', 'f')).toContain('pregnant_postpartum');
    expect(visibleConditions('teen', null)).toContain('pregnant_postpartum');
  });

  it('toggles values', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});
