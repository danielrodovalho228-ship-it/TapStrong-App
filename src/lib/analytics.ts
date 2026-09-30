/**
 * Product analytics events — SPEC §10. PostHog is wired in monitoring.ts
 * (when its key is set); otherwise events are only logged in development.
 *
 * Never send health details, pain areas, conditions, measurements or photos.
 * Properties are limited to the small, non-sensitive set typed below.
 */

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'age_mode_set'
  | 'chat_completed'
  | 'safety_red_flag'
  | 'bodymap_muscle_tapped'
  | 'workout_generated'
  | 'workout_started'
  | 'set_logged'
  | 'exercise_swapped'
  | 'pain_reported'
  | 'workout_completed'
  | 'workout_ended_early'
  | 'share_card_shared'
  | 'account_created'
  | 'paywall_viewed'
  | 'trial_started'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'streak_milestone'
  | 'checkin_completed'
  | 'repair_test_completed'
  // Phase 26: the monthly cycle (choice: continue / repeat / body / auto).
  | 'month_closed'
  | 'month_chosen'
  | 'month_skipped'
  | 'month_undone'
  // Phase 27 "Measure": taps to the first set, install → first exercise,
  // day 7 / day 30 returns, and Moments shown / shared.
  | 'first_set_logged'
  | 'first_exercise_started'
  | 'app_returned'
  | 'moment_shown'
  | 'moment_shared'
  // Phase 28: sharing (the card's template, where it came from, where it went).
  | 'share_opened'
  | 'share_completed'
  | 'share_link_opened'
  | 'referral_signup';

type Props = {
  mode?: 'child' | 'teen' | 'adult' | 'senior';
  locale?: string;
  source?: 'coach' | 'chips' | 'button' | 'screenshot';
  template?: string;
  reason?: string;
  type?: string;
  target?: string;
  method?: string;
  /** Counts only: taps, a time bucket in seconds, a return day. */
  taps?: number;
  seconds?: number;
  day?: number;
  kind?: string;
};

type Sink = (event: AnalyticsEvent, props?: Props) => void;

let sink: Sink = (event, props) => {
  if (__DEV__ && process.env.NODE_ENV !== 'test') console.log('[analytics]', event, props ?? {});
};

export function track(event: AnalyticsEvent, props?: Props) {
  sink(event, props);
}

/** For tests and for the PostHog adapter (monitoring.ts). */
export function setAnalyticsSink(next: Sink) {
  sink = next;
}
