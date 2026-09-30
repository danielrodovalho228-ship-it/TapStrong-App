import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { demoPoster, demoSexFor } from '@/features/exercises/videos';
import { useOnboardingStore } from '@/features/onboarding/store';
import {
  bodyMapColors,
  colors,
  dotColors,
  fonts,
  makeStyles,
  PALETTES,
  radius,
  spacing,
  useColors,
} from '@/theme';

/**
 * Exercise media placeholders. Production loops come from the licensed 3D
 * library (SPEC §6) and play through expo-video; until an exercise has
 * licensed media we show a neutral frame, never a prototype clip. In
 * development builds the thumb shows the prototype poster of the profile's
 * own sex, when that sex has a clip.
 */
export function ExerciseThumb({ size = 56, slug }: { size?: number; slug?: string }) {
  const colors = useColors();
  const styles = useStyles();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  const poster = slug ? demoPoster(slug, sex) : null;
  return (
    <View testID="exercise-thumb" style={[styles.thumb, { width: size, height: size }]} aria-hidden>
      {poster ? (
        <Image
          testID="exercise-thumb-poster"
          source={poster}
          style={styles.thumbImage}
          contentFit="cover"
          contentPosition="top"
        />
      ) : (
        <Icon name="play" size={size * 0.34} color={colors.onCanvasMuted} />
      )}
    </View>
  );
}

export function DemoLoop({
  chips,
  video = null,
  poster = null,
  mirrorable = false,
}: {
  chips: { label: string; strong?: boolean }[];
  /** The profile's own-sex clip in development builds; null shows the neutral frame. */
  video?: number | null;
  /** The clip's starting image (same sex), shown until the first frame plays. */
  poster?: number | null;
  /** One-sided move: the same clip mirrored shows the other side. */
  mirrorable?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const [mirrored, setMirrored] = useState(false);
  if (video) {
    // Loaded lazily: only development builds ever have a clip to show.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DemoVideo } = require('./DemoVideo') as typeof import('./DemoVideo');
    return (
      <View style={styles.demo}>
        <DemoVideo source={video} poster={poster} mirrored={mirrored} />
        <View style={styles.demoTop}>
          <AppText variant="caption" color={colors.onCanvasMuted} style={styles.demoLabel}>
            {t('workout.demoPrototype')}
          </AppText>
          {mirrorable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mirrored }}
              onPress={() => setMirrored((m) => !m)}
              style={styles.sideButton}
            >
              <AppText variant="caption" color={colors.onCanvas} style={styles.demoLabel}>
                {t('workout.otherSide')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chips}>
          {chips.map((c) => (
            <View
              key={c.label}
              style={[styles.chip, c.strong ? styles.chipStrong : styles.chipSoft]}
            >
              <AppText
                variant="caption"
                color={c.strong ? dotColors.untrained : colors.onCanvas}
                style={styles.chipText}
              >
                {c.label}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.demo}>
      <View style={styles.demoTop}>
        <AppText variant="caption" color={colors.onCanvasMuted} style={styles.demoLabel}>
          {t('workout.demoLoop')}
        </AppText>
      </View>
      <View style={styles.demoCenter} aria-hidden>
        <Icon name="play" size={40} color={colors.onCanvasMuted} />
      </View>
      <AppText variant="caption" color={colors.onCanvasMuted} style={styles.demoNote}>
        {t('workout.demoPending')}
      </AppText>
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c.label} style={[styles.chip, c.strong ? styles.chipStrong : styles.chipSoft]}>
            <AppText
              variant="caption"
              color={c.strong ? dotColors.untrained : colors.onCanvas}
              style={styles.chipText}
            >
              {c.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Small uppercase tag: target muscle on list rows (mockup 10). */
export function Tag({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'ink' | 'teal';
}) {
  const colors = useColors();
  const styles = useStyles();
  // Coral fills are for primary actions only (theme v2): the accent tag is a soft tint.
  const bg = tone === 'accent' ? colors.primarySoft : tone === 'teal' ? colors.teal : colors.ink;
  const fg = tone === 'accent' ? colors.accentText : tone === 'teal' ? colors.onTeal : colors.onInk;
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg} style={styles.chipText}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  thumb: {
    backgroundColor: colors.bodyCanvas,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  demo: {
    backgroundColor: colors.bodyCanvas,
    borderRadius: radius.card,
    minHeight: 220,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  demoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.bodyCanvas,
  },
  demoLabel: { fontFamily: fonts.headingSemi, letterSpacing: 1, textTransform: 'uppercase' },
  demoCenter: { alignItems: 'center', paddingVertical: spacing.lg },
  demoNote: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: { borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipStrong: { backgroundColor: bodyMapColors.selected },
  // The demo frame is the light body card in both modes.
  chipSoft: { backgroundColor: PALETTES.light.surface },
  chipText: { fontFamily: fonts.headingSemi, letterSpacing: 0.8, textTransform: 'uppercase' },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
}));
