import { colors, recoveryColors } from './tokens';
import { contrastRatio, MIN_TEXT_CONTRAST, relativeLuminance } from './contrast';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio(colors.accent, colors.background)).toBeCloseTo(
      contrastRatio(colors.background, colors.accent),
      10,
    );
  });

  it('rejects malformed colors', () => {
    expect(() => relativeLuminance('#FFF')).toThrow();
  });
});

describe('brand text pairs meet 4.5:1 (SPEC §2.6)', () => {
  const pairs: [string, string, string][] = [
    ['ink on background', colors.ink, colors.background],
    ['ink on surface', colors.ink, colors.surface],
    ['muted on background', colors.muted, colors.background],
    ['muted on surface', colors.muted, colors.surface],
    ['muted strong on background', colors.mutedStrong, colors.background],
    ['accent text on background', colors.accent, colors.background],
    ['white on accent (primary button)', colors.onAccent, colors.accent],
    ['white on accent pressed', colors.onAccent, colors.accentPressed],
    ['teal on surface', colors.teal, colors.surface],
    ['teal on background', colors.teal, colors.background],
    ['white on ink (selected chip)', colors.onAccent, colors.ink],
    ['dark accent on dark screen', colors.dark.accent, colors.dark.background],
    ['dark soft accent on dark screen', colors.dark.accentSoft, colors.dark.background],
    ['dark text on dark screen', colors.dark.text, colors.dark.background],
    ['ink on body map canvas', colors.ink, colors.bodyCanvas],
  ];

  it.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('recovery colors are distinct', () => {
    expect(new Set(Object.values(recoveryColors)).size).toBe(4);
  });
});
