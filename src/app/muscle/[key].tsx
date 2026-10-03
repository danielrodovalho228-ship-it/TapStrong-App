import { router, useLocalSearchParams } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Button, Header, IconButton, Screen, TextField } from '@/components/ui';
import { displayBand } from '@/features/bodymap/selection';
import type { Exercise } from '@/features/exercises/types';
import { AREAS, libraryView, type LibraryFilter } from '@/features/library/browse';
import { useLibraryStore } from '@/features/library/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { muscleByKey } from '@/features/muscles';
import { CardMedia } from '@/features/plan/PlanCards';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

const PAGE = 40;

/**
 * One muscle's exercises (Phase 31, E): a two-column grid with the picture,
 * the name and a star, and a search on top. Also "Favourites", "All" and the
 * 60+ areas. Only exercises safe for this profile are listed.
 */
export default function MuscleExercisesScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { key = 'all' } = useLocalSearchParams<{ key: string }>();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const profile = useOnboardingStore();
  const derived = derive(profile);
  const { favourites, toggleFavourite } = useLibraryStore();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [shown, setShown] = useState(PAGE);
  const senior = derived?.mode === 'senior';
  const band = displayBand(
    profile.bodyModel.band,
    derived?.band ?? 'adult',
    derived?.mode ?? 'adult',
  );

  const area = key.startsWith('area:') ? AREAS[key.slice(5)] : undefined;
  const filter: LibraryFilter =
    key === 'all' || key === 'favourites'
      ? {}
      : area
        ? { muscles: area }
        : muscleByKey(key)
          ? { muscle: key }
          : {};
  const name = (e: Exercise) => exerciseName(t, e, e.id);
  const safe = input ? libraryView(input, { ...filter, query: deferred }, name).safe : [];
  const list = key === 'favourites' ? safe.filter((e) => favourites.includes(e.id)) : safe;
  const title =
    key === 'all'
      ? t('explore.all')
      : key === 'favourites'
        ? t('explore.favouritesTitle')
        : area
          ? t(`library.areas.${key.slice(5) as 'arms'}`)
          : muscleLabel(t, key);

  return (
    <Screen header={<Header onBack={() => router.back()} title={title} />}>
      <TextField
        label={t('explore.searchIn', { name: title })}
        value={query}
        onChangeText={setQuery}
      />
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('library.count', { count: list.length })}
      </AppText>
      {list.length ? (
        <View style={styles.grid} testID="muscle-grid">
          {list.slice(0, shown).map((e) => {
            const starred = favourites.includes(e.id);
            return (
              <View
                key={e.id}
                style={[styles.card, senior ? styles.full : styles.half]}
                testID="muscle-card"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={name(e)}
                  testID={`muscle-open-${e.id}`}
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
                >
                  <CardMedia exercise={e} band={band} height={senior ? 180 : 132} still />
                  <AppText
                    variant={senior ? 'h3' : 'bodyStrong'}
                    numberOfLines={2}
                    style={styles.name}
                  >
                    {name(e)}
                  </AppText>
                </Pressable>
                <View style={styles.star}>
                  <IconButton
                    icon="star"
                    variant={starred ? 'filled' : 'outlined'}
                    accessibilityLabel={t(starred ? 'library.unfavourite' : 'library.favourite', {
                      name: name(e),
                    })}
                    onPress={() => toggleFavourite(e.id)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <AppText color={colors.mutedStrong} testID="muscle-empty">
          {key === 'favourites' && !query ? t('explore.noFavourites') : t('library.empty')}
        </AppText>
      )}
      {list.length > shown ? (
        <Button
          variant="secondary"
          label={t('library.showMore', {
            count: Math.min(PAGE, list.length - shown),
            total: list.length,
          })}
          onPress={() => setShown((n) => n + PAGE)}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface },
  half: { flexBasis: '48%', flexGrow: 1 },
  full: { flexBasis: '100%' },
  name: { padding: spacing.sm, paddingRight: spacing.xxl },
  star: { position: 'absolute', right: spacing.xxs, bottom: spacing.xxs },
}));
