/**
 * Security round 2, S2-P2-8: offline, the captcha never showed and the coach
 * sat behind a blank window for up to 120 s on every answer. Now a widget
 * that doesn't render in 15 s, or fails to load, ends the check at once, and
 * after one failed or closed check the coach goes on offline for the session.
 */
import '@/i18n';

import { act, render, waitFor } from '@testing-library/react-native';

import { interpretAnswer } from '@/features/onboarding/coach';
import { useAccountStore } from '@/features/account/store';
import { ensureSession } from '@/lib/supabase';

import {
  CAPTCHA_LOAD_TIMEOUT_MS,
  captchaShown,
  finishCaptcha,
  requestCaptchaToken,
  resetCaptchaSession,
  setCaptchaSiteKey,
  useCaptchaStore,
} from './captcha';
import { CaptchaHost } from './CaptchaHost';

type WebViewProps = {
  onMessage: (e: { nativeEvent: { data: string; url?: string } }) => void;
  onShouldStartLoadWithRequest: (r: { url: string }) => boolean;
  onError: () => void;
  onHttpError: () => void;
};
let mockWebView: WebViewProps | null = null;
jest.mock('react-native-webview', () => ({
  WebView: (props: WebViewProps) => {
    mockWebView = props;
    return null;
  },
}));

const auth = {
  getSession: jest.fn(async () => ({ data: { session: null } })),
  signInAnonymously: jest.fn(async () => ({ error: null })),
};
const invoke = jest.fn();
const mockClient = { auth, functions: { invoke } };
jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('@/lib/supabase'),
  getSupabase: () => mockClient,
}));

/** Answers the check once a caller has asked for it. */
async function answer(token: string | null) {
  await waitFor(() => expect(useCaptchaStore.getState().pending).toBe(true));
  await act(async () => finishCaptcha(token));
}

beforeEach(() => {
  setCaptchaSiteKey('0x4AAAtest');
  resetCaptchaSession();
  useAccountStore.getState().reset();
  auth.signInAnonymously.mockClear();
  invoke.mockClear();
  mockWebView = null;
});
afterEach(() => {
  finishCaptcha(null);
  setCaptchaSiteKey('');
  resetCaptchaSession();
  jest.useRealTimers();
});

it('a widget that never shows (offline) ends the check after 15 s, not 120 s', async () => {
  jest.useFakeTimers();
  const p = requestCaptchaToken();
  jest.advanceTimersByTime(CAPTCHA_LOAD_TIMEOUT_MS + 1);
  await expect(p).resolves.toBeUndefined();
  expect(useCaptchaStore.getState().pending).toBe(false);
});

it('once shown, the person has the full time to answer', async () => {
  jest.useFakeTimers();
  const p = requestCaptchaToken();
  captchaShown();
  jest.advanceTimersByTime(CAPTCHA_LOAD_TIMEOUT_MS + 1);
  expect(useCaptchaStore.getState().pending).toBe(true);
  finishCaptcha('tok-0123456789abcdefghij');
  await expect(p).resolves.toBe('tok-0123456789abcdefghij');
});

it('native: a load error or an HTTP error ends the check at once; "shown" is not a token', async () => {
  const p = requestCaptchaToken();
  await render(<CaptchaHost />);
  await act(async () =>
    mockWebView!.onMessage({ nativeEvent: { data: 'shown', url: 'https://tapstrong.app/' } }),
  );
  expect(useCaptchaStore.getState().pending).toBe(true);
  await act(async () => mockWebView!.onError());
  await expect(p).resolves.toBeUndefined();

  const q = requestCaptchaToken();
  await act(async () => mockWebView?.onHttpError());
  await expect(q).resolves.toBeUndefined();
});

it('after one closed check the coach goes on offline, without asking again', async () => {
  const first = interpretAnswer('schedule', '3 days, 30 minutes', { locale: 'en', mode: 'adult' });
  await answer(null); // the person closes it
  const r1 = await first;
  expect(r1.unavailable).toBe(true);
  // The offline parser still reads what it can.
  expect(r1.source).toBe('local');

  const r2 = await interpretAnswer('schedule', '4 days', { locale: 'en', mode: 'adult' });
  expect(r2.unavailable).toBe(true);
  expect(useCaptchaStore.getState().pending).toBe(false);
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalled();
});

it('other callers (email code, sign-in) still ask again', async () => {
  const first = ensureSession(mockClient as never);
  await answer(null);
  expect(await first).toBe(false);
  const again = ensureSession(mockClient as never);
  await answer('tok-0123456789abcdefghij');
  expect(await again).toBe(true);
});

describe('round 2 P3: Turnstile hardening (native)', () => {
  const TOKEN = '0.abcdefghijklmnopqrstuvwxyz-_';
  it('takes a token only from our page, and only if it looks like one', async () => {
    const p = requestCaptchaToken();
    await render(<CaptchaHost />);
    const send = (data: string, url?: string) =>
      act(async () => mockWebView!.onMessage({ nativeEvent: { data, url } }));
    await send(TOKEN, 'https://evil.example/');
    await send(TOKEN);
    await send('not a token', 'https://tapstrong.app/');
    expect(useCaptchaStore.getState().pending).toBe(true);
    await send(TOKEN, 'https://tapstrong.app/');
    await expect(p).resolves.toBe(TOKEN);
  });

  it('allows the iOS blank / srcdoc sub-frames, nothing else new', async () => {
    const p = requestCaptchaToken();
    await render(<CaptchaHost />);
    const allow = mockWebView!.onShouldStartLoadWithRequest;
    expect(allow({ url: 'about:blank' })).toBe(true);
    expect(allow({ url: 'about:srcdoc' })).toBe(true);
    expect(allow({ url: 'https://challenges.cloudflare.com/cdn-cgi/x' })).toBe(true);
    expect(allow({ url: 'https://evil.example/' })).toBe(false);
    expect(allow({ url: 'javascript:alert(1)' })).toBe(false);
    finishCaptcha(null);
    await p;
  });

  it('the page lets Turnstile retry: only the third error gives up', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { turnstileHtml } = require('./turnstileHtml') as typeof import('./turnstileHtml');
    const html = turnstileHtml('0x4AAAtest');
    expect(html).toMatch(/'error-callback':function\(\)\{errors\+\+;if\(errors>=3\)/);
  });
});
