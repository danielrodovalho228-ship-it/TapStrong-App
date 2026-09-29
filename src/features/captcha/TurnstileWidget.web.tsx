import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { captchaShown } from './captcha';

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    s.onerror = () => reject(new Error('turnstile'));
    document.head.appendChild(s);
  });
}

/** Web Turnstile: Cloudflare's script (allowed in the page's CSP) renders into this box. */
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const box = useRef<View>(null);
  useEffect(() => {
    let id: string | null = null;
    let api: Turnstile | null = null;
    let errors = 0;
    loadScript()
      .then((t) => {
        api = t;
        id = t.render(box.current as unknown as HTMLElement, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          // Turnstile retries while this returns nothing; the third error gives up.
          'error-callback': () => {
            errors += 1;
            if (errors < 3) return undefined;
            onToken(null);
            return true;
          },
          'expired-callback': () => onToken(null),
        });
        captchaShown();
      })
      .catch(() => onToken(null));
    return () => {
      if (api && id) api.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);
  return <View ref={box} style={{ minHeight: 70, minWidth: 300 }} />;
}
