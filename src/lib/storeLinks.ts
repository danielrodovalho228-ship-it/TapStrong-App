import { Linking } from 'react-native';

/**
 * The app's store pages, for the web's "use the mobile app" notes (security
 * round 2, P3). From EXPO_PUBLIC_APP_STORE_URL / EXPO_PUBLIC_PLAY_STORE_URL
 * only, https on the store's own host; unset until the app is published, and
 * then no link is shown.
 */
function storeUrl(value: string | undefined, host: string): string | null {
  try {
    const u = new URL(value?.trim() ?? '');
    return u.protocol === 'https:' && u.host === host ? u.toString() : null;
  } catch {
    return null;
  }
}

// Read statically: Expo inlines EXPO_PUBLIC_* values at build time.
const BUILD_ENV = {
  EXPO_PUBLIC_APP_STORE_URL: process.env.EXPO_PUBLIC_APP_STORE_URL,
  EXPO_PUBLIC_PLAY_STORE_URL: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
};

export const storeLinks = (env: Record<string, string | undefined> = BUILD_ENV) => ({
  ios: storeUrl(env.EXPO_PUBLIC_APP_STORE_URL, 'apps.apple.com'),
  android: storeUrl(env.EXPO_PUBLIC_PLAY_STORE_URL, 'play.google.com'),
});

export const openStore = (url: string) => Linking.openURL(url).catch(() => undefined);
