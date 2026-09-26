/**
 * Brand tokens — SPEC §2.6 and §4. Do not add colors outside this file.
 * No gradients, no emoji.
 */

export const colors = {
  background: '#F3F1ED',
  ink: '#121212',
  muted: '#5E6168',
  mutedStrong: '#45484F',
  line: '#DDD8D0',
  accent: '#C23E17',
  accentPressed: '#A3340F',
  teal: '#1F5F5B',
  surface: '#FFFFFF',
  onAccent: '#FFFFFF',
  bodyCanvas: '#E9E5DE',
  dark: {
    background: '#121212',
    accent: '#E8663F',
    accentSoft: '#EDA487',
    text: '#F3F1ED',
  },
} as const;

/** Body-map recovery colors — SPEC §4. */
export const recoveryColors = {
  fresh: '#C23E17', // 0–24 h
  recovering: '#E8663F', // 24–48 h
  almost: '#EDA487', // 48–72 h
  neglected: '#7F93A8', // not trained in 5+ days
} as const;

export const radius = {
  button: 10,
  card: 12,
  chip: 6,
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
  'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'label' | 'caption';

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
  body: { step: 2, font: fonts.body, lineHeightRatio: 1.4 },
  bodyStrong: { step: 2, font: fonts.bodySemi, lineHeightRatio: 1.4 },
  label: { step: 1, font: fonts.bodySemi, letterSpacing: 0.2, lineHeightRatio: 1.3 },
  caption: { step: 0, font: fonts.body, lineHeightRatio: 1.35 },
};

export function fontSizeFor(variant: TextVariant, boost = 0): number {
  const index = Math.min(textVariants[variant].step + boost, typeSteps.length - 1);
  return typeSteps[index];
}
