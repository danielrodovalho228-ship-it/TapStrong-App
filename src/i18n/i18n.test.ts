import { resolveLocale, resources, SUPPORTED_LOCALES } from './index';

function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? flattenKeys(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('locales', () => {
  const enKeys = flattenKeys(resources.en.translation).sort();

  it.each(SUPPORTED_LOCALES.filter((l) => l !== 'en'))('%s has exactly the en keys', (locale) => {
    expect(flattenKeys(resources[locale].translation).sort()).toEqual(enKeys);
  });

  it.each(SUPPORTED_LOCALES)('%s has no empty strings', (locale) => {
    const walk = (obj: object): string[] =>
      Object.values(obj).flatMap((v) => (typeof v === 'string' ? [v] : walk(v as object)));
    expect(walk(resources[locale].translation).every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe('resolveLocale', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['es-MX', 'es'],
    ['es', 'es'],
    ['pt-BR', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['fr-FR', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ])('%s → %s', (tag, expected) => {
    expect(resolveLocale(tag)).toBe(expected);
  });
});

describe('database i18n keys', () => {
  it('every muscle label key in the migrations exists in en', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const dir = path.join(__dirname, '../../supabase/migrations');
    const sql = fs
      .readdirSync(dir)
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');
    const keys = [...sql.matchAll(/'(muscles\.[a-zA-Z]+)'/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    const muscles = resources.en.translation.muscles as Record<string, string>;
    for (const key of keys) {
      expect(muscles[key.replace('muscles.', '')]).toBeDefined();
    }
  });
});
