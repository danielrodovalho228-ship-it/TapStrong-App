import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { captchaShown, TOKEN_PATTERN } from './captcha';
import { turnstileHtml, TURNSTILE_BASE_URL } from './turnstileHtml';

/** Messages come only from our page (the base URL), never another frame. */
export const fromWidget = (url: string | undefined) => !!url && url.startsWith(TURNSTILE_BASE_URL);

/**
 * Loads allowed: our page, Cloudflare's challenge, and the blank / srcdoc
 * sub-frames iOS reports for Turnstile's iframe (round 2, P3). Nothing else.
 */
export const allowedLoad = (url: string) =>
  url.startsWith(TURNSTILE_BASE_URL) ||
  url.startsWith('https://challenges.cloudflare.com/') ||
  url === 'about:blank' ||
  url === 'about:srcdoc';

/**
 * Native Turnstile: Cloudflare's widget in a WebView that runs only its own
 * page (no navigation away), posting the token back. The base URL is the
 * hostname listed in the Turnstile site settings (docs/launch-readiness.md).
 */
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const onMessage = (e: WebViewMessageEvent) => {
    // Only our own page speaks (round 2, P3): a message from another frame
    // or origin, or anything that isn't a token, is ignored.
    if (!fromWidget(e.nativeEvent.url)) return;
    const data = e.nativeEvent.data;
    if (data === 'shown') return captchaShown();
    if (data === 'error') return onToken(null);
    if (TOKEN_PATTERN.test(data)) onToken(data);
  };
  // Offline or blocked: end the check now, not after a blank wait (S2-P2-8).
  const failed = () => onToken(null);
  return (
    <WebView
      style={styles.web}
      originWhitelist={['https://*']}
      source={{ html: turnstileHtml(siteKey), baseUrl: TURNSTILE_BASE_URL }}
      onMessage={onMessage}
      onError={failed}
      onHttpError={failed}
      onShouldStartLoadWithRequest={(r) => allowedLoad(r.url)}
      javaScriptEnabled
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  web: { width: 320, height: 90, backgroundColor: 'transparent' },
});
