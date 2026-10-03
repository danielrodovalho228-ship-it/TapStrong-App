import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { AppText, Button, Chip, Icon, IconButton, Screen, TextLink } from '@/components/ui';
import { FRAME, hotspotsFor } from '@/features/bodymap/hotspots';
import { bodyImage, type BodySex, type BodyView } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { AREAS } from '@/features/library/browse';
import { canCreateExercise } from '@/features/library/custom';
import { useLibraryStore } from '@/features/library/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { track } from '@/lib/analytics';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * One dot per muscle group on each side of the body (Phase 31, G): the
 * hotspot it sits on (and which of its points), the muscle a tap opens and
 * the side its name goes.
 */
type GroupDot = { hotspot: string; point: 0 | 1; open: string; side: 'left' | 'right' };
export const GROUP_DOTS: Record<BodyView, GroupDot[]> = {
  front: [
    { hotspot: 'shoulders', point: 0, open: 'shoulders', side: 'left' },
    { hotspot: 'midChest', point: 0, open: 'chest', side: 'left' },
    { hotspot: 'biceps', point: 1, open: 'biceps', side: 'right' },
    { hotspot: 'forearms', point: 0, open: 'forearms', side: 'left' },
    { hotspot: 'upperAbs', point: 0, open: 'abs', side: 'right' },
    { hotspot: 'obliques', point: 0, open: 'obliques', side: 'left' },
    { hotspot: 'quads', point: 0, open: 'quads', side: 'left' },
    { hotspot: 'adductors', point: 0, open: 'adductors', side: 'right' },
  ],
  back: [
    { hotspot: 'traps', point: 0, open: 'traps', side: 'right' },
    { hotspot: 'rearDelts', point: 0, open: 'rearDelts', side: 'left' },
    { hotspot: 'upperBack', point: 0, open: 'upperBack', side: 'right' },
    { hotspot: 'lats', point: 0, open: 'lats', side: 'left' },
    { hotspot: 'triceps', point: 1, open: 'triceps', side: 'right' },
    { hotspot: 'lowerBack', point: 0, open: 'lowerBack', side: 'right' },
    { hotspot: 'glutes', point: 0, open: 'glutes', side: 'left' },
    { hotspot: 'hamstrings', point: 1, open: 'hamstrings', side: 'right' },
    { hotspot: 'calves', point: 0, open: 'calves', side: 'left' },
  ],
};

const DOT = 18;

/**
 * Label heights on one side, top to bottom, at least `gap` apart and inside
 * `[gap / 2, height - gap / 2]`: each starts at its dot and only moves as far
 * as it must, so names never overlap.
 */
export function spreadLabels(ys: number[], gap: number, height: number): number[] {
  const out: number[] = [];
  ys.forEach((y, i) => out.push(Math.max(y, gap / 2, i ? out[i - 1] + gap : -Infinity)));
  for (let i = out.length - 1; i >= 0; i--) {
    const cap = i === out.length - 1 ? height - gap / 2 : out[i + 1] - gap;
    out[i] = Math.min(out[i], cap);
  }
  return out;
}

/**
 * Exercises tab (Phase 31, E and G): the profile's own body (sex and age
 * band) large, one coral dot per muscle group with a dotted line to its
 * name on the side, Cardio with a heart, search and favourites on top, and
 * "Swipe 180°" at the feet with the body-model and turn buttons. A group
 * opens its exercises in a grid.
 */
