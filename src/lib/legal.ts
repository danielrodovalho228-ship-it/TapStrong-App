import { Linking } from 'react-native';

/**
 * Terms of Use and Privacy Policy (QA R7-04: required by the App Store and
 * Google Play). The pages live on the web; their addresses come from EAS
 * environment variables, never from code.
 */
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || null;
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || null;

export function openLegal(url: string | null) {
  if (url) void Linking.openURL(url).catch(() => undefined);
}
