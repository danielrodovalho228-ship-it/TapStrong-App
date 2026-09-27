import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import { loadReferralCode, referralLink } from '@/features/account/cloud';
import { useAccountStore } from '@/features/account/store';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { muscleByKey } from '@/features/muscles';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { CHECKIN_DAYS } from '@/features/progress/checkin';
import { rangeTotals, trainedMuscles, workoutMinutes } from '@/features/progress/stats';
import { mainSetCounts } from '@/features/workout/flow';
import { useBodyStates } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * Mockup 15 — share card: today's muscle map, streak and an invite link.
 * `range=4w` (from the 4-week check-in) shows the last 4 weeks instead.
 * Hidden in child mode (no social sharing under 13, SPEC §2.3). The card
 * shows the body map only — never photos, measurements or health details.
 */
export default function ShareScreen() {
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const account = useAccountStore();
  const { workouts, streak } = useWorkoutStore();
  const { states, library } = useBodyStates();
  const fourWeeks = useLocalSearchParams<{ range?: string }>().range === '4w';
  const card = useRef<View>(null);
  const [code, setCode] = useState<string | null>(account.referralCode ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (account.saved && !code) void loadReferralCode().then(setCode);
  }, [account.saved, code]);

  if (!derived || derived.mode === 'child') return <Redirect href="/home" />;

  const now = clock.now();
  const finished = workouts.filter((w) => w.status === 'done' || w.status === 'partial');
  const last = finished.at(-1);
  const month = rangeTotals(workouts, now, CHECKIN_DAYS);
  const stats = fourWeeks
    ? { workouts: month.workouts.length, minutes: month.minutes, sets: month.sets }
    : {
        workouts: finished.length,
        minutes: last ? workoutMinutes(last, now) : 0,
        sets: last ? mainSetCounts(last).done : 0,
      };
  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');
  // Muscles actually trained, most sets first — not catalog order (QA round 1).
  const trained = trainedMuscles(fourWeeks ? month.workouts : last ? [last] : [], library).filter(
    (k) => muscleByKey(k)?.views.length,
  );
  const names = (state: 'fresh' | 'recovering') =>
    trained
      .filter((k) => states[k] === state)
      .slice(0, 3)
      .map((k) => muscleLabel(t, k))
      .join(', ');
  const title = fourWeeks ? t('share.title4w') : t('share.title');
  const link = code ? referralLink(code) : null;

  const textSummary = [
    title,
    t('share.workouts', { count: stats.workouts }),
    t('workout.minutes', { value: stats.minutes }),
    t('share.sets', { count: stats.sets }),
    t('share.tagline'),
  ].join(' · ');

  const shareImage = async () => {
    setFailed(false);
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { captureRef } =
        require('react-native-view-shot') as typeof import('react-native-view-shot');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const uri = await captureRef(card, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title });
      track('share_card_shared', { target: 'image' });
    } catch {
      // No image sharing (web, some devices): share a short text instead (QA round 1).
      try {
        await Share.share({ message: textSummary });
        track('share_card_shared', { target: 'text' });
      } catch {
        setFailed(true);
      }
    }
  };

  const shareLink = async () => {
    if (!link) return;
    await Share.share({ message: t('share.inviteMessage', { link }) });
    track('share_card_shared', { target: 'link' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton
          icon="close"
          color={colors.dark.text}
          accessibilityLabel={t('common.close')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        />
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {title}
        </AppText>
        <View style={styles.spacer} />
      </View>

      <View style={styles.content}>
        <View ref={card} collapsable={false} style={styles.card} testID="share-card">
          <View style={styles.cardHead}>
            <View style={styles.flex}>
              <AppText variant="caption" color={colors.muted} style={styles.caps}>
                {t(fourWeeks ? 'share.eyebrow4w' : 'share.eyebrow', {
                  n: finished.length,
                  date: now.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }),
                })}
              </AppText>
              <AppText variant="h1">
                {fourWeeks ? t('share.cardTitle4w') : t('share.cardTitle')}
              </AppText>
            </View>
            <View style={styles.streak}>
              <AppText variant="h1" color={colors.accent}>
                {streakToday(streak, localDate(now), deviceWeekStart())}
              </AppText>
              <AppText variant="caption" color={colors.muted} style={styles.caps}>
                {t('home.dayStreak', {
                  count: streakToday(streak, localDate(now), deviceWeekStart()),
                })}
              </AppText>
            </View>
          </View>
          <RecoveryBody band={band} sex={sex} states={states} views="both" />
          <View style={styles.legend}>
            {names('fresh') ? <LegendRow color={STATE_COLOR.fresh} label={names('fresh')} /> : null}
            {names('recovering') ? (
              <LegendRow color={STATE_COLOR.recovering} label={names('recovering')} />
            ) : null}
          </View>
          <View style={styles.stats}>
            <AppText variant="bodyStrong">{t('share.workouts', { count: stats.workouts })}</AppText>
            <AppText variant="bodyStrong">{t('workout.minutes', { value: stats.minutes })}</AppText>
            <AppText variant="bodyStrong">{t('share.sets', { count: stats.sets })}</AppText>
          </View>
          <View style={styles.brand}>
            <AppText variant="h3">{t('app.name')}</AppText>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('share.tagline')}
            </AppText>
          </View>
        </View>

        <Button variant="accent" label={t('share.shareImage')} onPress={shareImage} />
        {link ? (
          <Button variant="onDark" label={t('share.shareLink')} onPress={shareLink} />
        ) : account.saved ? null : (
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.centerText}>
            {t('share.saveForLink')}
          </AppText>
        )}
        {failed ? (
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.centerText}>
            {t('share.failed')}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark.background },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  spacer: { width: 44 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  content: { flex: 1, padding: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.card * 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-end' },
  flex: { flex: 1 },
  streak: { alignItems: 'flex-end' },
  legend: { gap: spacing.xs },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerText: { textAlign: 'center' },
});
