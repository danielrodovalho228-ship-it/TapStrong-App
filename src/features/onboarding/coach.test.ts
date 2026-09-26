import { interpretAnswer } from './coach';

const mockInvoke = jest.fn();
let mockConfigured = false;

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => (mockConfigured ? { functions: { invoke: mockInvoke } } : null),
}));

const ctx = { locale: 'en' as const, mode: 'adult' as const };

beforeEach(() => {
  mockInvoke.mockReset();
  mockConfigured = false;
});

describe('interpretAnswer', () => {
  it('parses the schedule offline when Supabase is not mockConfigured', async () => {
    const result = await interpretAnswer('schedule', 'Gym, 40 minutes, 3 days a week', ctx);
    expect(result).toEqual({
      answer: { location: 'gym', minutes: 40, daysPerWeek: 3 },
      reply: null,
      source: 'local',
    });
  });

  it('returns nothing it cannot understand offline', async () => {
    expect(await interpretAnswer('focus', 'bigger arms', ctx)).toMatchObject({
      answer: {},
      source: 'none',
    });
  });

  it('re-validates the coach response and drops invented muscles', async () => {
    mockConfigured = true;
    mockInvoke.mockResolvedValue({
      data: {
        answer: {
          muscleGoals: [
            { muscleKey: 'biceps', goal: 'grow' },
            { muscleKey: 'superBiceps', goal: 'grow' },
          ],
        },
        reply: 'Noted.',
      },
      error: null,
    });
    const result = await interpretAnswer('focus', 'bigger arms', ctx);
    expect(mockInvoke).toHaveBeenCalledWith('coach-interview', {
      body: { step: 'focus', text: 'bigger arms', locale: 'en', mode: 'adult' },
    });
    expect(result).toEqual({
      answer: { muscleGoals: [{ muscleKey: 'biceps', goal: 'grow' }] },
      reply: 'Noted.',
      source: 'coach',
    });
  });

  it('falls back offline when the function fails', async () => {
    mockConfigured = true;
    mockInvoke.mockRejectedValue(new Error('network'));
    expect((await interpretAnswer('schedule', 'home 30 min 2x', ctx)).source).toBe('local');
  });
});
