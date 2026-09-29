import { create } from 'zustand';

/**
 * Cloudflare Turnstile before an anonymous sign-in or an email code (security
 * round 1, S2-04 / S2-07; Daniel chose Turnstile). Off while
 * EXPO_PUBLIC_TURNSTILE_SITE_KEY is empty (development, tests): the Supabase
 * captcha setting must be switched on only after this build is out.
 *
 * requestCaptchaToken() asks CaptchaHost (mounted once in the root layout)
 * to show the widget and resolves with its token, or undefined when the
 * check fails, is closed or takes too long.
 */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
export const CAPTCHA_TIMEOUT_MS = 120_000;

let siteKey = TURNSTILE_SITE_KEY;
export const captchaSiteKey = () => siteKey;
export const captchaEnabled = () => !!siteKey;
/** Tests only. */
export const setCaptchaSiteKey = (key: string) => {
  siteKey = key;
};

type State = { pending: boolean };
export const useCaptchaStore = create<State>(() => ({ pending: false }));

let waiting: ((token: string | undefined) => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function requestCaptchaToken(): Promise<string | undefined> {
  if (!captchaEnabled()) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    waiting.push(resolve);
    if (waiting.length > 1) return; // one widget answers every caller
    useCaptchaStore.setState({ pending: true });
    timer = setTimeout(() => finishCaptcha(null), CAPTCHA_TIMEOUT_MS);
  });
}

/** Called by the widget with its token, or null on error / close. */
export function finishCaptcha(token: string | null) {
  if (timer) clearTimeout(timer);
  timer = null;
  const callers = waiting;
  waiting = [];
  useCaptchaStore.setState({ pending: false });
  for (const resolve of callers) resolve(token ?? undefined);
}

/** Supabase auth options with the token, when there is one. */
export const withCaptcha = <T extends object>(options: T, token: string | undefined) =>
  token ? { ...options, captchaToken: token } : options;
