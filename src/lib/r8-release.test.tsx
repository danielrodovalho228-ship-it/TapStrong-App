/**
 * QA round 8 — P2 (release): env:check validates values, production builds
 * use the production EAS environment, no Face ID string, honest "Restore
 * purchases", and no Terms/Privacy links that go nowhere.
 */
import '@/i18n';

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { render, screen } from '@testing-library/react-native';

import { restore, restoreMessageKey } from '@/features/billing/actions';
import { LegalLinks } from '@/features/legal/LegalLinks';
import * as provider from '@/features/billing/provider';
import { useBillingStore } from '@/features/billing/store';

let mockUrls: { terms: string | null; privacy: string | null } = { terms: null, privacy: null };
jest.mock('@/lib/legal', () => ({
  get TERMS_URL() {
    return mockUrls.terms;
  },
  get PRIVACY_URL() {
    return mockUrls.privacy;
  },
  openLegal: jest.fn(),
}));

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const GOOD = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'ios',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'android',
  EXPO_PUBLIC_TERMS_URL: 'https://tapstrong.app/terms',
  EXPO_PUBLIC_PRIVACY_URL: 'https://tapstrong.app/privacy',
  EXPO_PUBLIC_SHARE_BASE_URL: 'https://tapstrong.app',
  EXPO_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAAtest',
  EXPO_PUBLIC_SUPPORT_EMAIL: 'help@tapstrong.app',
};
const envCheck = (patch: Record<string, string>) =>
  spawnSync(process.execPath, [join(ROOT, 'scripts/check-env.mjs')], {
    env: { PATH: process.env.PATH, ...GOOD, ...patch } as unknown as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });

describe('env:check validates values', () => {
  it('passes with real https links and a business address', () => {
    expect(envCheck({}).status).toBe(0);
  });
  it.each([
    ['EXPO_PUBLIC_TERMS_URL', 'http://tapstrong.app/terms'],
    ['EXPO_PUBLIC_PRIVACY_URL', 'not a url'],
    ['EXPO_PUBLIC_SHARE_BASE_URL', 'https://localhost:8081'],
    ['EXPO_PUBLIC_SUPPORT_EMAIL', 'someone@' + 'gmail.com'],
    ['EXPO_PUBLIC_SUPPORT_EMAIL', 'someone@hotmail.com'],
    ['EXPO_PUBLIC_SUPPORT_EMAIL', 'no-at-sign'],
  ])('fails on %s = %s', (name, value) => {
    const r = envCheck({ [name]: value });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(name);
  });
});

it('production builds use the production EAS environment; no Face ID string', () => {
  expect(JSON.parse(read('eas.json')).build.production.environment).toBe('production');
  const { expo } = JSON.parse(read('app.json'));
  expect(expo.plugins).toContainEqual(['expo-secure-store', { faceIDPermission: false }]);
});

describe('Restore purchases says what happened', () => {
  it('nothing on the account: "No purchases to restore"', async () => {
    const billing = provider.getBilling();
    jest.spyOn(billing, 'restore').mockResolvedValue('ok');
    useBillingStore.getState().reset();
    const r = await restore();
    expect(r).toBe('none');
    expect(restoreMessageKey(r)).toBe('billing.noneToRestore');
  });
});

it('Terms and Privacy are hidden when their address is not set', async () => {
  mockUrls = { terms: null, privacy: null };
  await render(<LegalLinks />);
  expect(screen.queryByText('Terms of Use')).toBeNull();
  expect(screen.queryByText('Privacy Policy')).toBeNull();
  mockUrls = { terms: 'https://t.test', privacy: 'https://p.test' };
  await render(<LegalLinks />);
  expect(screen.getByText('Terms of Use')).toBeTruthy();
  expect(screen.getByText('Privacy Policy')).toBeTruthy();
});
