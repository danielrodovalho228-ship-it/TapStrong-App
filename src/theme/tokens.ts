import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { PALETTES, type Palette, type Scheme } from './palettes';

/**
 * Brand tokens — SPEC §2.6 and §4, theme v2. Colors live only here and in
 * palettes.ts (a test fails on color literals anywhere else). No gradients,
 * no emoji.
 */

/**
 * The active palette (theme v2, docs/theme-v2.md), for code outside React
 * and for `makeStyles` factories. Components read colors through
 * `useColors()` and styles through the hook `makeStyles` returns, so a theme
 * change re-renders them in place: no remount, navigation and screen state
 * stay (QA R6-01).
 */
export const colors: Palette = clonePalette(PALETTES.light);

let scheme: Scheme = 'light';
export const currentScheme = () => scheme;

function clonePalette(p: Palette): Palette {
  return { ...p, dark: { ...p.dark } };
}

/** Makes `next` the active palette for non-React code (ThemeGate calls it). */
export function applyScheme(next: Scheme) {
  if (next === scheme) return;
  scheme = next;
  const p = PALETTES[next];
  Object.assign(colors, p, { dark: { ...p.dark } });
}

/** The scheme on screen; ThemeGate provides it. Light outside the app root. */
export const SchemeContext = createContext<Scheme>('light');

/** The scheme on screen. */
export const useScheme = () => useContext(SchemeContext);

/** The palette on screen; a new object when the scheme changes. */
export const useColors = (): Palette => PALETTES[useContext(SchemeContext)];

/**
 * `StyleSheet.create` per scheme, as a hook: `const useStyles = makeStyles(
 * () => ({ ... colors.x ... }))`, then `const styles = useStyles()` in the
 * component. The factory reads `colors`, which holds the requested scheme
 * while it runs.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): () => T {
  const cache: Partial<Record<Scheme, T>> = {};
  const build = (s: Scheme): T => {
    const cached = cache[s];
    if (cached) return cached;
    const previous = scheme;
    applyScheme(s);
    try {
      return (cache[s] = StyleSheet.create(factory()));
    } finally {
      applyScheme(previous);
    }
  };
  return function useStyles() {
    return build(useContext(SchemeContext));
  };
}

/**
 * Body-map recovery colors — SPEC §4, theme v2: the same in both modes.
 * `untrained` dots are white with a dark ring.
 */
export const recoveryColors = {
  fresh: '#C43E1C', // 0–24 h
  recovering: '#EF6B4A', // 24–48 h
  almost: '#F6B195', // 48–72 h
  neglected: '#8FA3B8', // not trained in 5+ days
} as const;
export const dotColors = { untrained: '#FFFFFF', ring: '#333333' } as const;
/**
 * The body map sits on its own light card in both modes (theme v2), so its
 * marks never follow the palette: a selected dot is the "fresh" red with a
 * white ring, halos are that red at low opacity.
 */
export const bodyMapColors = {
  selected: recoveryColors.fresh,
  selectedHalo: 'rgba(196, 62, 28, 0.25)',
  workedHalo: 'rgba(196, 62, 28, 0.35)',
  highlight: 'rgba(196, 62, 28, 0.45)',
} as const;

export const radius = {
  button: 10,
  card: 12,
  chip: 6,
  /** The light card around the body map (theme v2). */
  bodyCard: 16,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const sizes = {
  /** Minimum touch target — SPEC §2.6. */
  touchTarget: 44,
  primaryButtonHeight: 54,
  /** Mockup canvas the designs are drawn on. */
  designWidth: 390,
  designHeight: 844,
} as const;

export const fonts = {
  heading: 'BarlowCondensed_700Bold',
  headingSemi: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
} as const;

/**
 * Type scale in steps. Captions never go below 13 px (SPEC §11.9).
 * Senior mode shifts every variant up by `SENIOR_TYPE_BOOST` steps (SPEC §8).
 */
export const typeSteps = [13, 15, 17, 20, 24, 28, 34, 42, 52, 64] as const;
export const SENIOR_TYPE_BOOST = 2;

export type TextVariant =
  'display' | 'h1' | 'h2' | 'h3' | 'button' | 'body' | 'bodyStrong' | 'label' | 'caption';

type VariantSpec = {
  step: number;
  font: (typeof fonts)[keyof typeof fonts];
  uppercase?: boolean;
  letterSpacing?: number;
  lineHeightRatio: number;
};

export const textVariants: Record<TextVariant, VariantSpec> = {
  display: {
    step: 7,
    font: fonts.heading,
    uppercase: true,
    letterSpacing: 0.5,
    lineHeightRatio: 1.0,
  },
  h1: { step: 6, font: fonts.heading, uppercase: true, letterSpacing: 0.4, lineHeightRatio: 1.05 },
  h2: { step: 4, font: fonts.heading, uppercase: true, letterSpacing: 0.3, lineHeightRatio: 1.1 },
  h3: {
    step: 3,
    font: fonts.headingSemi,
    uppercase: true,
    letterSpacing: 0.3,
    lineHeightRatio: 1.15,
  },
  button: {
    step: 1,
    font: fonts.heading,
    uppercase: true,
    letterSpacing: 0.9,
    lineHeightRatio: 1.2,
  },
  body: { step: 2, font: fonts.body, lineHeightRatio: 1.4 },
  bodyStrong: { step: 2, font: fonts.bodySemi, lineHeightRatio: 1.4 },
  label: { step: 1, font: fonts.bodySemi, letterSpacing: 0.2, lineHeightRatio: 1.3 },
  caption: { step: 0, font: fonts.body, lineHeightRatio: 1.35 },
};

export function fontSizeFor(variant: TextVariant, boost = 0): number {
  const index = Math.min(textVariants[variant].step + boost, typeSteps.length - 1);
  return typeSteps[index];
}
