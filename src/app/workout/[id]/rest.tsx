import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, IconButton } from '@/components/ui';
import { restFor, usePrefsStore } from '@/features/settings/store';
import { TimerRing, useNow } from '@/features/workout/components/TimerRing';
import { currentStep } from '@/features/workout/flow';
import { clockText } from '@/features/workout/format';
import { feel } from '@/features/workout/feel';
import { useWorkout } from '@/features/workout/hooks';
import { playTimerEnd } from '@/features/workout/sound';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, sizes, spacing, useColors } from '@/theme';

const EXTRA_SECONDS = 15;
const SIZE = 300;

/**
 * Rest between sets (mockup 12; Phase 31, D and G): only a circle over the
 * set rows — "Tap to skip", "Rest: 1:30", the time left, −15 / +15 inside
 * the circle and a pencil for the rest time in Settings. It buzzes and
 * chimes at the end.
 */
export default function RestScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string; manual?: string }>();
  const { workout } = useWorkout(id);
  const [startedAt] = useState(() => clock.now().getTime());
  const [extra, setExtra] = useState(0);
  const now = useNow(250);

  const last = workout?.logs.at(-1);
  const lastItem = workout?.session.items.find((i) => i.id === last?.itemId);
  const next = workout ? currentStep(workout) : null;
  const restItem = lastItem?.role === 'main' ? lastItem : next?.item;
  // The rest default from Settings replaces the timer's starting value (D4).
  const prefs = usePrefsStore();
  const base = restItem ? restFor(restItem, prefs) : 60;
  const total = base + extra;
  const elapsed = (now - startedAt) / 1000;
  const left = total - elapsed;

  // Time's up: back to the player, once.
  const left0 = left <= 0;
  const leaving = useRef(false);
  useEffect(() => {
    if (left0 && !leaving.current) {
      leaving.current = true;
      feel.restEnd();
      playTimerEnd();
      router.back();
    }
  }, [left0]);

  // An unknown workout goes Home, like the player and done screens (QA R7 P2).
  if (!workout) return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.circle} testID="rest-overlay">
        <TimerRing size={SIZE} progress={elapsed / total} track={colors.line} color={colors.accent}>
          {/* Tap the circle to skip (Phase 29, B6). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.rest.skip')}
            onPress={() => router.back()}
            style={styles.inner}
            testID="rest-ring"
          >
            <AppText variant="bodyStrong" color={colors.accentText}>
              {t('workout.rest.tapToSkip')}
            </AppText>
            <AppText variant="bodyStrong">
              {t('workout.rest.ofTotal', { total: clockText(total) })}
            </AppText>
            <AppText
              variant="display"
              color={colors.accentText}
              style={styles.num}
              accessibilityLabel={t('workout.player.timeLeft', { time: clockText(left) })}
            >
              {clockText(left)}
            </AppText>
          </Pressable>
          <View style={[styles.side, styles.left]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.rest.less')}
              // Never below 15 s of rest in total.
              onPress={() => setExtra(Math.max(EXTRA_SECONDS - base, extra - EXTRA_SECONDS))}
              style={styles.small}
            >
              <AppText variant="bodyStrong">{t('workout.rest.lessShort')}</AppText>
            </Pressable>
          </View>
          <View style={[styles.side, styles.right]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.rest.more')}
              onPress={() => setExtra(extra + EXTRA_SECONDS)}
              style={styles.small}
            >
              <AppText variant="bodyStrong">{t('workout.rest.moreShort')}</AppText>
            </Pressable>
          </View>
          <View style={styles.pencil}>
            <IconButton
              icon="edit"
              accessibilityLabel={t('workout.rest.edit')}
              onPress={() => router.push('/settings/workout')}
            />
          </View>
        </TimerRing>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: SIZE + spacing.md,
    height: SIZE + spacing.md,
    borderRadius: (SIZE + spacing.md) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  inner: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xxxl },
  num: { fontVariant: ['tabular-nums'], fontFamily: fonts.heading },
  side: { position: 'absolute', top: SIZE / 2 - sizes.touchTarget / 2 },
  left: { left: spacing.md },
  right: { right: spacing.md },
  small: {
    width: sizes.touchTarget + spacing.xs,
    height: sizes.touchTarget + spacing.xs,
    borderRadius: (sizes.touchTarget + spacing.xs) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pencil: { position: 'absolute', bottom: spacing.lg, alignSelf: 'center' },
}));
