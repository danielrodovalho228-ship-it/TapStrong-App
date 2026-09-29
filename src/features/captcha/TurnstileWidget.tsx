import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { captchaShown } from './captcha';
import { turnstileHtml, TURNSTILE_BASE_URL } from './turnstileHtml';

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
    const data = e.nativeEvent.data;
    if (data === 'shown') return captchaShown();
    onToken(data && data !== 'error' ? data : null);
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
      onShouldStartLoadWithRequest={(r) =>
        r.url.startsWith(TURNSTILE_BASE_URL) ||
        r.url.startsWith('https://challenges.cloudflare.com/')
      }
      javaScriptEnabled
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  web: { width: 320, height: 90, backgroundColor: 'transparent' },
});
