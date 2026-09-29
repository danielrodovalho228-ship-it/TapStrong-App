/**
 * Security round 1, S2-04 / S2-05: the coach's age mode is decided on the
 * server, teens never get a weight-loss goal, and calls are spaced out.
 */
import {
  parseRequest,
  serverMode,
  validateOutput,
} from '../../../supabase/functions/_shared/interview';

const NOW = new Date('2026-09-29T12:00:00Z');

describe('serverMode', () => {
  it('follows the birth date, never looser than the mode the app sent', () => {
    expect(serverMode('adult', { year: 1990, month: 3 }, NOW)).toBe('adult');
    expect(serverMode('senior', { year: 1950, month: 3 }, NOW)).toBe('senior');
    // A teen claiming adult (or 60+) stays a teen.
    expect(serverMode('adult', { year: 2011, month: 3 }, NOW)).toBe('teen');
    expect(serverMode('senior', { year: 2011, month: 3 }, NOW)).toBe('teen');
    // A child claiming teen never reaches the coach.
    expect(serverMode('teen', { year: 2015, month: 3 }, NOW)).toBe('child');
    // An adult who picked teen mode keeps it.
    expect(serverMode('teen', { year: 1990, month: 3 }, NOW)).toBe('teen');
    // No birth date: treated as a teen.
    expect(serverMode('adult', null, NOW)).toBe('teen');
  });

  it('turns 18 on the 1st of the birth month, like the app and the database', () => {
    expect(serverMode('adult', { year: 2008, month: 9 }, NOW)).toBe('adult');
    expect(serverMode('adult', { year: 2008, month: 10 }, NOW)).toBe('teen');
  });
});

describe('teens and weight loss', () => {
  it('validateOutput swaps lose_weight for fitness in teen mode only', () => {
    const raw = { main_goals: ['lose_weight', 'strength'], reply: 'ok' };
    expect(validateOutput('goals', raw, [], 'teen').answer.mainGoals).toEqual([
      'fitness',
      'strength',
    ]);
    expect(validateOutput('goals', raw, [], 'adult').answer.mainGoals).toEqual([
      'lose_weight',
      'strength',
    ]);
  });
});

describe('parseRequest', () => {
  const base = { step: 'goals', text: 'get fit', locale: 'en', mode: 'adult' };
  it('keeps a valid birth date, drops a bad one', () => {
    expect(parseRequest({ ...base, birth: { year: 1990, month: 4 } })).toMatchObject({
      birth: { year: 1990, month: 4 },
    });
    expect(parseRequest({ ...base, birth: { year: 1990, month: 13 } })).not.toHaveProperty('birth');
    expect(parseRequest({ ...base, birth: 'x' })).not.toHaveProperty('birth');
  });
});

describe('client cooldown', () => {
  const invoke = jest.fn(async () => ({ data: { answer: {}, reply: null }, error: null }));
  beforeAll(() => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({
      getSupabase: () => ({ functions: { invoke } }),
      ensureSession: async () => true,
    }));
  });

  it('spaces calls and sends the birth date', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const coach = require('./coach') as typeof import('./coach');
    coach.resetCoachCooldown();
    const start = Date.now();
    await coach.interpretAnswer('goals', 'a', {
      locale: 'en',
      mode: 'adult',
      birth: { year: 1990, month: 4 },
    });
    await coach.interpretAnswer('goals', 'b', { locale: 'en', mode: 'adult' });
    expect(Date.now() - start).toBeGreaterThanOrEqual(coach.COACH_COOLDOWN_MS - 50);
    expect(invoke).toHaveBeenNthCalledWith(1, 'coach-interview', {
      body: expect.objectContaining({ birth: { year: 1990, month: 4 } }),
    });
  });
});
