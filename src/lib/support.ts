import { Linking } from 'react-native';

/**
 * Support contact (QA R3-01: the age stop needs a way out for a mistyped
 * date). Set EXPO_PUBLIC_SUPPORT_EMAIL for the store build.
 */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@tapstrong.app';

export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function contactSupport(subject: string) {
  return Linking.openURL(supportMailto(subject)).catch(() => undefined);
}
