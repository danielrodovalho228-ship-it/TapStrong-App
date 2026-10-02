import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useOnboardingStore } from '@/features/onboarding/store';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { useRehabRun } from './hooks';
import { useRehabStore } from './store';

/**
 * The care program's own card on Home (Phase 30 addendum §6.1), next to
 * "Today's workout": one doesn't replace the other, each has its progress.
 * On a gym day it says to do it before the workout, as a warm-up.
 */
export function CareHomeCards() {
  const runs = useRehabStore((s) => s.runs);
  return (
    <>
      {Object.keys(runs).map((id) => (
        <CareHomeCard key={id} programId={id} />
      ))}
    </>
  );
}

function CareHomeCard({ programId }: { programId: string }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const location = useOnboardingStore((s) => s.location);
  const { program, run, daily, dailyDone, dailyMinutes, suggestion, missing } =
    useRehabRun(programId);
  if (!program || !run || missing.length) return null;
  // Maintenance: only on its 2–3 days a week.
  if (!daily && !suggestion?.session) return null;
  const name = t(`rehab.short.${program.id as 'shoulder_mobility_strength'}`);
  const done = daily ? dailyDone : false;
  const detail = daily
    ? [t(`rehab.daily.blocks.${daily.block}`), t('rehab.daily.minutes', { count: dailyMinutes })]
    : [t(`rehab.sessions.${suggestion!.session!}.title`)];
  const title = done ? t('rehab.home.done', { name }) : t('rehab.home.title', { name });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail.join(', ')}`}
      onPress={() => router.push({ pathname: '/rehab/[id]', params: { id: program.id } })}
      style={styles.card}
      testID={`care-home-${program.id}`}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={colors.teal}>
          {title}
        </AppText>
        {!done ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {detail.join(' · ')}
          </AppText>
        ) : null}
        {!done && location === 'gym' && daily?.numbers.length ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('rehab.daily.gymHint')}
          </AppText>
        ) : null}
      </View>
      <Icon name={done ? 'check' : 'chevron-right'} color={colors.teal} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.tealTint,
  },
  flex: { flex: 1, gap: spacing.xs },
}));
