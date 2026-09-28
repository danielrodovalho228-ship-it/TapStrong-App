import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { badgeStatus, VOLUME_STEPS, type BadgeKey } from '@/features/workout/badges';
import { repairPhaseDone } from '@/features/movement/progress';
import { useMovementPainStore } from '@/features/movement/store';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { MAX_FREEZES } from '@/features/workout/streak';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

const BADGE_ICON: Record<BadgeKey, IconName> = {
  first_workout: 'check',
  streak_7: 'flame',
  first_pr: 'arrow-right',
  full_body_week: 'body',
  streak_30: 'flame',
  streak_weeks_4: 'flame',
  streak_weeks_12: 'flame',
  streak_weeks_26: 'flame',
  streak_weeks_52: 'flame',
  volume_1: 'progress',
  volume_2: 'progress',
  volume_3: 'progress',
  repair_phase: 'shield',
  balance_30: 'body',
  workouts_100: 'check',
};

/** Mockup 24 — streak milestone and badges. */
export default function MilestoneScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { workouts, streak } = useWorkoutStore();
  const { milestone, update } = useAccountStore();
  const mode = derive(useOnboardingStore())?.mode ?? 'adult';
  const library = useExerciseLibrary();
  const now = clock.now();
  const days = milestone?.streak ?? streak.current;
  // A real milestone celebrates; the Badges link from Progress just lists them.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const celebrate = !!milestone || from !== 'badges';
  const member = useFamilyStore(activeProfile);
  const units = useOnboardingStore((s) => s.units);
  const reports = useMovementPainStore((s) => s.reports);
  const unit = units === 'imperial' ? 'lb' : 'kg';
  const badges = badgeStatus(workouts, streak, library, now, {
    mode,
    unit,
    repairPhaseDone: repairPhaseDone(reports),
    startsOn: deviceWeekStart(),
  });

  // The last 7 calendar days: active, rest (covered) or missed.
  const active = new Set(
    workouts
      .filter((w) => (w.status === 'done' || w.status === 'partial') && w.logs.length)
      .map((w) => localDate(new Date(w.endedAt ?? w.createdAt))),
  );
  const week = Array.from({ length: 7 }, (_, i) => addDays(localDate(now), i - 6));

  const close = () => {
    update({ milestone: null });
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {celebrate ? (
          <>
            <View style={styles.center}>
              <View style={styles.ringOuter}>
                <View style={styles.ring}>
                  <Icon name="flame" size={56} color={colors.onAccent} />
                </View>
              </View>
              <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
                {t('milestone.eyebrow')}
              </AppText>
              <AppText variant="display" color={colors.dark.text} accessibilityRole="header">
                {t('milestone.title', { count: days })}
              </AppText>
              <AppText color={colors.dark.text} style={styles.centerText}>
                {/* A deep link with a short streak is not "a full week" (QA round 2). */}
                {days < 7
                  ? t('milestone.bodyEarly', { count: 7 - days })
                  : streak.freezes > 0
                    ? t(streak.freezes >= MAX_FREEZES ? 'milestone.bodyMax' : 'milestone.body')
                    : t('milestone.bodyNoFreeze')}
              </AppText>
            </View>

            <View style={styles.week}>
              {week.map((d) => {
                const on = active.has(d);
                const label = new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, {
                  weekday: 'narrow',
                });
                return (
                  <View
                    key={d}
                    style={[styles.day, on ? styles.dayOn : styles.dayOff]}
                    accessible
                    accessibilityLabel={t(on ? 'milestone.dayActive' : 'milestone.dayRest', {
                      day: new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, {
                        weekday: 'long',
                      }),
                    })}
                  >
                    <AppText variant="button" color={on ? colors.onAccent : colors.dark.text}>
                      {label}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          // Opened from Progress → Badges: no stale "new milestone" (QA R4 P2).
          <AppText variant="h1" color={colors.dark.text} accessibilityRole="header">
            {t('progress.links.badges')}
          </AppText>
        )}

        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {t('milestone.badges')}
        </AppText>
        <View style={styles.grid}>
          {badges.map((b) => (
            <View key={b.key} style={styles.badge}>
              <View style={[styles.badgeIcon, b.earned ? styles.dayOn : styles.dayOff]}>
                <Icon
                  name={BADGE_ICON[b.key]}
                  size={24}
                  color={b.earned ? colors.onAccent : colors.dark.accentSoft}
                />
              </View>
              <AppText
                variant="bodyStrong"
                color={b.earned ? colors.dark.text : colors.dark.accentSoft}
                style={styles.centerText}
              >
                {t(`milestone.badge.${b.key}`, {
                  amount: b.key.startsWith('volume_')
                    ? VOLUME_STEPS[unit][Number(b.key.slice(-1)) - 1].toLocaleString(i18n.language)
                    : '',
                  unit: t(`workout.units.${unit}`),
                })}
              </AppText>
              {!b.earned && b.progress ? (
                <AppText variant="caption" color={colors.dark.accentSoft}>
                  {t('milestone.progress', {
                    done: b.progress[0].toLocaleString(i18n.language),
                    total: b.progress[1].toLocaleString(i18n.language),
                  })}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>

        {canShare(member, mode) ? (
          <Button
            variant="accent"
            label={t('milestone.share')}
            onPress={() => {
              update({ milestone: null });
              router.replace('/share');
            }}
          />
        ) : null}
        <Button variant="onDark" label={t('milestone.keepGoing')} onPress={close} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.dark.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.sm },
  ringOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    borderColor: colors.mutedStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  centerText: { textAlign: 'center' },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.mutedStrong,
  },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: colors.accent },
  dayOff: { backgroundColor: colors.dark.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.mutedStrong,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
