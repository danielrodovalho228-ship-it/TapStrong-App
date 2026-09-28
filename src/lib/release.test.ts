/**
 * QA round 7 — P2 (release config): no personal contact in the app, native
 * store settings, and the production build checks its variables.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

it('no personal email address in the app source', () => {
  const hits = files(join(ROOT, 'src')).filter((f) =>
    /danielrodovalho|@gmail\.com/.test(readFileSync(f, 'utf8')),
  );
  // This test file names the pattern it looks for.
  expect(hits.filter((f) => !f.endsWith('release.test.ts'))).toEqual([]);
});

it('support email comes only from the environment', () => {
  expect(read('src/lib/support.ts')).toMatch(/EXPO_PUBLIC_SUPPORT_EMAIL\?\.trim\(\) \|\| null/);
});

it('native store settings', () => {
  const { expo } = JSON.parse(read('app.json'));
  expect(expo.ios.config.usesNonExemptEncryption).toBe(false);
  expect(expo.android.blockedPermissions).toEqual(
    expect.arrayContaining([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ]),
  );
  // The background color is used only without a background image.
  expect(expo.android.adaptiveIcon.backgroundImage).toBeUndefined();
});

it('no update channels without expo-updates; production build checks its variables', () => {
  const pkg = JSON.parse(read('package.json'));
  const eas = JSON.parse(read('eas.json'));
  if (!pkg.dependencies['expo-updates'])
    for (const profile of Object.values(eas.build) as { channel?: string }[])
      expect(profile.channel).toBeUndefined();
  expect(pkg.scripts['eas-build-pre-install']).toMatch(/check-env\.mjs --if-production/);
  expect(read('scripts/check-env.mjs')).toMatch(/EXPO_PUBLIC_TERMS_URL/);
});
