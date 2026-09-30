import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card } from '@/components/ui';
import { demoPoster, demoSexFor, demoVideo, type DemoSex } from '@/features/exercises/videos';
import { useOnboardingStore } from '@/features/onboarding/store';
import { makeStyles, spacing, useColors } from '@/theme';

import { DemoLoop } from './Media';

/**
 * The exercise demo in the profile's own sex (Daniel, Phase 20). With no sex
 * and no body model yet (neutral body), it asks once and saves the answer as
 * the profile's body model, which Body → Body model can change later. A
 * missing clip shows the "demo coming soon" frame, never the other sex.
 */
export function ExerciseDemo({
  slug,
  unilateral = false,
  chips,
}: {
  slug: string;
  unilateral?: boolean;
  chips: { label: string; strong?: boolean }[];
}) {
  const sex = useOnboardingStore((s) => demoSexFor(s));
  if (!sex) return <DemoSexQuestion />;
  const video = demoVideo(slug, sex);
  return (
    <DemoLoop
      video={video}
      poster={demoPoster(slug, sex)}
      chips={chips}
      mirrorable={unilateral && !!video}
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
