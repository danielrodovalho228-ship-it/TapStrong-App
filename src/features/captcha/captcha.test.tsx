/**
 * Security round 1, S2-04 / S2-07: a Turnstile check before a new anonymous
 * account and before an email code, once the site key is set.
 */
import '@/i18n';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { sendEmailCode } from '@/features/account/auth';
import { useAccountStore } from '@/features/account/store';
import { ensureSession } from '@/lib/supabase';

import {
  CAPTCHA_TIMEOUT_MS,
  finishCaptcha,
  requestCaptchaToken,
  setCaptchaSiteKey,
  useCaptchaStore,
} from './captcha';
import { CaptchaHost } from './CaptchaHost';

jest.mock('react-native-webview', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    WebView: ({ source }: { source: { html: string } }) => (
      <Text>
        {source.html.includes("sitekey:'0x4AAAtest'") ? 'turnstile:0x4AAAtest' : 'turnstile:?'}
      </Text>
    ),
  };
});

/** Answers the check once a caller has asked for it. */
async function answer(token: string | null) {
  await waitFor(() => expect(useCaptchaStore.getState().pending).toBe(true));
  await act(async () => finishCaptcha(token));
}

afterEach(() => {
  setCaptchaSiteKey('');
  finishCaptcha(null);
  jest.useRealTimers();
});

it('no site key: no check at all', async () => {
  await expect(requestCaptchaToken()).resolves.toBeUndefined();
  expect(useCaptchaStore.getState().pending).toBe(false);
});

it('with a site key: one widget answers every caller', async () => {
  setCaptchaSiteKey('0x4AAAtest');
  const a = requestCaptchaToken();
  const b = requestCaptchaToken();
  expect(useCaptchaStore.getState().pending).toBe(true);
  finishCaptcha('tok-1');
  await expect(a).resolves.toBe('tok-1');
  await expect(b).resolves.toBe('tok-1');
  expect(useCaptchaStore.getState().pending).toBe(false);
});

it('a check that never finishes gives up', async () => {
  jest.useFakeTimers();
  setCaptchaSiteKey('0x4AAAtest');
  const p = requestCaptchaToken();
  jest.advanceTimersByTime(CAPTCHA_TIMEOUT_MS + 1);
  await expect(p).resolves.toBeUndefined();
});

it('CaptchaHost shows the widget with the site key; Cancel gives no token', async () => {
  setCaptchaSiteKey('0x4AAAtest');
  const p = requestCaptchaToken();
  await render(<CaptchaHost />);
  expect(screen.getByText('turnstile:0x4AAAtest')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await expect(p).resolves.toBeUndefined();
});

describe('where it is used', () => {
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: null } })),
    signInAnonymously: jest.fn(async () => ({ error: null })),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    updateUser: jest.fn(async () => ({ error: { code: 'email_exists' } })),
  };
  const client = { auth } as never;
  beforeEach(() => {
    Object.values(auth).forEach((m) => m.mockClear());
    useAccountStore.getState().reset();
  });

  it('a new anonymous account carries the token; no token, no account', async () => {
    setCaptchaSiteKey('0x4AAAtest');
    const ok = ensureSession(client);
    await answer('tok-anon');
    expect(await ok).toBe(true);
    expect(auth.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'tok-anon' } });
    const refused = ensureSession(client);
    await answer(null);
    expect(await refused).toBe(false);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('the email code carries the token', async () => {
    useAccountStore.getState().update({ needsSignIn: true });
    setCaptchaSiteKey('0x4AAAtest');
    const sent = sendEmailCode(client, 'dan@example.com');
    await answer('tok-otp');
    expect(await sent).toEqual({ status: 'sent', mode: 'signin' });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'dan@example.com',
      options: { shouldCreateUser: false, captchaToken: 'tok-otp' },
    });
  });
});
