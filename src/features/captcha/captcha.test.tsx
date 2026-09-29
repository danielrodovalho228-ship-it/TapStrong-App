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

it('with a site key: one single-use token per request, a fresh widget for the next', async () => {
  setCaptchaSiteKey('0x4AAAtest');
  const a = requestCaptchaToken();
  const b = requestCaptchaToken();
  expect(useCaptchaStore.getState().pending).toBe(true);
  const round = useCaptchaStore.getState().round;
  finishCaptcha('tok-1-0123456789abcdefghij');
  await expect(a).resolves.toBe('tok-1-0123456789abcdefghij');
  // b still waits, on a new widget.
  expect(useCaptchaStore.getState()).toMatchObject({ pending: true, round: round + 1 });
  finishCaptcha('tok-2-0123456789abcdefghij');
  await expect(b).resolves.toBe('tok-2-0123456789abcdefghij');
  expect(useCaptchaStore.getState().pending).toBe(false);
});

it('closing ends every waiting request; something that is not a token is refused', async () => {
  setCaptchaSiteKey('0x4AAAtest');
  const a = requestCaptchaToken();
  const b = requestCaptchaToken();
  finishCaptcha(null);
  await expect(a).resolves.toBeUndefined();
  await expect(b).resolves.toBeUndefined();
  const c = requestCaptchaToken();
  finishCaptcha('<script>');
  await expect(c).resolves.toBeUndefined();
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
    await answer('tok-anon-0123456789abcdefghij');
    expect(await ok).toBe(true);
    expect(auth.signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: 'tok-anon-0123456789abcdefghij' },
    });
    const refused = ensureSession(client);
    await answer(null);
    expect(await refused).toBe(false);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('the email code carries the token', async () => {
    useAccountStore.getState().update({ needsSignIn: true });
    setCaptchaSiteKey('0x4AAAtest');
    const sent = sendEmailCode(client, 'dan@example.com');
    await answer('tok-otp-0123456789abcdefghij');
    expect(await sent).toEqual({ status: 'sent', mode: 'signin' });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'dan@example.com',
      options: { shouldCreateUser: false, captchaToken: 'tok-otp-0123456789abcdefghij' },
    });
  });
});