export default function ExercisesScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { width, height: screenHeight } = useWindowDimensions();
  const s = useOnboardingStore();
  const derived = derive(s);
  const favourites = useLibraryStore((st) => st.favourites);

  // Swipe sideways to turn the body 180° (Phase 29, B10).
  const [turn] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) <= 60) return;
        const store = useOnboardingStore.getState();
        store.update({ bodyView: store.bodyView === 'front' ? 'back' : 'front' });
      },
    }),
  );

  if (!derived) return <Redirect href="/onboarding/who" />;

  const band = displayBand(s.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = s.bodyModel.sex ?? (s.sex === 'f' ? 'f' : 'm');
  const view = s.bodyView;
  const senior = derived.mode === 'senior';
  const areaWidth = width - spacing.xl * 2;
  const areaHeight = Math.max(420, Math.min(620, screenHeight * 0.66));
  const imageHeight = Math.min(areaHeight, (areaWidth * FRAME.height) / FRAME.width);
  const imageWidth = (imageHeight * FRAME.width) / FRAME.height;
  const scale = imageWidth / FRAME.width;
  const left = (areaWidth - imageWidth) / 2;
  const spots = new Map(hotspotsFor(band, sex, view).map((h) => [h.key, h.points]));
  const placed = GROUP_DOTS[view].flatMap((g) => {
    const p = spots.get(g.hotspot)?.[g.point] ?? spots.get(g.hotspot)?.[0];
    return p ? [{ ...g, x: left + p[0] * scale, y: p[1] * scale }] : [];
  });
  // Names stack on each side without overlapping; Cardio keeps its slot on the right.
  const gap = senior ? 44 : 34;
  const pill = gap - 4;
  const slop = { top: (sizes.touchTarget - pill) / 2, bottom: (sizes.touchTarget - pill) / 2 };
  const cardioY = imageHeight * 0.12;
  const dots = (['left', 'right'] as const).flatMap((side) => {
    const group = placed.filter((d) => d.side === side).sort((a, b) => a.y - b.y);
    const fixed = side === 'right' && view === 'front' ? [cardioY] : [];
    const ys = spreadLabels([...fixed, ...group.map((d) => d.y)], gap, imageHeight);
    return group.map((d, i) => ({ ...d, labelY: ys[i + fixed.length] }));
  });

  const open = (key: string) => {
    track('bodymap_muscle_tapped', { mode: derived.mode });
    router.push({ pathname: '/muscle/[key]', params: { key } });
  };
  const turnAround = () => s.update({ bodyView: view === 'front' ? 'back' : 'front' });

  return (
    <Screen
      header={
        <View style={styles.top}>
          <AppText variant="h1" accessibilityRole="header" style={styles.flex}>
            {t('explore.title')}
          </AppText>
          <IconButton
            icon="star"
            accessibilityLabel={t('explore.favourites', { count: favourites.length })}
            onPress={() =>
              router.push({ pathname: '/muscle/[key]', params: { key: 'favourites' } })
            }
          />
        </View>
      }
    >
      <View style={styles.searchRow}>
        <IconButton
          icon="search"
          accessibilityLabel={t('explore.search')}
          onPress={() => router.push({ pathname: '/muscle/[key]', params: { key: 'all' } })}
        />
      </View>

      {/* A sideways swipe turns the body 180° (Phase 29, B10). */}
      <View
        style={{ width: areaWidth, height: imageHeight }}
        {...turn.panHandlers}
        testID="explore-body"
      >
        <Image
          source={bodyImage(band, sex, view)}
          style={{ position: 'absolute', left, top: 0, width: imageWidth, height: imageHeight }}
          contentFit="contain"
          accessible={false}
        />
        {/* Dotted leader lines from each name to its dot. */}
        <Svg width={areaWidth} height={imageHeight} style={styles.fill} pointerEvents="none">
          {dots.map((d) => (
            <Line
              key={d.hotspot}
              x1={d.side === 'left' ? 0 : areaWidth}
              y1={d.labelY}
              x2={d.x}
              y2={d.y}
              stroke={colors.mutedStrong}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ))}
          {dots.map((d) => (
            <Circle key={d.hotspot} cx={d.x} cy={d.y} r={DOT / 2} fill={colors.accent} />
          ))}
        </Svg>
        {view === 'front' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('explore.openMuscle', { muscle: t('explore.cardio') })}
            onPress={() => open('cardio')}
            style={[styles.label, styles.cardio, { top: cardioY - pill / 2, height: pill }]}
            hitSlop={slop}
            testID="explore-cardio"
          >
            <Icon name="heart" size={20} color={colors.accent} />
            <AppText variant="bodyStrong">{t('explore.cardio')}</AppText>
          </Pressable>
        ) : null}
        {dots.map((d) => {
          const name = muscleLabel(t, d.open);
          return (
            <View key={d.hotspot}>
              {/* The dot itself is a big touch target too (same action as its name). */}
              <Pressable
                accessible={false}
                onPress={() => open(d.open)}
                style={[
                  styles.dotHit,
                  { left: d.x - sizes.touchTarget / 2, top: d.y - sizes.touchTarget / 2 },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('explore.openMuscle', { muscle: name })}
                onPress={() => open(d.open)}
                style={[
                  styles.label,
                  d.side === 'left' ? { left: 0 } : { right: 0 },
                  { top: d.labelY - pill / 2, height: pill, maxWidth: areaWidth * 0.46 },
                ]}
                hitSlop={slop}
                testID="side-label"
              >
                <AppText variant={senior ? 'h3' : 'bodyStrong'} numberOfLines={1}>
                  {name}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.demoModel')}
          onPress={() =>
            router.push({ pathname: '/onboarding/chat', params: { step: 'body', edit: '1' } })
          }
          style={styles.round}
        >
          <Icon name="body" size={24} color={colors.mutedStrong} />
        </Pressable>
        <View style={styles.swipe}>
          <AppText variant="bodyStrong">{t('explore.swipeShort')}</AppText>
          <AppText variant="caption" color={colors.accentText}>
            {t('explore.swipeArrows')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bodyMap.rotate')}
          onPress={turnAround}
          style={styles.round}
          testID="body-rotate"
        >
          <Icon name="rotate" size={24} color={colors.mutedStrong} />
        </Pressable>
      </View>

      {senior ? (
        <View style={styles.wrap}>
          {Object.keys(AREAS).map((area) => (
            <Chip
              key={area}
              label={t(`library.areas.${area as 'arms'}`)}
              onPress={() =>
                router.push({ pathname: '/muscle/[key]', params: { key: `area:${area}` } })
              }
            />
          ))}
        </View>
      ) : null}

      <TextLink label={t('explore.goals')} onPress={() => router.push('/body-goals')} />
      {canCreateExercise(derived.mode) ? (
        <Button
          variant="secondary"
          label={t('library.create')}
          onPress={() => router.push('/exercise/new')}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.xs,
  },
  searchRow: { flexDirection: 'row', marginLeft: -spacing.sm },
  fill: { position: 'absolute', left: 0, top: 0 },
  // A dark pill so names stay readable over the light body picture.
  label: {
    position: 'absolute',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  cardio: { right: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dotHit: { position: 'absolute', width: sizes.touchTarget, height: sizes.touchTarget },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: {
    width: sizes.touchTarget + spacing.md,
    height: sizes.touchTarget + spacing.md,
    borderRadius: (sizes.touchTarget + spacing.md) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  swipe: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
