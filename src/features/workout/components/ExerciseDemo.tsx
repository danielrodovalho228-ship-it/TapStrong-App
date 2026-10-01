import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { displayBand } from '@/features/bodymap/selection';
import type { ExerciseMuscle } from '@/features/exercises/types';
import { demoPoster, demoSexFor, demoVideo, type DemoSex } from '@/features/exercises/videos';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { makeStyles, spacing, useColors } from '@/theme';

import { DemoLoop } from './Media';

/**
 * The exercise demo in the profile's own sex (Daniel, Phase 20). With no sex
 * and no body model yet (neutral body), it asks once and saves the answer as
 * the profile's body model, which Body → Body model can change later. A
 * missing clip shows the body with the exercise's muscles lit and "Demo
 * coming soon" (Phase 29, A1), never the other sex.
 */
export function ExerciseDemo({
  slug,
  unilateral = false,
  chips,
  muscles = [],
}: {
  slug: string;
  unilateral?: boolean;
  chips: { label: string; strong?: boolean }[];
  /** The exercise's muscles: lit on the body when there is no clip yet. */
  muscles?: ExerciseMuscle[];
}) {
  const profile = useOnboardingStore();
  const sex = demoSexFor(profile);
  if (!sex) return <DemoSexQuestion />;
  const video = demoVideo(slug, sex);
  const derived = derive(profile);
  const band = displayBand(
    profile.bodyModel.band,
    derived?.band ?? 'adult',
    derived?.mode ?? 'adult',
  );
  return (
    <DemoLoop
      video={video}
      poster={demoPoster(slug, sex)}
      chips={chips}
      mirrorable={unilateral && !!video}
      muscles={{
        band,
        sex: profile.bodyModel.sex ?? sex,
        primary: muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey),
        secondary: muscles.filter((m) => m.role !== 'primary').map((m) => m.muscleKey),
      }}
    />
  );
}

function DemoSexQuestion() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const bodyModel = useOnboardingStore((s) => s.bodyModel);
  const update = useOnboardingStore((s) => s.update);
  const pick = (sex: DemoSex) => update({ bodyModel: { ...bodyModel, sex } });
  return (
    <Card style={styles.card} testID="demo-sex-question">
      <AppText variant="h3">{t('demoSex.question')}</AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button variant="secondary" label={t('demoSex.woman')} onPress={() => pick('f')} />
        </View>
        <View style={styles.flex}>
          <Button variant="secondary" label={t('demoSex.man')} onPress={() => pick('m')} />
        </View>
      </View>
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('demoSex.note')}
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 140 },
}));
