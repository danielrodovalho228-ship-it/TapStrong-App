import { router } from 'expo-router';

/**
 * Back, or Home when the screen was opened directly (a link, a reload): never
 * a dead end (QA R7 P2, R8 P2).
 */
export function backOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
