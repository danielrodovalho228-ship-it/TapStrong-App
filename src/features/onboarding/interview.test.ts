import {
  allowsFreeText,
  allowsMeasurements,
  isStepComplete,
  parseScheduleLocally,
} from './interview';
import { defaultMuscleGoal } from './options';
import { visibleMainGoals } from './visible';

const base = { mainGoals: [], muscleGoals: [], focusDeferred: false };

describe('interview steps', () => {
  it('requires the right answers per step', () => {
    expect(isStepComplete('goals', base)).toBe(false);
    expect(isStepComplete('goals', { ...base, mainGoals: ['strength'] })).toBe(true);
    expect(isStepComplete('schedule', { ...base, location: 'gym', minutes: 40 })).toBe(false);
    expect(
      isStepComplete('schedule', { ...base, location: 'gym', minutes: 40, daysPerWeek: 3 }),
    ).toBe(true);
    expect(isStepComplete('focus', base)).toBe(false);
    expect(isStepComplete('focus', { ...base, focusDeferred: true })).toBe(true);
    expect(isStepComplete('body', base)).toBe(false);
    expect(isStepComplete('body', { ...base, sex: null })).toBe(true);
  });

  it('children get guided choices only and no measurements (SPEC §2.3)', () => {
    expect(allowsFreeText('child')).toBe(false);
    expect(allowsMeasurements('child')).toBe(false);
    expect(allowsFreeText('teen')).toBe(true);
    expect(allowsMeasurements('adult')).toBe(true);
  });

  it('minors are not offered a weight-loss goal', () => {
    expect(visibleMainGoals('teen')).not.toContain('lose_weight');
    expect(visibleMainGoals('child')).not.toContain('lose_weight');
    expect(visibleMainGoals('adult')).toContain('lose_weight');
  });

  it('maps the first main goal to a default muscle goal', () => {
    expect(defaultMuscleGoal(['look'])).toBe('grow');
    expect(defaultMuscleGoal(['lose_weight', 'look'])).toBe('firm');
    expect(defaultMuscleGoal([])).toBe('strengthen');
  });
});

describe('parseScheduleLocally', () => {
  it.each([
    ['Gym, about 40 minutes, 3 days a week.', { location: 'gym', minutes: 40, daysPerWeek: 3 }],
    ['Casa, 30 minutos, 4 veces por semana', { location: 'home', minutes: 30, daysPerWeek: 4 }],
    ['Academia 1h, 5x', { location: 'gym', minutes: 60, daysPerWeek: 5 }],
    ['no parque, 45 min, 2 dias', { location: 'outdoors', minutes: 45, daysPerWeek: 2 }],
  ])('%s', (text, expected) => {
    expect(parseScheduleLocally(text)).toEqual(expected);
  });

  it('ignores implausible numbers', () => {
    expect(parseScheduleLocally('500 minutes, 9 days')).toEqual({});
  });
});
