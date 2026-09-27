import { Linking } from 'react-native';

/**
 * Support contact (QA R3-01: the age stop needs a way out for a mistyped
 * date). Temporary address from Daniel (Phase 13); set
 * EXPO_PUBLIC_SUPPORT_EMAIL to the real support address before publishing.
 */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'danielrodovalho228@gmail.com';

export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function contactSupport(subject: string) {
  return Linking.openURL(supportMailto(subject)).catch(() => undefined);
}
