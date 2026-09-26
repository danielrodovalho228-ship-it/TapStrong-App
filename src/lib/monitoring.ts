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

export function startMonitoring() {
  if (started) return;
  started = true;

  if (SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
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
