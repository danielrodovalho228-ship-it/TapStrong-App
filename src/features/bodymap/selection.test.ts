import {
  clampQuantity,
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

  it('uses "fat-loss" wording for adults only (SPEC §2.3)', () => {
    expect(firmDescriptionKey('adult')).toBe('goalsSheet.goals.firm.descAdult');
    expect(firmDescriptionKey('senior')).toBe('goalsSheet.goals.firm.descAdult');
    expect(firmDescriptionKey('teen')).toBe('goalsSheet.goals.firm.descMinor');
  });
});
