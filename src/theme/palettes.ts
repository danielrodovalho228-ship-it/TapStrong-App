/**
 * Theme v2 "Coral suave" (docs/theme-v2.md): one palette per appearance.
 * Every screen reads `colors` (tokens.ts), which holds the active palette.
 * The only file with color literals besides tokens.ts.
 *
 * Three light values differ from the spec table because the spec also asks
 * for WCAG AA on every pair (see docs/progress.md, Phase 17):
 * - `muted` #6F6861 (spec #7A726B was 4.4:1 on the background);
 * - `onAccent` #1A0F0C on the coral fill (white was 3.6:1);
 * - `accentText` #BF3721 for coral used as text (the fill coral was 3.4:1);
 * - `danger` #C73E3E (spec #D64545 was 4.4:1 as text on white).
 */
export type Scheme = 'light' | 'dark';

export type Palette = {
  /** Screen background (spec `bg`). */
  background: string;
  /** Cards and sheets. */
  surface: string;
  /** Body text (spec `text`); also the fill of inverse controls. */
  ink: string;
  /** Text on `ink` fills (selected segments, checkboxes, chat bubbles). */
  onInk: string;
  /** Secondary text (spec `textMuted`). */
  muted: string;
  /** Stronger secondary text: readable on the body-map canvas too. */
  mutedStrong: string;
  line: string;
  /** The action coral (spec `primary`): primary buttons, active tab, today, progress. */
  accent: string;
  accentPressed: string;
  /** Text and icons on `accent` fills (spec `onPrimary`). */
  onAccent: string;
  /** Coral used as text (links, eyebrows): AA on background and cards. */
  accentText: string;
  /** Eyebrows and selected chips background (spec `primarySoft`). */
  primarySoft: string;
  /** Positive / safety text and fills. */
  teal: string;
  /** Safety note background. */
  tealTint: string;
  /** Text on `teal` fills (60+ Start). */
  onTeal: string;
  tabBar: string;
  /** A panel one step below the background: the plan's list (Phase 31, G). */
  sunken: string;
  /** Muscle chips by movement group (Phase 31, G), with dark text on them. */
  group: { push: string; pull: string; legs: string; core: string };
  onGroup: string;
  /** Backdrop behind sheets and dialogs: black at 50% in both modes. */
  scrim: string;
  /** Snackbars and toasts (swap Undo): a raised panel with its own text. */
  surfaceRaised: string;
  onSurfaceRaised: string;
  accentOnRaised: string;
  success: string;
  warning: string;
  danger: string;
  /** Body images keep their own background in both modes. */
  bodyCanvas: string;
  /** Text and icons on the light body card: the same in both modes. */
  onCanvas: string;
  onCanvasMuted: string;
  /** Hero cards and the full-screen player, rest and milestone screens. */
  dark: {
    background: string;
    text: string;
    accent: string;
    accentSoft: string;
    /** Inactive fills on dark surfaces (days not trained, rings). */
    muted: string;
  };
};

export const PALETTES: Record<Scheme, Palette> = {
  light: {
    background: '#FAF7F4',
    surface: '#FFFFFF',
    ink: '#1E1C1A',
    onInk: '#FFFFFF',
    muted: '#6F6861',
    mutedStrong: '#57504A',
    line: '#EAE4DE',
    accent: '#E8573F',
    accentPressed: '#F07A64',
    onAccent: '#1A0F0C',
    accentText: '#BF3721',
    primarySoft: '#FFE3DC',
    teal: '#1F6B55',
    tealTint: '#E3F0EA',
    onTeal: '#FFFFFF',
    tabBar: '#FFFFFF',
    sunken: '#F1ECE6',
    group: { push: '#7CC4F2', pull: '#7DD3A8', legs: '#F2D04C', core: '#B59CF2' },
    onGroup: '#14161A',
    scrim: 'rgba(0, 0, 0, 0.5)',
    surfaceRaised: '#2A2623',
    onSurfaceRaised: '#FFFFFF',
    accentOnRaised: '#FF7A63',
    success: '#2E9E6B',
    warning: '#E0A100',
    danger: '#C73E3E',
    bodyCanvas: '#E9E5DE',
    onCanvas: '#1E1C1A',
    onCanvasMuted: '#57504A',
    dark: {
      background: '#2A2623',
      text: '#FFFFFF',
      accent: '#FF7A63',
      accentSoft: '#FFB4A3',
      muted: '#5A534D',
    },
  },
  dark: {
    background: '#15171B',
    surface: '#1F2227',
    ink: '#F1EEEA',
    onInk: '#15171B',
    muted: '#A39D96',
    mutedStrong: '#C2BCB5',
    line: '#2E3238',
    accent: '#FF7A63',
    accentPressed: '#FF947F',
    onAccent: '#1A0F0C',
    accentText: '#FF7A63',
    primarySoft: '#3A2622',
    teal: '#4CC38A',
    tealTint: '#1D2C27',
    onTeal: '#0E1A15',
    tabBar: '#1B1D22',
    sunken: '#0E1013',
    group: { push: '#7CC4F2', pull: '#7DD3A8', legs: '#F2D04C', core: '#B59CF2' },
    onGroup: '#14161A',
    scrim: 'rgba(0, 0, 0, 0.5)',
    surfaceRaised: '#353A42',
    onSurfaceRaised: '#F1EEEA',
    accentOnRaised: '#FF947F',
    success: '#4CC38A',
    warning: '#F2C94C',
    danger: '#FF6B6B',
    bodyCanvas: '#E9E5DE',
    onCanvas: '#1E1C1A',
    onCanvasMuted: '#57504A',
    dark: {
      background: '#262A30',
      text: '#F1EEEA',
      accent: '#FF7A63',
      accentSoft: '#FFB4A3',
      muted: '#4A4F57',
    },
  },
};
