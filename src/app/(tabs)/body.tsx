import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Chip, Icon, IconButton, Screen, TextLink } from '@/components/ui';
import { BodyMapCanvas } from '@/features/bodymap/components/BodyMapCanvas';
import { ViewToggle } from '@/features/bodymap/components/ViewToggle';
import { hotspotsFor, sideLabels } from '@/features/bodymap/hotspots';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { AREAS } from '@/features/library/browse';
import { canCreateExercise } from '@/features/library/custom';
import { useLibraryStore } from '@/features/library/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { track } from '@/lib/analytics';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * Exercises tab (Phase 31, E): the profile's own body (sex and age band) with
 * coral dots and the muscle names down both sides; a sideways swipe turns it
 * 180°. A muscle opens its exercises in a grid; favourites and search sit on
 * top.
 */
export default function ExercisesScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
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
  const senior = derived.mode === 'senior';
  const { left, right } = sideLabels(hotspotsFor(band, sex, s.bodyView));
  const coral = Object.fromEntries([...left, ...right].map((k) => [k, colors.accent]));

  const open = (key: string) => {
    track('bodymap_muscle_tapped', { mode: derived.mode });
    router.push({ pathname: '/muscle/[key]', params: { key } });
  };
  const label = (key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={t('explore.openMuscle', { muscle: muscleLabel(t, key) })}
      onPress={() => open(key)}
      style={styles.label}
      testID="side-label"
    >
      <AppText variant="caption" color={colors.mutedStrong} numberOfLines={2}>
        {muscleLabel(t, key)}
      </AppText>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.top}>
        <AppText variant="h1" accessibilityRole="header" style={styles.flex}>
          {t('explore.title')}
        </AppText>
        <IconButton
          icon="search"
          accessibilityLabel={t('explore.search')}
          onPress={() => router.push({ pathname: '/muscle/[key]', params: { key: 'all' } })}
        />
        <IconButton
          icon="star"
          accessibilityLabel={t('explore.favourites', { count: favourites.length })}
          onPress={() => router.push({ pathname: '/muscle/[key]', params: { key: 'favourites' } })}
        />
      </View>

      {/* A sideways swipe turns the body 180° (Phase 29, B10). */}
      <View style={styles.bodyRow} {...turn.panHandlers}>
        <View style={styles.side}>{left.map(label)}</View>
        <View style={styles.flex}>
          <BodyMapCanvas
            band={band}
            sex={sex}
            view={s.bodyView}
            selected={[]}
            recovery={coral}
            onToggle={open}
            maxHeight={Math.max(360, Math.min(560, screenHeight * 0.6))}
          />
        </View>
        <View style={styles.side}>{right.map(label)}</View>
      </View>
      <View style={styles.controls}>
        <View style={styles.hint}>
          <Icon name="rotate" size={16} color={colors.mutedStrong} />
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('explore.swipe')}
          </AppText>
        </View>
        <ViewToggle value={s.bodyView} onChange={(bodyView) => s.update({ bodyView })} inline />
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

      <View style={styles.shortcuts}>
        <Shortcut
          icon="star"
          label={t('explore.favourites', { count: favourites.length })}
          onPress={() => router.push({ pathname: '/muscle/[key]', params: { key: 'favourites' } })}
        />
        <Shortcut
          icon="search"
          label={t('explore.searchAll')}
          onPress={() => router.push({ pathname: '/muscle/[key]', params: { key: 'all' } })}
        />
      </View>
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

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: 'star' | 'search';
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.shortcut}
    >
      <Icon name={icon} size={20} color={colors.accentText} />
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <Icon name="chevron-right" color={colors.mutedStrong} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bodyRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.xs },
  side: { width: 76, justifyContent: 'space-around' },
  label: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  controls: { alignItems: 'center', gap: spacing.sm },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcuts: { gap: spacing.sm },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
}));
