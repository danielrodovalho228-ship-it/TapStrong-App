import { contrastRatio, MIN_TEXT_CONTRAST, relativeLuminance } from './contrast';
import { PALETTES, type Palette, type Scheme } from './palettes';
import { bodyMapColors, dotColors, recoveryColors } from './tokens';

/** 3:1 for large text and UI parts (WCAG 1.4.3 large, 1.4.11). */
const MIN_NON_TEXT = 3;

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const { accent, background } = PALETTES.light;
    expect(contrastRatio(accent, background)).toBeCloseTo(contrastRatio(background, accent), 10);
  });

  it('rejects malformed colors', () => {
    expect(() => relativeLuminance('#FFF')).toThrow();
  });
});

/** Every text/background pair the screens use (theme v2), per palette. */
const textPairs = (p: Palette): [string, string, string][] => [
  ['ink on background', p.ink, p.background],
  ['ink on surface', p.ink, p.surface],
  ['muted on background', p.muted, p.background],
  ['muted on surface', p.muted, p.surface],
  ['muted strong on background', p.mutedStrong, p.background],
  ['muted strong on surface', p.mutedStrong, p.surface],
  ['accent text on background', p.accentText, p.background],
  ['accent text on surface', p.accentText, p.surface],
  ['accent text on tab bar (active tab)', p.accentText, p.tabBar],
  ['muted on tab bar (inactive tab)', p.muted, p.tabBar],
  ['on-accent on primary button', p.onAccent, p.accent],
  ['on-accent on pressed primary button', p.onAccent, p.accentPressed],
  ['on-ink on ink (selected segment, checkbox, chat)', p.onInk, p.ink],
  ['on-teal on teal (60+ Start)', p.onTeal, p.teal],
  ['teal on surface', p.teal, p.surface],
  ['teal on background', p.teal, p.background],
  ['teal on safety tint', p.teal, p.tealTint],
  ['ink on safety tint', p.ink, p.tealTint],
  ['ink on selected chip and restriction badge', p.ink, p.primarySoft],
  ['ink on a muted badge', p.ink, p.line],
  ['danger on surface', p.danger, p.surface],
  ['danger on background', p.danger, p.background],
  ['dark text on hero card', p.dark.text, p.dark.background],
  ['dark accent on hero card', p.dark.accent, p.dark.background],
  ['dark soft accent on hero card', p.dark.accentSoft, p.dark.background],
  ['on-accent on accent inside hero cards', p.onAccent, p.accent],
  ['text on the body card', p.onCanvas, p.bodyCanvas],
  ['muted text on the body card', p.onCanvasMuted, p.bodyCanvas],
  ['snackbar text (swap Undo)', p.onSurfaceRaised, p.surfaceRaised],
  ['snackbar action (Undo)', p.accentOnRaised, p.surfaceRaised],
  ['text on the demo chip', p.onCanvas, PALETTES.light.surface],
  ['accent tag (soft tint)', p.accentText, p.primarySoft],
  ['target chip on the body card', dotColors.untrained, bodyMapColors.selected],
];

/** Parts that must stand out at 3:1 (buttons, marks, dots). */
const partPairs = (p: Palette): [string, string, string][] => [
  ['success mark on surface', p.success, p.surface],
  ['warning mark on hero card', p.warning, p.dark.background],
  ['dark days (off) against the ring', p.dark.text, p.dark.muted],
  ['teal on background (icons)', p.teal, p.background],
  ['untrained dot ring on the body card', dotColors.ring, p.bodyCanvas],
];

describe.each(['light', 'dark'] as Scheme[])('%s palette meets WCAG AA', (scheme) => {
  const p = PALETTES[scheme];

  it.each(textPairs(p))('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(partPairs(p))('%s ≥ 3:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_NON_TEXT);
  });

  it('has the same keys as the other palette', () => {
    const other = PALETTES[scheme === 'light' ? 'dark' : 'light'];
    expect(Object.keys(p).sort()).toEqual(Object.keys(other).sort());
    expect(Object.keys(p.dark).sort()).toEqual(Object.keys(other.dark).sort());
  });
});

describe('fixed colors (same in both modes)', () => {
  it('recovery colors are distinct and unchanged', () => {
    expect(recoveryColors).toEqual({
      fresh: '#C43E1C',
      recovering: '#EF6B4A',
      almost: '#F6B195',
      neglected: '#8FA3B8',
    });
    expect(dotColors).toEqual({ untrained: '#FFFFFF', ring: '#333333' });
  });

  it('the body card is #E9E5DE in both modes, never inverted', () => {
    expect(PALETTES.light.bodyCanvas).toBe('#E9E5DE');
    expect(PALETTES.dark.bodyCanvas).toBe('#E9E5DE');
    expect(PALETTES.dark.onCanvas).toBe(PALETTES.light.onCanvas);
  });
});
