import { Linking } from 'react-native';

/**
 * Support contact (QA R3-01: the age stop needs a way out for a mistyped
 * date). The address comes only from EXPO_PUBLIC_SUPPORT_EMAIL (EAS
 * environment): no personal fallback ships in a build (QA R7 P2), and a
 * production build stops without it (scripts/check-env.mjs).
 */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export function supportMailto(subject: string): string | null {
  return SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}` : null;
}

export function contactSupport(subject: string) {
  const url = supportMailto(subject);
  return url ? Linking.openURL(url).catch(() => undefined) : Promise.resolve();
}
