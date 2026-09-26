import fs from 'fs';
import path from 'path';

import { FOCUS_CHIP_KEYS, MUSCLE_KEYS, MUSCLES } from './index';

describe('bundled muscle list', () => {
  const sql = fs
    .readdirSync(path.join(__dirname, '../../../supabase/migrations'))
    .map((f) => fs.readFileSync(path.join(__dirname, '../../../supabase/migrations', f), 'utf8'))
    .join('\n');

  it('matches the database seed exactly', () => {
    const seeded = [
      ...sql.matchAll(
        /\('([a-zA-Z]+)', '(upper|core|lower)', '\{([a-z,]*)\}', '(muscles\.[a-zA-Z]+)', (null|'[a-zA-Z]+')\)/g,
      ),
    ].map(([, key, region, views, labelKey, parent]) => ({
      key,
      region,
      views: views ? views.split(',') : [],
      labelKey,
      parentKey: parent === 'null' ? null : parent.replace(/'/g, ''),
    }));
    expect(MUSCLES).toEqual(seeded);
  });

  it('focus chips are real muscle keys', () => {
    for (const key of FOCUS_CHIP_KEYS) expect(MUSCLE_KEYS).toContain(key);
  });
});
