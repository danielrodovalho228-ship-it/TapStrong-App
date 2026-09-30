import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Header, Screen } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { useLibraryStore } from '@/features/library/store';
import { relockOffer } from '@/features/month/apply';
import { MonthSummaryView } from '@/features/month/components/MonthSummaryView';
import { NextMonthCard } from '@/features/month/components/NextMonthCard';
import { useMonthStore } from '@/features/month/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useProgressStore } from '@/features/progress/store';
import { openShare, useCanShare } from '@/features/share/open';
import { useScreenshotOffer } from '@/features/share/screenshot';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { spacing } from '@/theme';

/**
 * "Month closed" (Daniel, Phase 26): full screen once per block on the first
 * open after the lighter week, then a Home card for 7 days. One scrollable
 * page with "Skip" always visible; ends with "Your next month". With `?id=`
 * it shows a past month (Progress > Months), read-only.
 */
export default function MonthScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const workouts = useWorkoutStore((s) => s.workouts);
  const favourites = useLibraryStore((s) => s.favourites);
  const seniorPhotos = useProgressStore((s) => s.seniorPhotos);
  const repairPlan = useProgressStore((s) => s.repairPlan);
  const { offer, history, choose, dismissCard } = useMonthStore();
  const shareOk = useCanShare('month');
  const entry = id
    ? history.find((h) => h.id === id)
    : history.find((h) => h.id === offer?.entryId);
  // A screenshot of the summary offers "My month" (Phase 28, C).
  useScreenshotOffer(entry ? { template: 'month', month: entry.id } : null);
  if (!derived || !entry) return <Redirect href="/home" />;
  const pending = !id && !!offer;

  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');
  const now = clock.now();
  const retestDue = !!repairPlan && now.toISOString() >= repairPlan.retestAt;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const done = (choice: 'continue' | 'repeat') => {
    choose(choice, now);
    track('month_chosen', { type: choice });
    router.replace('/home');
  };

  return (
    <Screen
      header={
        <Header
          onBack={close}
          right={
            pending ? (
              // "Skip" is always there: the summary becomes a Home card (Phase 26, E).
              <Button
                variant="ghost"
                label={t('month.skip')}
                onPress={() => {
                  track('month_skipped');
                  close();
                }}
              />
            ) : undefined
          }
        />
      }
    >
      <View style={{ gap: spacing.md }}>
        <MonthSummaryView
          summary={entry.summary}
          mode={derived.mode}
          band={band}
          sex={sex}
          library={library}
          seniorPhotos={seniorPhotos}
          retestDue={pending && retestDue}
        />
        {shareOk ? (
          // "My month", the most beautiful card (Phase 28, B5).
          <Button
            variant="secondary"
            label={t('month.share')}
            onPress={() => openShare({ template: 'month', month: entry.id })}
          />
        ) : null}
        {pending && offer ? (
          <NextMonthCard
            offer={offer}
            library={library}
            onContinue={() => done('continue')}
            onRepeat={() => done('repeat')}
            onBody={() => {
              const focus = offer.focus.map((f) => f.muscle);
              // The recommended moves, with the person's own muscles from the body map.
              choose('body', now, []);
              dismissCard();
              track('month_chosen', { type: 'body' });
              router.replace({ pathname: '/body', params: { focus: focus.join(',') } });
            }}
            onLock={(locked) =>
              input &&
              relockOffer({
                workouts,
                library,
                generator: input,
                mode: derived.mode,
                favourites,
                locked,
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
