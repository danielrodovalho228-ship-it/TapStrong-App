import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { repairPhaseDone } from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import type { AppMode } from '@/features/profile/age';
import { badgeStatus } from '@/features/workout/badges';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart } from '@/lib/dates';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

/**
 * "Achievements ›" (Phase 31, G): the three latest badges earned (or the
 * next ones to earn), personal only — no leaderboard.
 */
export function AchievementsCard({ mode, unit }: { mode: AppMode; unit: 'lb' | 'kg' }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { workouts, streak } = useWorkoutStore();
  const library = useExerciseLibrary();
  const reports = useMovementPainStore((s) => s.reports);
  const all = badgeStatus(workouts, streak, library, clock.now(), {
    mode,
    unit,
    repairPhaseDone: repairPhaseDone(reports),
    startsOn: deviceWeekStart(),
  });
  const earned = all.filter((b) => b.earned).reverse();
  const shown = (earned.length ? earned : all).slice(0, 3);
  const openAll = () => router.push({ pathname: '/milestone', params: { from: 'badges' } });

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('progress.links.badges')}
        onPress={openAll}
        style={styles.head}
      >
        <AppText variant="h2">{t('progress.achievements')}</AppText>
        <Icon name="chevron-right" color={colors.ink} />
      </Pressable>
      <View style={styles.panel} testID="achievements-card">
        <AppText variant="bodyStrong" color={colors.mutedStrong} style={styles.caps}>
          {earned.length ? t('progress.latestAchievements') : t('progress.nextAchievements')}
        </AppText>
        <View style={styles.row}>
          {shown.map((b) => (
            <View key={b.key} style={styles.badge} testID="achievement">
              <View style={[styles.shield, b.earned ? styles.shieldOn : styles.shieldOff]}>
                <Icon
                  name={b.key.startsWith('streak') ? 'flame' : 'trophy'}
                  size={30}
                  color={b.earned ? colors.onAccent : colors.muted}
                />
              </View>
              <AppText variant="bodyStrong" style={styles.center} numberOfLines={2}>
                {t(`milestone.badge.${b.key}`)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  panel: {
    gap: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.card * 2,
    backgroundColor: colors.sunken,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch' },
  badge: { flex: 1, alignItems: 'center', gap: spacing.sm },
  shield: {
    width: 76,
    height: 84,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  shieldOn: { backgroundColor: colors.accent, borderColor: colors.accentPressed },
  shieldOff: { backgroundColor: colors.surface, borderColor: colors.line },
  center: { textAlign: 'center' },
}));
