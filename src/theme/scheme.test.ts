import { resolveScheme } from '@/features/appearance/store';

import { PALETTES } from './palettes';
import { applyScheme, colors, currentScheme, makeStyles } from './tokens';

afterEach(() => applyScheme('light'));

describe('appearance', () => {
  it('Automatic follows the phone; Light and Dark are fixed', () => {
    expect(resolveScheme('auto', 'dark')).toBe('dark');
    expect(resolveScheme('auto', 'light')).toBe('light');
    expect(resolveScheme('auto', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('applyScheme', () => {
  it('swaps every token, nested ones too', () => {
    applyScheme('dark');
    expect(currentScheme()).toBe('dark');
    expect(colors.background).toBe(PALETTES.dark.background);
    expect(colors.dark.background).toBe(PALETTES.dark.dark.background);
    applyScheme('light');
    expect(colors.background).toBe(PALETTES.light.background);
    expect(colors.dark.background).toBe(PALETTES.light.dark.background);
  });

  it('never changes the palettes themselves', () => {
    applyScheme('dark');
    colors.dark.text = 'changed';
    applyScheme('light');
    applyScheme('dark');
    expect(PALETTES.dark.dark.text).not.toBe('changed');
    expect(colors.dark.text).toBe(PALETTES.dark.dark.text);
  });
});

describe('makeStyles', () => {
  it('reads the active palette', () => {
    const styles = makeStyles(() => ({ root: { backgroundColor: colors.background } }));
    expect(styles.root.backgroundColor).toBe(PALETTES.light.background);
    applyScheme('dark');
    expect(styles.root.backgroundColor).toBe(PALETTES.dark.background);
    expect(Object.keys(styles)).toEqual(['root']);
  });
});
