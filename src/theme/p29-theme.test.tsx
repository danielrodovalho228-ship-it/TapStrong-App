/**
 * Phase 29, C: the main buttons take the theme's coral (theme v2, #E8573F
 * light / #FF7A63 dark), never a fixed red such as #E2463A, in both modes.
 */
import '@/i18n';

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui';

import { PALETTES } from './palettes';
import { applyScheme, SchemeContext } from './tokens';

afterEach(() => applyScheme('light'));

const SRC = join(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

it('no fixed red #E2463A anywhere in the app', () => {
  const hits = files(SRC).filter(
    (f) => !f.endsWith('p29-theme.test.tsx') && /#E2463A/i.test(readFileSync(f, 'utf8')),
  );
  expect(hits).toEqual([]);
});

it.each(['light', 'dark'] as const)('%s: the primary button is the theme coral', async (scheme) => {
  applyScheme(scheme);
  await render(
    <SchemeContext.Provider value={scheme}>
      <Button label="Go" onPress={() => undefined} testID="b" />
    </SchemeContext.Provider>,
  );
  const bg = StyleSheet.flatten(screen.getByTestId('b').props.style).backgroundColor;
  expect(bg).toBe(PALETTES[scheme].accent);
});
