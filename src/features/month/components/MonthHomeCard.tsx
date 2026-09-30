import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon, TextLink } from '@/components/ui';
import { clock } from '@/lib/clock';
import { makeStyles, radius, spacing, colors as tokens, useColors } from '@/theme';

import { stillBefore } from '../cycle';
import { useMonthStore } from '../store';

/**
 * Home (Phase 26, E): a skipped summary stays here for 7 days ("Your month
 * summary"); with fewer than 4 workouts, a light "Shall we pick it up
 * again?" instead. It replaces the old 4-week check-in card.
 */
export function MonthHomeCard({ onStart }: { onStart?: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const { offer, cardUntil, resumeUntil, dismissCard } = useMonthStore();
  const now = clock.now();
  if (offer && stillBefore(cardUntil, now))
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('month.homeCard')}
        onPress={() => router.push('/month')}
        style={styles.card}
        testID="month-home-card"
      >
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={colors.teal}>
            {t('month.homeCard')}
          </AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('month.homeCardBody')}
          </AppText>
        </View>
        <Icon name="chevron-right" color={colors.teal} />
      </Pressable>
    );
  if (stillBefore(resumeUntil, now))
    return (
      <View style={styles.card} testID="month-resume-card">
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={colors.teal}>
            {t('month.resumeCard')}
          </AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('month.resumeBody')}
          </AppText>
          <View style={styles.row}>
            {onStart ? <TextLink label={t('month.resumeStart')} onPress={onStart} /> : null}
            <TextLink label={t('month.dismiss')} onPress={dismissCard} />
          </View>
        </View>
      </View>
    );
  return null;
}

const useStyles = makeStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: tokens.tealTint,
  },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
}));
