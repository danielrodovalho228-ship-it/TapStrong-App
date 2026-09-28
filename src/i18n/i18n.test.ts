import { createInstance } from 'i18next';

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

  // `_zero` is extra where a language's own rules need it (pt: CLDR puts 0
  // in "one", QA R6 P2); every one has its `_other`.
  const withoutZero = (keys: string[]) => keys.filter((k) => !k.endsWith('_zero'));
  it.each(SUPPORTED_LOCALES.filter((l) => l !== 'en'))('%s has exactly the en keys', (locale) => {
    const keys = flattenKeys(resources[locale].translation);
    expect(withoutZero(keys).sort()).toEqual(withoutZero(enKeys));
    for (const k of keys.filter((x) => x.endsWith('_zero')))
      expect(keys).toContain(k.replace(/_zero$/, '_other'));
  });

  // QA R7-07: every plural key renders its plural form for 0 ("0 dias
  // seguidos", never "0 DIA SEGUIDO") in every language.
  it.each(SUPPORTED_LOCALES)('%s: count 0 renders the plural form', async (locale) => {
    const i18n = createInstance();
    await i18n.init({ lng: locale, resources, interpolation: { escapeValue: false } });
    const bases = flattenKeys(resources[locale].translation)
      .filter((k) => k.endsWith('_one'))
      .map((k) => k.slice(0, -4));
    expect(bases.length).toBeGreaterThan(20);
    const keys = new Set(flattenKeys(resources[locale].translation));
    const t = i18n.t as unknown as (key: string, options: object) => string;
    // An explicit `_zero` ("None chosen yet") wins; otherwise the plural.
    const wrong = bases.filter(
      (base) =>
        t(base, { count: 0 }) !==
        t(keys.has(`${base}_zero`) ? `${base}_zero` : `${base}_other`, { count: 0 }),
    );
    expect(wrong).toEqual([]);
  });

  it('pt-BR says "0 dias", not "0 dia"', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'pt-BR', resources });
    expect(i18n.t('progress.days', { count: 0 })).toBe('0\u00a0dias');
    expect(i18n.t('progress.days', { count: 1 })).toBe('1\u00a0dia');
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

describe('muscle anatomy names', () => {
  it('exist in every locale for every muscle (anatomy_i18n_key = muscleAnatomy.<key>)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MUSCLE_KEYS } = require('@/features/muscles') as typeof import('@/features/muscles');
    for (const locale of SUPPORTED_LOCALES) {
      const anatomy = resources[locale].translation.muscleAnatomy as Record<string, string>;
      for (const key of MUSCLE_KEYS) expect(anatomy[key]).toBeTruthy();
    }
  });
});
