import { Redirect } from 'expo-router';

import { useOnboardingStore } from '@/features/onboarding/store';

export default function Index() {
  const complete = useOnboardingStore((s) => s.onboardingComplete);
  return <Redirect href={complete ? '/home' : '/welcome'} />;
}
