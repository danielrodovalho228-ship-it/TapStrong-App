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
/**
 * Security round 2, S2-P2-8: the widget must show up within this time (it
 * can't offline), else the check ends at once instead of a blank window.
 */
export const CAPTCHA_LOAD_TIMEOUT_MS = 15_000;

let siteKey = TURNSTILE_SITE_KEY;
export const captchaSiteKey = () => siteKey;
export const captchaEnabled = () => !!siteKey;
/** Tests only. */
export const setCaptchaSiteKey = (key: string) => {
  siteKey = key;
};

/**
 * `round` changes for each token asked of the widget: Turnstile tokens are
 * single-use, so every waiting request gets its own (round 2, P3), and the
 * host remounts the widget for the next one.
 */
type State = { pending: boolean; round: number };
export const useCaptchaStore = create<State>(() => ({ pending: false, round: 0 }));

/** A Turnstile token: letters, digits, "_", "-" and ".", 20 to 4096 long. */
export const TOKEN_PATTERN = /^[\w.-]{20,4096}$/;

let waiting: ((token: string | undefined) => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
// A check that failed or was closed in this app session (S2-P2-8): the coach
// then goes on offline instead of asking again on every answer.
let failedThisSession = false;
export const captchaFailedThisSession = () => failedThisSession;
/** Tests only. */
export const resetCaptchaSession = () => {
  failedThisSession = false;
};

function startRound() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => finishCaptcha(null), CAPTCHA_TIMEOUT_MS);
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => finishCaptcha(null), CAPTCHA_LOAD_TIMEOUT_MS);
  useCaptchaStore.setState((s) => ({ pending: true, round: s.round + 1 }));
}

export function requestCaptchaToken(): Promise<string | undefined> {
  if (!captchaEnabled()) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    waiting.push(resolve);
    if (waiting.length === 1) startRound();
  });
}

/** The widget is on screen: the person now has the full time to answer. */
export function captchaShown() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = null;
}

/**
 * Called by the widget with its token, or null on error / close. A token
 * answers the first waiting request only; the next one gets a fresh widget.
 * Closing or an error ends every waiting request.
 */
export function finishCaptcha(token: string | null) {
  if (timer) clearTimeout(timer);
  timer = null;
  captchaShown();
  const valid = !!token && TOKEN_PATTERN.test(token);
  if (waiting.length) failedThisSession = !valid;
  if (valid && waiting.length) {
    const first = waiting.shift()!;
    first(token!);
    if (waiting.length) startRound();
    else useCaptchaStore.setState({ pending: false });
    return;
  }
  const callers = waiting;
  waiting = [];
  useCaptchaStore.setState({ pending: false });
  for (const resolve of callers) resolve(undefined);
}

/** Supabase auth options with the token, when there is one. */
export const withCaptcha = <T extends object>(options: T, token: string | undefined) =>
  token ? { ...options, captchaToken: token } : options;
