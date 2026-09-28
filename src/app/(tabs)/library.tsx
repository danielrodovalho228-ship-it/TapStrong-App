import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  IconButton,
  Screen,
  SegmentedControl,
  TextField,
  TextLink,
} from '@/components/ui';
import { BodyPicker } from '@/features/bodymap/components/BodyPicker';
import type { Exercise } from '@/features/exercises/types';
import { libraryView, type LibraryFilter, type LibraryRole } from '@/features/library/browse';
import { canCreateExercise } from '@/features/library/custom';
import { useLibraryStore } from '@/features/library/store';
import { derive } from '@/features/onboarding/derived';
import { POSITIONS } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { PlansBrowser } from '@/features/program/components/PlansBrowser';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { ExerciseThumb } from '@/features/workout/components/Media';
import { colors, fonts, radius, spacing } from '@/theme';

const ROLES: LibraryRole[] = ['main', 'warmup', 'stretch', 'balance', 'repair'];
/** 60+ browse by area instead of the body map (simpler, big buttons). */
const AREAS: Record<string, string[]> = {
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  back: ['upperBack', 'lats', 'lowerBack'],
  chest: ['chest'],
  core: ['abs', 'obliques'],
};

/**
 * Library tab (improvements v1, B1–B2; mockups 08 + 10): browse by body with
 * the same dots, search and filters; only exercises safe for this profile are
 * listed, the rest sit in a collapsed "Not for you right now" with the reason.
 */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const mode = derive(useOnboardingStore())?.mode ?? 'adult';
  const senior = mode === 'senior';
  const { favourites, toggleFavourite } = useLibraryStore();
  const [segment, setSegment] = useState<'exercises' | 'plans'>('exercises');
  const [filter, setFilter] = useState<LibraryFilter>({});
  const [showOut, setShowOut] = useState(false);
  const name = (e: Exercise) => exerciseName(t, e, e.id);
  const view = input ? libraryView(input, filter, name) : { safe: [], notForYou: [] };
  // Only items some exercise actually uses (improvements v1, C).
  const equipment = [
    'none',
    ...(input?.equipment ?? []).filter((q) => library.some((e) => e.equipment.includes(q))),
  ];
  const set = <K extends keyof LibraryFilter>(key: K, value: LibraryFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));

  const card = (e: Exercise) => {
    const starred = favourites.includes(e.id);
    return (
      <Pressable
        key={e.id}
        accessibilityRole="button"
        accessibilityLabel={name(e)}
        onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.id } })}
        style={[styles.card, senior && styles.cardWide]}
      >
        <ExerciseThumb size={senior ? 64 : 48} />
        <AppText variant={senior ? 'h3' : 'bodyStrong'} style={styles.flex} numberOfLines={2}>
          {name(e)}
        </AppText>
        <IconButton
          icon="star"
          variant={starred ? 'filled' : 'outlined'}
          accessibilityLabel={t(starred ? 'library.unfavourite' : 'library.favourite', {
            name: name(e),
          })}
          onPress={() => toggleFavourite(e.id)}
        />
      </Pressable>
    );
  };

  return (
    <Screen>
      <AppText variant="h1" accessibilityRole="header">
        {t('library.title')}
      </AppText>
      <SegmentedControl
        accessibilityLabel={t('library.title')}
        value={segment}
        onChange={setSegment}
        options={[
          { value: 'exercises', label: t('library.exercises') },
          { value: 'plans', label: t('library.plans') },
        ]}
      />
      {segment === 'plans' ? (
        <PlansBrowser mode={mode} />
      ) : (
        <>
          <TextField
            label={t('library.search')}
            value={filter.query ?? ''}
            onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
          />
          {senior ? (
            <View style={styles.wrapChips}>
              {Object.entries(AREAS).map(([area, muscles]) => (
                <Chip
                  key={area}
                  label={t(`library.areas.${area as 'arms'}`)}
                  selected={filter.muscles?.join() === muscles.join()}
                  onPress={() =>
                    setFilter((f) => ({
                      ...f,
                      muscles: f.muscles?.join() === muscles.join() ? undefined : muscles,
                      role: undefined,
                    }))
                  }
                />
              ))}
              <Chip
                label={t('library.areas.balance')}
                selected={filter.role === 'balance'}
                onPress={() =>
                  setFilter((f) => ({
                    ...f,
                    muscles: undefined,
                    role: f.role === 'balance' ? undefined : 'balance',
                  }))
                }
              />
            </View>
          ) : (
            <>
              <BodyPicker
                selected={filter.muscle ? [filter.muscle] : []}
                onToggle={(k) => set('muscle', k)}
                maxHeight={360}
              />
              <AppText variant="caption" color={colors.mutedStrong}>
                {filter.muscle
                  ? t('library.muscle', { muscle: muscleLabel(t, filter.muscle) })
                  : t('library.tapDot')}
              </AppText>
              {filter.muscle ? (
                <TextLink
                  tone="accent"
                  label={t('library.clearMuscle')}
                  onPress={() => set('muscle', undefined)}
                />
              ) : null}
              <AppText variant="label" style={styles.caps}>
                {t('library.filters.equipment')}
              </AppText>
              <ScrollView
                horizontal
                contentContainerStyle={styles.chips}
                showsHorizontalScrollIndicator={false}
              >
                {equipment.map((q) => (
                  <Chip
                    key={q}
                    label={
                      q === 'none'
                        ? t('library.filters.bodyweight')
                        : t(`equipment.${q as 'bands'}`)
                    }
                    selected={filter.equipment === q}
                    onPress={() => set('equipment', q)}
                  />
                ))}
              </ScrollView>
              <AppText variant="label" style={styles.caps}>
                {t('library.filters.position')}
              </AppText>
              <View style={styles.wrapChips}>
                {POSITIONS.map((p) => (
                  <Chip
                    key={p}
                    label={t(`library.positions.${p}`)}
                    selected={filter.position === p}
                    onPress={() => set('position', p)}
                  />
                ))}
              </View>
              <AppText variant="label" style={styles.caps}>
                {t('library.filters.role')}
              </AppText>
              <View style={styles.wrapChips}>
                {ROLES.map((r) => (
                  <Chip
                    key={r}
                    label={t(`library.roles.${r}`)}
                    selected={filter.role === r}
                    onPress={() => set('role', r)}
                  />
                ))}
              </View>
            </>
          )}

          <AppText variant="label" style={styles.caps}>
            {t('library.count', { count: view.safe.length })}
          </AppText>
          {view.safe.length ? (
            <View style={styles.grid}>{view.safe.slice(0, 60).map(card)}</View>
          ) : (
            <AppText color={colors.mutedStrong}>{t('library.empty')}</AppText>
          )}

          {view.notForYou.length ? (
            <Card style={styles.out}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showOut }}
                onPress={() => setShowOut((v) => !v)}
              >
                <AppText variant="bodyStrong">
                  {showOut
                    ? t('library.hide')
                    : t('library.notForYou', { count: view.notForYou.length })}
                </AppText>
              </Pressable>
              {showOut
                ? view.notForYou.slice(0, 40).map(({ exercise, reason }) => (
                    <View key={exercise.id} style={styles.outRow}>
                      <AppText style={styles.flex}>{name(exercise)}</AppText>
                      <AppText variant="caption" color={colors.mutedStrong}>
                        {t(`library.reasons.${reason}`)}
                      </AppText>
                    </View>
                  ))
                : null}
            </Card>
          ) : null}

          {canCreateExercise(mode) ? (
            <Button
              variant="secondary"
              label={t('library.create')}
              onPress={() => router.push('/exercise/new')}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  chips: { gap: spacing.sm },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardWide: { flexBasis: '100%' },
  flex: { flex: 1 },
  out: { gap: spacing.sm },
  outRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
