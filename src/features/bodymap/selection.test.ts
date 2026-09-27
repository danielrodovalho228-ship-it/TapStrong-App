import {
  allowedBands,
  clampQuantity,
  displayBand,
  expandToHotspots,
  firmDescriptionKey,
  priorityOf,
  setGoal,
  toggleMuscle,
} from './selection';

describe('body map selection', () => {
  it('expands parent muscles from the interview to their dots', () => {
    expect(
      expandToHotspots([
        { muscleKey: 'chest', goal: 'firm' },
        { muscleKey: 'upperChest', goal: 'grow' },
        { muscleKey: 'abs', goal: 'strengthen' },
        { muscleKey: 'glutes', goal: 'grow' },
      ]),
    ).toEqual([
      { muscleKey: 'upperChest', goal: 'firm' },
      { muscleKey: 'midChest', goal: 'firm' },
      { muscleKey: 'lowerChest', goal: 'firm' },
      { muscleKey: 'upperAbs', goal: 'strengthen' },
      { muscleKey: 'lowerAbs', goal: 'strengthen' },
      { muscleKey: 'glutes', goal: 'grow' },
    ]);
  });

  it('toggles muscles and keeps pick order as priority', () => {
    let entries = toggleMuscle([], 'upperChest', 'grow');
    entries = toggleMuscle(entries, 'midChest', 'grow');
    expect(priorityOf(entries, 'midChest')).toBe(2);
    entries = toggleMuscle(entries, 'upperChest', 'grow');
    expect(entries).toEqual([{ muscleKey: 'midChest', goal: 'grow' }]);
    expect(priorityOf(entries, 'midChest')).toBe(1);
  });

  it('changes one goal only', () => {
    expect(
      setGoal(
        [
          { muscleKey: 'a', goal: 'grow' },
          { muscleKey: 'b', goal: 'grow' },
        ],
        'b',
        'firm',
      ),
    ).toEqual([
      { muscleKey: 'a', goal: 'grow' },
      { muscleKey: 'b', goal: 'firm' },
    ]);
  });

  it('clamps quantities', () => {
    expect(clampQuantity('exercises', 99)).toBe(10);
    expect(clampQuantity('sets', 0)).toBe(1);
    expect(clampQuantity('days', 8)).toBe(7);
  });

  it('adult profiles see 18+ bodies only; minors see kid and teen bodies only', () => {
    expect(allowedBands('adult')).toEqual(['young', 'adult', 'mid', 'senior', 'elder']);
    expect(allowedBands('senior')).not.toContain('kid');
    expect(allowedBands('teen')).toEqual(['kid', 'teen']);
    expect(allowedBands('child')).toEqual(['kid', 'teen']);
  });

  it('a minor never displays an adult body, even one stored before (QA round 1)', () => {
    for (const stored of ['young', 'adult', 'mid', 'senior', 'elder'] as const) {
      expect(displayBand(stored, 'kid', 'child')).toBe('kid');
      expect(displayBand(stored, 'teen', 'teen')).toBe('teen');
    }
    expect(displayBand('teen', 'kid', 'child')).toBe('teen');
  });

  it('falls back to the own band when a stored one is not allowed', () => {
    expect(displayBand('kid', 'adult', 'adult')).toBe('adult');
    expect(displayBand('mid', 'adult', 'adult')).toBe('mid');
    expect(displayBand(undefined, 'teen', 'teen')).toBe('teen');
  });

  it('uses "fat-loss" wording for adults only (SPEC §2.3)', () => {
    expect(firmDescriptionKey('adult')).toBe('goalsSheet.goals.firm.descAdult');
    expect(firmDescriptionKey('senior')).toBe('goalsSheet.goals.firm.descAdult');
    expect(firmDescriptionKey('teen')).toBe('goalsSheet.goals.firm.descMinor');
  });
});
