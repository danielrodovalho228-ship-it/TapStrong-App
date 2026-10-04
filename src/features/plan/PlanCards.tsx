import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { MuscleAreaMap } from '@/features/bodymap/components/MuscleAreaMap';
import type { BodySex } from '@/features/bodymap/images';
import { demoPoster, demoSexFor, demoVideo } from '@/features/exercises/videos';
import type { Exercise } from '@/features/exercises/types';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { BodyBand } from '@/features/profile/age';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * The media of a plan card (Phase 31, B): the profile's own-sex clip playing
 * without sound, else its poster, else the body with the muscles lit and
 * "Demo coming soon". Never the other sex.
 */
export function CardMedia({
  exercise,
  band,
  height,
  still = false,
}: {
  exercise: Exercise | undefined;
  band: BodyBand;
  height: number;
  /** Poster only, no clip (long grids: one clip per card is too heavy). */
  still?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  const slug = exercise?.slug;
  const video = slug && !still ? demoVideo(slug, sex) : null;
  const poster = slug ? demoPoster(slug, sex) : null;
  if (video) {
    // Loaded lazily: only development builds and the preview have clips.
    const { DemoVideo } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/features/workout/components/DemoVideo') as typeof import('@/features/workout/components/DemoVideo');
    return (
      <View style={[styles.media, { height }]} testID="plan-card-video">
        <DemoVideo source={video} poster={poster} />
      </View>
    );
  }
  if (poster)
    return (
      <View style={[styles.media, { height }]}>
        <Image
          testID="plan-card-poster"
          source={typeof poster === 'string' ? { uri: poster } : poster}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          accessible={false}
        />
      </View>
    );
  const primary = exercise?.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey);
  const secondary = exercise?.muscles.filter((m) => m.role !== 'primary').map((m) => m.muscleKey);
  return (
    <View style={[styles.media, { height }]} testID="plan-card-map">
      {sex && exercise ? (
        <MuscleAreaMap
          band={band}
          sex={sex as BodySex}
          primary={primary ?? []}
          secondary={secondary ?? []}
          maxHeight={height - spacing.xl * 2 - sizes.touchTarget}
        />
      ) : (
        <Icon name="body" size={40} color={colors.onCanvasMuted} />
      )}
      <View style={styles.soon}>
        <Icon name="clock" size={14} color={colors.onCanvasMuted} />
        <AppText variant="caption" color={colors.onCanvasMuted}>
          {t('workout.demoSoon')}
        </AppText>
      </View>
    </View>
  );
}

/**
 * One exercise of the plan (Phase 31, B): a big card with the clip, the name
 * top left, swap top right and "5 sets × 10–12 reps × 35 lb" at the bottom
 * (the load only for adults).
 */
export function ExerciseCard({
  exercise,
  name,
  badge,
  band,
  trophy = false,
  onSwap,
  onOpen,
}: {
  exercise: Exercise | undefined;
  name: string;
  badge: string;
  band: BodyBand;
  /** Today's load is a new best: a trophy on the badge (adults only). */
  trophy?: boolean;
  onSwap?: () => void;
  onOpen?: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={`${name}. ${badge}`}
      onPress={onOpen}
      style={styles.card}
      testID="plan-card"
    >
      <CardMedia exercise={exercise} band={band} height={260} />
      <View style={styles.top} pointerEvents="box-none">
        {/* The muscle avatar and the name on a dark strip (Phase 31, G). */}
        <View style={styles.pill}>
          <MuscleAvatar exercise={exercise} band={band} />
          <AppText
            variant="bodyStrong"
            color={colors.onSurfaceRaised}
            numberOfLines={2}
            style={styles.flex}
          >
            {name}
          </AppText>
        </View>
        {onSwap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.swap.open', { name })}
            onPress={onSwap}
            hitSlop={6}
            style={styles.swap}
            testID="plan-card-swap"
          >
            <Icon name="swap" size={20} color={colors.onSurfaceRaised} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.bottom} pointerEvents="none">
        <View style={styles.badge}>
          <AppText variant="bodyStrong" color={colors.onSurfaceRaised} testID="plan-card-badge">
            {badge}
          </AppText>
          {trophy ? (
            <View testID="plan-card-trophy" accessibilityLabel={t('plan.goalTrophy')} accessible>
              <Icon name="trophy" size={18} color={colors.accentOnRaised} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** A small round body with the exercise's main muscles lit (Phase 31, G). */
function MuscleAvatar({ exercise, band }: { exercise: Exercise | undefined; band: BodyBand }) {
  const styles = useStyles();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  if (!exercise || !sex) return null;
  return (
    <View style={styles.avatar} aria-hidden>
      <MuscleAreaMap
        band={band}
        sex={sex as BodySex}
        primary={exercise.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey)}
        secondary={[]}
        views={['front']}
        maxHeight={40}
      />
    </View>
  );
}

/** Warm-up or final stretch (Phase 31, B): a low card with a thumbnail. */
export function PhaseCard({
  exercise,
  title,
  detail,
  onOpen,
  onSwap,
  testID,
}: {
  exercise: Exercise | undefined;
  title: string;
  detail: string;
  onOpen?: () => void;
  /** The compact plan list (Phase 31, F): swap from the row. */
  onSwap?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  const poster = exercise ? demoPoster(exercise.slug, sex) : null;
  return (
    <Pressable
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onOpen}
      style={styles.phase}
      testID={testID}
    >
      <View style={styles.thumb}>
        {poster ? (
          <Image
            source={typeof poster === 'string' ? { uri: poster } : poster}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            accessible={false}
          />
        ) : (
          <Icon name="body" size={22} color={colors.onCanvasMuted} />
        )}
      </View>
      <View style={styles.phaseText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {detail}
        </AppText>
      </View>
      {onSwap ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.swap.open', { name: title })}
          onPress={onSwap}
          hitSlop={6}
          style={styles.swap}
          testID="plan-card-swap"
        >
          <Icon name="swap" size={20} color={colors.onSurfaceRaised} />
        </Pressable>
      ) : onOpen ? (
        <Icon name="chevron-right" color={colors.mutedStrong} />
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  media: {
    width: '100%',
    backgroundColor: colors.bodyCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Under the body, never on it (Phase 32 B6), and clear of the dose badge.
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    marginBottom: sizes.touchTarget,
  },
  top: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // Text sits on a raised pill, never straight on the clip.
  pill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: sizes.touchTarget / 2,
    backgroundColor: colors.surfaceRaised,
  },
  flex: { flexShrink: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bodyCanvas,
  },
  swap: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  bottom: { position: 'absolute', left: spacing.sm, bottom: spacing.sm, right: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    minHeight: 64,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.chip,
    overflow: 'hidden',
    backgroundColor: colors.bodyCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: { flex: 1, gap: spacing.xxs },
}));
