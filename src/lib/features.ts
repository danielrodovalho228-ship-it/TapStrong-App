/**
 * Feature switches (Phase 12, Daniel).
 *
 * KIDS_UNDER_13_ENABLED: children under 13 (COPPA) are OFF for launch. The
 * code, the parental-consent flow and their tests stay; with the switch off
 * the minimum age is 13 and nothing under-13 is shown. Turn it on for
 * version 2 (after the lawyer's review) with
 * EXPO_PUBLIC_KIDS_UNDER_13_ENABLED=true AND the database switch
 * (public.app_settings 'kids_under_13_enabled'), which create_child_profile
 * checks on its own.
 */
let kidsUnder13 = process.env.EXPO_PUBLIC_KIDS_UNDER_13_ENABLED === 'true';

export const kidsUnder13Enabled = () => kidsUnder13;

/** Tests only: run a suite with the switch on or off. */
export function setKidsUnder13Enabled(on: boolean) {
  kidsUnder13 = on;
}

/** Lowest age TapStrong accepts: 9 with kids on (SPEC §5), 13 for launch. */
export const KIDS_MIN_AGE = 9;
export const LAUNCH_MIN_AGE = 13;
export const minAge = () => (kidsUnder13 ? KIDS_MIN_AGE : LAUNCH_MIN_AGE);
