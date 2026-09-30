import type { BodyBand } from '@/features/profile/age';

/**
 * Phase 28 — sharing. A card is drawn from a small, safe data object: only
 * what the picture shows. The builders in data.ts create it from the app's
 * state; the body, weight, measurements, BMI, place, exact time, pain,
 * restrictions and a minor's name never get in (checked by tests).
 */
export type ShareTemplate =
  'workout' | 'sticker' | 'muscle' | 'exercise' | 'achievement' | 'week' | 'month' | 'fun';

export type ShareBackground = 'light' | 'dark' | 'transparent';
export type ShareFormat = 'story' | 'feed';

/** Stories 1080 × 1920 and feed 1080 × 1350. */
export const FORMAT_PX: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};
/** Cards are laid out at 1/3 size and captured at 3×. */
export const DESIGN_SCALE = 3;

/** Muscle key → how it is lit: "main" (today's target) or "also". */
export type LitMuscles = Record<string, 'main' | 'also'>;

export type WorkoutCard = {
  template: 'workout' | 'sticker';
  /** "Back and biceps": the day's target muscle keys, labelled when drawn. */
  targets: string[];
  lit: LitMuscles;
  minutes: number;
  exercises: number;
  sets: number;
  streak: number;
};

export type MuscleCard = { template: 'muscle'; muscle: string };

export type ExerciseCard = {
  template: 'exercise';
  /** The exercise id (slug); the name and cues come from i18n when drawn. */
  exerciseId: string;
  primary: string[];
  secondary: string[];
  /** The poster of the profile's own sex, when there is one (development builds). */
  poster: boolean;
};

export type AchievementCard = {
  template: 'achievement';
  kind: string;
  params: Record<string, string | number>;
  lit: LitMuscles;
};

export type WeekCard = {
  template: 'week';
  /** 7 days from the week start: trained or not. */
  days: boolean[];
  lit: LitMuscles;
  workouts: number;
};

export type MonthCard = {
  template: 'month';
  /** The month's standout muscle. */
  highlight: string | null;
  workouts: number;
  days: number;
  minutes: number;
  /** Sets per muscle over the month, for the lit map. */
  lit: LitMuscles;
  /** The month's name is formatted when drawn (e.g. "September"). */
  monthOf: string;
};

export type FunCard = {
  template: 'fun';
  /** Key of the equivalence (fun.ts) and how many of it. */
  thing: string;
  count: number;
};

export type CardData =
  WorkoutCard | MuscleCard | ExerciseCard | AchievementCard | WeekCard | MonthCard | FunCard;

/** What every card may carry besides its data. */
export type CardChrome = {
  background: ShareBackground;
  format: ShareFormat;
  mode: 'child' | 'teen' | 'adult' | 'senior';
  sex: 'f' | 'm';
  band: BodyBand;
  /** Only when the person turned on "Show my name" (never a minor). */
  name?: string | null;
  /** The short link shown in the footer (never for minors). */
  link?: string | null;
};
