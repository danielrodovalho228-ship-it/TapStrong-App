/**
 * PostHog (product events, SPEC §10) and Sentry (crashes). Both stay off
 * until their public keys are set in `.env`, so development and tests send
 * nothing.
 *
 * Privacy rules:
 * - Events carry only the small typed property set in analytics.ts. Never
 *   health details, measurements, photos, names or emails.
 * - No autocapture, no session replay, no person profiles, no GeoIP.
 * - Nothing at all is sent from a child profile (under 13, COPPA).
 * - Sentry never sends default PII; the user and request fields are dropped.
 */
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';

import { setAnalyticsSink, type AnalyticsEvent } from './analytics';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** True while a child profile is open: nothing is tracked then. */
export const isChildProfile = () => derive(useOnboardingStore.getState())?.mode === 'child';

let started = false;
let sentry: typeof import('@sentry/react-native') | null = null;
const reported = new Set<string>();

/**
 * A server table or function the app needs is missing (a migration not yet
 * pushed, security round 1 / Phase 23): logged once per name to Sentry, with
 * no user data. Development and tests only log to the console.
 */
export function reportServerMissing(name: string) {
  if (reported.has(name)) return;
  reported.add(name);
  if (sentry) sentry.captureMessage(`server_missing:${name}`, 'error');
  else if (__DEV__ && process.env.NODE_ENV !== 'test')
    console.warn(`TapStrong server is missing ${name}: run supabase db push`);
}

export function startMonitoring() {
  if (started) return;
  started = true;

  if (SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    sentry = Sentry;
    Sentry.init({
      dsn: SENTRY_DSN,
      sendDefaultPii: false,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0,
      beforeSend(event) {
        delete event.user;
        delete event.request;
        return event;
      },
      beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : crumb),
    });
  }

  if (POSTHOG_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
    const posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      personProfiles: 'never',
      disableGeoip: true,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
    });
    setAnalyticsSink((event: AnalyticsEvent, props) => {
      if (isChildProfile()) return;
      posthog.capture(event, props ? { ...props } : undefined);
    });
  }
}
