import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { MuscleAreaMap } from '@/features/bodymap/components/MuscleAreaMap';
import type { BodySex } from '@/features/bodymap/images';
import { demoPoster, demoSexFor, type DemoMedia } from '@/features/exercises/videos';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { BodyBand } from '@/features/profile/age';
import {
  bodyMapColors,
  colors,
  dotColors,
  fonts,
  makeStyles,
  radius,
  spacing,
  useColors,
} from '@/theme';

/**
 * Exercise media. Our own clips (assets/prototype) reach development builds
 * and the preview link only; release builds stay blocked by bundle:check
 * until Daniel releases them (SPEC §6). The thumb shows the poster of the
 * profile's own sex, when that sex has a clip.
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
          source={typeof poster === 'string' ? { uri: poster } : poster}
          style={styles.thumbImage}
          contentFit="cover"
          contentPosition="top"
        />
      ) : (
        // No clip yet: a quiet body icon, not an empty video frame (Phase 29, A3).
        <Icon name="body" size={size * 0.4} color={colors.onCanvasMuted} />
      )}
    </View>
  );
}

/** The preview link (vercel.json) shows our clips without the prototype badge (Phase 29, A2). */
export const DEMO_PREVIEW = process.env.EXPO_PUBLIC_DEMO_MEDIA === '1';

/** The media frame: 4:5, at most a third of the screen height (Phase 29, A2). */
export function demoFrameSize(window: { width: number; height: number }, gutter = spacing.md) {
  const available = Math.max(0, window.width - gutter * 2);
  const height = Math.floor(Math.min(window.height * 0.32, (available * 5) / 4));
  return { width: Math.floor(Math.min(available, (height * 4) / 5)), height };
}

/**
 * The exercise demo (Phase 29, A1–A2): the clip, its poster or the body with
 * the muscles lit, always inside the same 4:5 frame at the top, rounded and
 * `contain`, never behind the screen's text. No text sits on the media: the
 * muscle chips, the other-side switch and "Demo coming soon" go below it.
 * Only development builds show the small prototype badge, in a corner of
 * the frame; the preview link hides it.
 */
export function DemoLoop({
  chips,
  video = null,
  poster = null,
  mirrorable = false,
  muscles,
}: {
  chips: { label: string; strong?: boolean }[];
  /** The profile's own-sex clip in development builds; null shows the fallback. */
  video?: DemoMedia | null;
  /** The clip's starting image (same sex), shown until the first frame plays. */
  poster?: DemoMedia | null;
  /** One-sided move: the same clip mirrored shows the other side. */
  mirrorable?: boolean;
  /** No clip and no poster: the body with these muscles lit. */
  muscles?: { band: BodyBand; sex: BodySex; primary: string[]; secondary: string[] };
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const frame = demoFrameSize(window);
  const [mirrored, setMirrored] = useState(false);
  let media: ReactNode;
  if (video) {
    // Loaded lazily: only development builds ever have a clip to show.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DemoVideo } = require('./DemoVideo') as typeof import('./DemoVideo');
    media = <DemoVideo source={video} poster={poster} mirrored={mirrored} />;
  } else if (poster) {
    media = (
      <Image
        testID="demo-poster"
        source={typeof poster === 'string' ? { uri: poster } : poster}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessible={false}
      />
    );
  } else if (muscles) {
    media = (
      <View style={styles.mapFill}>
        <MuscleAreaMap
          band={muscles.band}
          sex={muscles.sex}
          primary={muscles.primary}
          secondary={muscles.secondary}
          maxHeight={frame.height - spacing.sm * 2}
          testID="demo-muscle-map"
        />
      </View>
    );
  } else {
    media = (
      <View style={[styles.mapFill, styles.center]} aria-hidden>
        <Icon name="play" size={40} color={colors.onCanvasMuted} />
      </View>
    );
  }
  const soon = !video && !poster;
  return (
    <View style={styles.demo} testID="demo">
      <View testID="demo-frame" style={[styles.frame, frame]}>
        {media}
      </View>
      {/* Nothing is written over the clip (Phase 31, D): the dev badge sits below. */}
      {video && __DEV__ && !DEMO_PREVIEW ? (
        <View style={styles.badge} pointerEvents="none" testID="demo-prototype-badge">
          <AppText variant="caption" color={colors.mutedStrong} style={styles.badgeText}>
            {t('workout.demoPrototype')}
          </AppText>
        </View>
      ) : null}
      {soon ? (
        <View style={styles.soon}>
          <Icon name="clock" size={16} color={colors.mutedStrong} />
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('workout.demoSoon')}
          </AppText>
        </View>
      ) : null}
      {chips.length || (mirrorable && video) ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <View
              key={c.label}
              style={[styles.chip, c.strong ? styles.chipStrong : styles.chipSoft]}
            >
              <AppText
                variant="caption"
                color={c.strong ? dotColors.untrained : colors.ink}
                style={styles.chipText}
              >
                {c.label}
              </AppText>
            </View>
          ))}
          {mirrorable && video ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mirrored }}
              onPress={() => setMirrored((m) => !m)}
              style={styles.sideButton}
            >
              <Icon name="swap" size={16} color={colors.ink} />
              <AppText variant="caption" color={colors.ink} style={styles.chipText}>
                {t('workout.otherSide')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  demo: { alignItems: 'center', gap: spacing.sm },
  frame: {
    backgroundColor: colors.bodyCanvas,
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },
  badge: { alignSelf: 'center' },
  badgeText: { letterSpacing: 0.6, textTransform: 'uppercase' },
  soon: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sideButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  chip: { borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipStrong: { backgroundColor: bodyMapColors.selected },
  chipSoft: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: fonts.headingSemi, letterSpacing: 0.8, textTransform: 'uppercase' },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
}));
