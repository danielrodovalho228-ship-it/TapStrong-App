/** The page the native WebView shows: only Cloudflare's widget, token posted back. */
export const TURNSTILE_BASE_URL =
  process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL?.trim() || 'https://tapstrong.app/';

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, '');

export function turnstileHtml(siteKey: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&render=explicit" async defer></script>
<script>
function post(v){window.ReactNativeWebView.postMessage(v);}
function ready(){turnstile.render('#box',{sitekey:'${safeKey(siteKey)}',callback:post,'error-callback':function(){post('error')},'expired-callback':function(){post('error')}});}
</script></head><body style="margin:0;background:transparent"><div id="box"></div></body></html>`;
}
