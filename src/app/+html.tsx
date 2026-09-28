import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { PALETTES } from '@/theme';

const light = PALETTES.light.background;
const dark = PALETTES.dark.background;

// Paints the right background before the app loads (no white flash in Dark,
// QA R6 P2): the phone's scheme, or the Appearance choice saved on this
// device (the app stores it as "tapstrong\appearance").
const css = `
html,body{background:${light}}
@media (prefers-color-scheme: dark){html,body{background:${dark}}}
html[data-scheme="light"],html[data-scheme="light"] body{background:${light}}
html[data-scheme="dark"],html[data-scheme="dark"] body{background:${dark}}
`;
const script = `try{var v=JSON.parse(localStorage.getItem('tapstrong\\\\appearance')||'null');var a=v&&v.state&&v.state.appearance;if(a==='light'||a==='dark'){document.documentElement.dataset.scheme=a;document.documentElement.style.colorScheme=a;}}catch(e){}`;

/** Web only: the HTML shell around every page (static export). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
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
