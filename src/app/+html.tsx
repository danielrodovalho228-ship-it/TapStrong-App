import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { contentSecurityPolicy, EXPO_HYDRATE_SCRIPT } from '@/lib/csp';
import { PALETTES } from '@/theme';

const light = PALETTES.light.background;
const dark = PALETTES.dark.background;

// Paints the right background before the app loads (no white flash in Dark,
// QA R6 P2): the phone's scheme, or the Appearance choice saved on this
// device (the app stores it as "tapstrong\appearance").
// The pre-rendered page is Light; in Dark it stays hidden over the dark
// background until the app has mounted in Dark (ThemeGate sets data-ready),
// so a dark load never flashes white (QA R7-05), however slow the script
// (QA R8 P2: no timer). The browser bar follows the saved choice too.
const css = `
html,body{background:${light}}
@media (prefers-color-scheme: dark){html,body{background:${dark}}html:not([data-ready]):not([data-scheme="light"]) #root{visibility:hidden}}
html[data-scheme="light"],html[data-scheme="light"] body{background:${light}}
html[data-scheme="dark"],html[data-scheme="dark"] body{background:${dark}}
html[data-scheme="dark"]:not([data-ready]) #root{visibility:hidden}
`;
const script = `try{var v=JSON.parse(localStorage.getItem('tapstrong\\\\appearance')||'null');var a=v&&v.state&&v.state.appearance;if(a==='light'||a==='dark'){var d=document.documentElement;d.dataset.scheme=a;d.style.colorScheme=a;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',a==='dark'?'${dark}':'${light}')});}}catch(e){}`;

// Security round 1, S2-06: only these two inline scripts may run (by hash).
const csp = contentSecurityPolicy(
  [script, EXPO_HYDRATE_SCRIPT],
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

/** Web only: the HTML shell around every page (static export). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={dark} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
