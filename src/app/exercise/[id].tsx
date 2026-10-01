import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Header,
  IconButton,
  Notice,
  Screen,
  SegmentedControl,
  TextField,
} from '@/components/ui';
import { MuscleAreaMap } from '@/features/bodymap/components/MuscleAreaMap';
import { displayBand } from '@/features/bodymap/selection';
import { libraryView } from '@/features/library/browse';
import { exerciseRecords, visibleRecords } from '@/features/library/performance';
import { useLibraryStore } from '@/features/library/store';
import { derive, modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { openShare, useCanShare } from '@/features/share/open';
import { useScreenshotOffer } from '@/features/share/screenshot';
import { muscleLabel } from '@/features/onboarding/summaries';
import { ExerciseDemo } from '@/features/workout/components/ExerciseDemo';
import { exerciseCues, exerciseName } from '@/features/workout/format';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { LoadUnit } from '@/features/workout/types';
import { backOrHome } from '@/lib/nav';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

/**
 * Exercise page (improvements v1, B3; mockups 11 + 18): Guidance (demo, cues,
 * common mistakes, muscles worked as body-map dots) and Performance (records,
 * best load by session, past sessions, private note).
 */
export default function ExerciseScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const profile = useOnboardingStore();
  const mode = modeOf(profile);
  const minor = mode === 'child' || mode === 'teen';
  const derived = derive(profile);
  const band = displayBand(profile.bodyModel.band, derived?.band ?? 'adult', mode);
  const unit: LoadUnit = profile.units === 'imperial' ? 'lb' : 'kg';
  const workouts = useWorkoutStore((s) => s.workouts);
  const { favourites, toggleFavourite, notes, setNote, removeCustom } = useLibraryStore();
  const [tab, setTab] = useState<'guidance' | 'performance'>('guidance');
  const shareOk = useCanShare('exercise');
  const e = library.find((x) => x.id === id);
  // A screenshot here offers the exercise sheet (Phase 28, C).
  useScreenshotOffer(e && !e.custom ? { template: 'exercise', exercise: e.id } : null);
  if (!e) {
    return (
      <Screen header={<Header onBack={backOrHome} />}>
        <Notice tone="neutral">{t('exercise.notFound')}</Notice>
        <Button variant="secondary" label={t('notFound.home')} onPress={backOrHome} />
      </Screen>
    );
  }
  const name = exerciseName(t, e, e.id);
  const starred = favourites.includes(e.id);
  const out = input
    ? libraryView(input, { query: undefined }, (x) => x.id).notForYou.find(
        (x) => x.exercise.id === e.id,
      )
    : undefined;
  const primary = e.muscles.filter((m) => m.role === 'primary').map((m) => m.muscleKey);
  const secondary = e.muscles.filter((m) => m.role === 'secondary').map((m) => m.muscleKey);
  const records = exerciseRecords(workouts, e.id, unit);
  const shown = visibleRecords(mode);
  const unitLabel = t(`workout.units.${unit}`);
  const maxLoad = Math.max(1, ...records.sessions.map((s) => s.bestLoad ?? 0));

  return (
    <Screen
      header={
        <Header
          onBack={backOrHome}
          title={name}
          right={
            <IconButton
              icon="star"
              variant={starred ? 'filled' : 'outlined'}
              accessibilityLabel={t(starred ? 'library.unfavourite' : 'library.favourite', {
                name,
              })}
              onPress={() => toggleFavourite(e.id)}
            />
          }
        />
      }
    >
      {e.custom ? <Notice tone="warning">{t('exercise.notReviewed')}</Notice> : null}
      {out ? (
        <Notice tone="warning">
          {t('exercise.notForYou', { reason: t(`library.reasons.${out.reason}`) })}
        </Notice>
      ) : null}
      <SegmentedControl
        accessibilityLabel={name}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'guidance', label: t('exercise.guidance') },
          { value: 'performance', label: t('exercise.performance') },
        ]}
      />
      {tab === 'guidance' ? (
        <>
          {!e.custom ? (
            <ExerciseDemo slug={e.slug} unilateral={e.unilateral} chips={[]} muscles={e.muscles} />
          ) : null}
          {!e.custom ? (
            <Card style={styles.card}>
              <AppText variant="h3">{t('exercise.cues')}</AppText>
              <AppText>{exerciseCues(t, e)}</AppText>
              <AppText variant="h3">{t('exercise.mistakes')}</AppText>
              <AppText color={colors.mutedStrong}>{t(`mistakes.${e.pattern}`)}</AppText>
            </Card>
          ) : null}
          <Card style={styles.card}>
            <AppText variant="h3">{t('exercise.worked')}</AppText>
            {/* Painted areas, front and back side by side (Phase 29, B3). */}
            <MuscleAreaMap
              band={band}
              sex={profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm')}
              primary={primary}
              secondary={secondary}
              maxHeight={300}
            />
            <AppText variant="caption">
              {t('exercise.labelled', {
                label: t('exercise.primary'),
                list: primary.map((m) => muscleLabel(t, m)).join(', '),
              })}
            </AppText>
            {secondary.length ? (
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('exercise.labelled', {
                  label: t('exercise.secondary'),
                  list: secondary.map((m) => muscleLabel(t, m)).join(', '),
                })}
              </AppText>
            ) : null}
          </Card>
          {!e.custom && shareOk ? (
            // "Save card": the exercise sheet to keep or send (Phase 28, B3).
            <Button
              variant="secondary"
              label={t('exercise.saveCard')}
              onPress={() => openShare({ template: 'exercise', exercise: e.id })}
            />
          ) : null}
          {e.custom ? (
            <Button
              variant="dangerText"
              label={t('exercise.delete')}
              onPress={() => {
                removeCustom(e.id);
                router.back();
              }}
            />
          ) : null}
        </>
      ) : (
        <>
          {shown.length ? (
            <View style={styles.tiles}>
              {shown.map((k) => {
                const value =
                  k === 'heaviest'
                    ? records.heaviest
                    : k === 'oneRepMax'
                      ? records.oneRepMax
                      : records.bestSetVolume;
                return (
                  <Card key={k} style={styles.tile}>
                    <AppText variant="h2">
                      {value != null ? `${value.toLocaleString(i18n.language)} ${unitLabel}` : '—'}
                    </AppText>
                    <AppText variant="caption" color={colors.mutedStrong}>
                      {t(k === 'bestSetVolume' ? 'exercise.bestSet' : `exercise.${k}`)}
                    </AppText>
                  </Card>
                );
              })}
            </View>
          ) : null}
          {records.sessions.length ? (
            <>
              {shown.length ? (
                <Card style={styles.card}>
                  <AppText variant="h3">{t('exercise.history')}</AppText>
                  <View style={styles.chart} accessibilityLabel={t('exercise.history')}>
                    {records.sessions.slice(-12).map((s) => (
                      <View
                        key={s.workoutId}
                        style={[
                          styles.bar,
                          { height: `${Math.max(6, ((s.bestLoad ?? 0) / maxLoad) * 100)}%` },
                        ]}
                      />
                    ))}
                  </View>
                </Card>
              ) : null}
              <Card style={styles.card}>
                <AppText variant="h3">{t('exercise.sessions')}</AppText>
                {[...records.sessions]
                  .reverse()
                  .slice(0, 20)
                  .map((s) => (
                    <View key={s.workoutId} style={styles.row}>
                      <AppText style={styles.flex}>
                        {new Date(s.date).toLocaleDateString(i18n.language, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </AppText>
                      <AppText color={colors.mutedStrong}>
                        {t('exercise.sessionLine', {
                          sets: s.sets,
                          // Minors see reps only, never a load (Phase 29, B3).
                          best:
                            s.bestLoad && !minor
                              ? `${s.bestLoad.toLocaleString(i18n.language)} ${unitLabel}`
                              : t('workout.rest.reps', { count: s.bestReps ?? 0 }),
                        })}
                      </AppText>
                    </View>
                  ))}
              </Card>
            </>
          ) : (
            <AppText color={colors.mutedStrong}>{t('exercise.noSessions')}</AppText>
          )}
          <TextField
            label={t('exercise.note')}
            placeholder={t('exercise.notePlaceholder')}
            value={notes[e.id] ?? ''}
            onChangeText={(v) => setNote(e.id, v)}
            multiline
          />
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '30%', gap: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 120 },
  bar: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.chip },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
}));
