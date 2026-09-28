import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { restFor, usePrefsStore } from '@/features/settings/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { TimerRing, useNow } from '@/features/workout/components/TimerRing';
import { currentStep, mainItems } from '@/features/workout/flow';
import { clockText, exerciseName } from '@/features/workout/format';
import { useWorkout } from '@/features/workout/hooks';
import { adviceForItem, convertLoad } from '@/features/workout/loads';
import { pastSessions } from '@/features/workout/progression';
import { playTimerEnd } from '@/features/workout/sound';
import { useWorkoutStore } from '@/features/workout/store';
import type { SetLog } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

const EXTRA_SECONDS = 30;

/** Mockup 12 — rest between sets: timer, +30 s, skip, last-time comparison. */
export default function RestScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string; manual?: string }>();
  const { workout, byId, input } = useWorkout(id);
  const workouts = useWorkoutStore((s) => s.workouts);
  const units = useOnboardingStore((s) => s.units);
  const unit = units === 'imperial' ? 'lb' : 'kg';
  const [startedAt] = useState(() => clock.now().getTime());
  const [extra, setExtra] = useState(0);
  const now = useNow(250);

  const last = workout?.logs.at(-1);
  const lastItem = workout?.session.items.find((i) => i.id === last?.itemId);
  const next = workout ? currentStep(workout) : null;
  const restItem = lastItem?.role === 'main' ? lastItem : next?.item;
  // The rest default from Settings replaces the timer's starting value (D4).
  const prefs = usePrefsStore();
  const total = (restItem ? restFor(restItem, prefs) : 60) + extra;
  const elapsed = (now - startedAt) / 1000;
  const left = total - elapsed;

  // Time's up: back to the player, once.
  const left0 = left <= 0;
  const leaving = useRef(false);
  useEffect(() => {
    if (left0 && !leaving.current) {
      leaving.current = true;
      playTimerEnd();
      router.back();
    }
  }, [left0]);

  if (!workout) return null;

  const mains = mainItems(workout);
  const logText = (l: SetLog) =>
    [
      l.reps != null ? t('workout.rest.reps', { count: l.reps }) : null,
      l.seconds != null && l.reps == null ? t('workout.seconds', { value: l.seconds }) : null,
      // Shown in the person's unit, with the one rounding rule (QA R4 P2).
      l.load ? `${convertLoad(l.load, l.unit ?? 'lb', unit)} ${t(`workout.units.${unit}`)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const lastTime = last ? pastSessions(workouts, last.exerciseId, workout.id)[0] : undefined;
  const lastLoadOf = (exerciseId: string) => {
    const l = pastSessions(workouts, exerciseId, workout.id)[0]
      ?.logs.filter((x) => x.load)
      .at(-1);
    return l?.load ? convertLoad(l.load, l.unit ?? 'lb', unit) : null;
  };
  const lastTimeLog = lastTime?.logs.find((l) => l.setNo === last?.setNo) ?? lastTime?.logs.at(-1);
  const nextExercise = next ? byId.get(next.item.exerciseId) : undefined;
  // The same advice as the player (QA R5-02): one source, and only before
  // the exercise's first set, so a session never gets a second increase.
  const nextAdvice =
    next && next.setNo === 1 && input
      ? adviceForItem({
          workouts,
          workoutId: workout.id,
          item: next.item,
          exercise: nextExercise,
          unit,
          generator: { ...input, deload: workout.session.deload },
        })
      : null;
  const upStep =
    nextAdvice?.kind === 'load' && nextAdvice.change === 'up'
      ? nextAdvice.load - (lastLoadOf(next!.item.exerciseId) ?? nextAdvice.load)
      : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
          {lastItem && last
            ? t('workout.rest.eyebrow', {
                n: Math.max(1, mains.findIndex((i) => i.id === lastItem.id) + 1),
                total: mains.length,
                set: last.setNo,
              })
            : t('workout.rest.title')}
        </AppText>

        <View style={styles.center}>
          <TimerRing
            size={220}
            progress={elapsed / total}
            track={colors.mutedStrong}
            color={colors.dark.accent}
          >
            <AppText
              variant="display"
              color={colors.dark.text}
              accessibilityLabel={t('workout.player.timeLeft', { time: clockText(left) })}
            >
              {clockText(left)}
            </AppText>
            <AppText variant="caption" color={colors.dark.accentSoft}>
              {t('workout.rest.of', { total: clockText(total) })}
            </AppText>
          </TimerRing>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              variant="onDark"
              label={t('workout.rest.more')}
              onPress={() => setExtra(extra + EXTRA_SECONDS)}
            />
          </View>
          <View style={styles.flex}>
            <Button variant="accent" label={t('workout.rest.skip')} onPress={() => router.back()} />
          </View>
        </View>

        {last ? (
          <View style={styles.card}>
            <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
              {t('workout.rest.logged')}
            </AppText>
            <AppText variant="bodyStrong" color={colors.dark.text}>
              {logText(last)}
            </AppText>
            {lastTimeLog ? (
              <AppText variant="caption" color={colors.dark.accentSoft}>
                {t('workout.rest.lastSession', { value: logText(lastTimeLog) })}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {next ? (
          <View style={styles.card}>
            <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
              {t('workout.rest.upNext')}
            </AppText>
            <AppText variant="bodyStrong" color={colors.dark.text}>
              {exerciseName(t, nextExercise, next.item.exerciseId)}
              {next.item.sets > 1
                ? ` · ${t('workout.player.setOf', { n: next.setNo, total: next.item.sets })}`
                : ''}
            </AppText>
            {upStep > 0 ? (
              <AppText variant="caption" color={colors.dark.accentSoft}>
                {t('workout.rest.progressUp', {
                  step: `${upStep.toLocaleString(i18n.language)} ${t(`workout.units.${unit}`)}`,
                })}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.dark.background },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  center: { alignItems: 'center', paddingVertical: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: colors.mutedStrong,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.xs,
  },
}));
