/**
 * The internal test build (Daniel, Oct 3): EAS profile "internal", for
 * TestFlight internal testing and Google Play internal testing only, never
 * the public stores. It carries the launch set as drafts and streams the
 * uploaded clips, so the app works end to end before the professional
 * review. Production builds never set EXPO_PUBLIC_APP_VARIANT.
 */
export const isInternalBuild = () => process.env.EXPO_PUBLIC_APP_VARIANT === 'internal';
