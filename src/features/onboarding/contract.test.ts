import fs from 'fs';
import path from 'path';

import {
  EQUIPMENT,
  LOCATIONS,
  MAIN_GOALS,
  MUSCLE_GOALS,
  outputSchema,
  parseRequest,
  SEXES,
  userPrompt,
  validateOutput,
} from '../../../supabase/functions/_shared/interview';
import { MUSCLE_KEYS } from '../muscles';

const sql = fs
  .readdirSync(path.join(__dirname, '../../../supabase/migrations'))
  .map((f) => fs.readFileSync(path.join(__dirname, '../../../supabase/migrations', f), 'utf8'))
  .join('\n');

function pgEnum(name: string): string[] {
  const match = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`).exec(sql);
  if (!match) throw new Error(`enum ${name} not found`);
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('interview contract matches the database', () => {
  it('uses the same enum values as Postgres', () => {
    expect([...MAIN_GOALS]).toEqual(pgEnum('main_goal'));
    expect([...MUSCLE_GOALS]).toEqual(pgEnum('muscle_goal'));
    expect([...LOCATIONS]).toEqual(pgEnum('training_location'));
    expect([...SEXES]).toEqual(pgEnum('sex'));
  });

  it('constrains focus muscles to the database keys', () => {
    const schema = outputSchema('focus', MUSCLE_KEYS) as {
      properties: { muscle_goals: { items: { properties: { muscle_key: { enum: string[] } } } } };
    };
    expect(schema.properties.muscle_goals.items.properties.muscle_key.enum).toEqual(MUSCLE_KEYS);
  });
});

describe('validateOutput never trusts the model', () => {
  it('drops invented muscles and goals', () => {
    const result = validateOutput(
      'focus',
      {
        reply: 'Marked it.',
        muscle_goals: [
          { muscle_key: 'upperChest', goal: 'grow' },
          { muscle_key: 'pecMinorDeep', goal: 'grow' },
          { muscle_key: 'chest', goal: 'shred' },
          { muscle_key: 'upperChest', goal: 'firm' },
        ],
      },
      MUSCLE_KEYS,
    );
    expect(result.answer.muscleGoals).toEqual([{ muscleKey: 'upperChest', goal: 'grow' }]);
    expect(result.reply).toBe('Marked it.');
  });

  it('keeps only allowed schedule values and ranges', () => {
    const result = validateOutput(
      'schedule',
      {
        reply: '',
        location: 'spaceship',
        minutes: 500,
        days_per_week: 3.4,
        equipment: ['dumbbells', 'rocket', 'dumbbells'],
      },
      MUSCLE_KEYS,
    );
    expect(result.answer).toEqual({ daysPerWeek: 3, equipment: ['dumbbells'] });
    expect(result.reply).toBeNull();
  });

  it('maps "unknown" and 0 to missing, "neutral" to null', () => {
    expect(
      validateOutput('body', { reply: 'ok', sex: 'neutral', height_cm: 0, weight_kg: 0 }, [])
        .answer,
    ).toEqual({ sex: null });
    expect(
      validateOutput('body', { reply: 'ok', sex: 'unknown', height_cm: 177.8, weight_kg: 84 }, [])
        .answer,
    ).toEqual({ heightCm: 177.8, weightKg: 84 });
  });

  it('handles garbage', () => {
    expect(validateOutput('goals', 'nope', MUSCLE_KEYS)).toEqual({ answer: {}, reply: null });
    expect(validateOutput('goals', { main_goals: ['strength', 'fly'] }, []).answer).toEqual({
      mainGoals: ['strength'],
    });
  });

  it('only lists known equipment in the schema', () => {
    const schema = outputSchema('schedule', []) as {
      properties: { equipment: { items: { enum: string[] } } };
    };
    expect(schema.properties.equipment.items.enum).toEqual([...EQUIPMENT]);
  });
});

describe('parseRequest', () => {
  const ok = { step: 'schedule', text: 'Gym 3x', locale: 'en', mode: 'adult' };

  it('accepts a valid request', () => {
    expect(parseRequest(ok)).toEqual(ok);
  });

  it('refuses child mode (no open AI chat under 13)', () => {
    expect(parseRequest({ ...ok, mode: 'child' })).toEqual({ error: 'child_mode' });
  });

  it('rejects bad steps, empty or long text', () => {
    expect(parseRequest({ ...ok, step: 'exercises' })).toEqual({ error: 'invalid_step' });
    expect(parseRequest({ ...ok, text: '   ' })).toEqual({ error: 'invalid_text' });
    expect(parseRequest({ ...ok, text: 'x'.repeat(501) })).toEqual({ error: 'invalid_text' });
  });

  it('wraps the user text as data in the prompt', () => {
    const prompt = userPrompt({ ...ok, step: 'focus' } as never, ['chest']);
    expect(prompt).toContain('<answer>\nGym 3x\n</answer>');
    expect(prompt).toContain('muscle keys: chest');
  });
});
