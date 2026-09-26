import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen, TextLink } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { MUSCLES } from '@/features/muscles';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import {
  createWorkoutFrom,
  useBodyStates,
  useExerciseLibrary,
  useGeneratorInput,
} from '@/features/workout/hooks';
import type { RecoveryState } from '@/features/workout/recovery';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { colors, fonts, spacing } from '@/theme';

const LEGEND: Exclude<RecoveryState, 'neutral'>[] = ['fresh', 'recovering', 'almost', 'neglected'];

/** Mockup 07 — home: today's workout, streak, recovery map (SPEC §9). */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const { workouts, streak } = useWorkoutStore();
  const { states } = useBodyStates();
  if (!profile.onboardingComplete || !derived) return <Redirect href="/welcome" />;

  const now = clock.now();
  const active = workouts.find((w) => w.status === 'active');
  const planned = workouts.find((w) => w.status === 'planned');
  const goals = profile.muscleGoals.slice(0, 2).map((g) => muscleLabel(t, g.muscleKey));
  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');

  const openWorkout = () => {
    const existing = active ?? planned;
    if (existing) {
      router.push({ pathname: '/workout/[id]', params: { id: existing.id } });
      return;
    }
    const id = createWorkoutFrom(input, library);
    if (id) track('workout_generated', { mode: derived.mode });
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };

  const byState = (state: RecoveryState) =>
    MUSCLES.filter((m) => m.views.length && states[m.key] === state)
      .slice(0, 3)
      .map((m) => muscleLabel(t, m.key))
      .join(', ');
  const legend = LEGEND.map((s) => ({ state: s, muscles: byState(s) })).filter((l) => l.muscles);

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.muted} style={styles.caps}>
            {now.toLocaleDateString(i18n.language, { weekday: 'long' })}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {t('home.title')}
          </AppText>
        </View>
        <View style={styles.streak}>
          <AppText variant="h1">{streakToday(streak, localDate(now))}</AppText>
          <AppText variant="caption" color={colors.muted} style={styles.caps}>
            {t('home.dayStreak')}
          </AppText>
        </View>
      </View>

      <Card tone="dark" style={styles.today}>
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {active ? t('home.inProgress') : t('home.picked')}
        </AppText>
        <AppText variant="h1" color={colors.dark.text}>
          {goals.length ? goals.join(' & ') : t('home.fullBody')}
        </AppText>
        <AppText color={colors.dark.text}>
          {t('home.withWarmup', { minutes: profile.minutes ?? 30 })}
        </AppText>
        <Button
          variant="accent"
          label={active ? t('home.continue') : t('home.start', { minutes: profile.minutes ?? 30 })}
          onPress={openWorkout}
        />
        <Button variant="onDark" label={t('home.pickElse')} onPress={() => router.push('/body')} />
      </Card>

      <Card style={styles.recovery}>
        <View style={styles.bodyCol}>
          <RecoveryBody band={band} sex={sex} states={states} maxHeight={260} />
        </View>
        <View style={styles.legend}>
          <AppText variant="h3">{t('home.recoveryMap')}</AppText>
          {legend.length ? (
            legend.map((l) => (
              <LegendRow
                key={l.state}
                color={STATE_COLOR[l.state]}
                label={t(`home.recovery.${l.state}`, { muscles: l.muscles })}
              />
            ))
          ) : (
            <AppText color={colors.mutedStrong}>{t('home.recoveryEmpty')}</AppText>
          )}
          <AppText variant="caption" color={colors.muted}>
            {t('home.recoveryNote')}
          </AppText>
          <TextLink tone="accent" label={t('home.openBody')} onPress={() => router.push('/body')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: { alignItems: 'flex-end' },
  today: { gap: spacing.md, padding: spacing.xl },
  recovery: { flexDirection: 'row', gap: spacing.lg },
  bodyCol: { flex: 0.8 },
  legend: { flex: 1, gap: spacing.sm },
});
