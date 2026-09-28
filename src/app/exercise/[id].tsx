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
import { BodyPicker } from '@/features/bodymap/components/BodyPicker';
import { prototypeVideo } from '@/features/exercises/library';
import { libraryView } from '@/features/library/browse';
import { exerciseRecords, visibleRecords } from '@/features/library/performance';
import { useLibraryStore } from '@/features/library/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { DemoLoop } from '@/features/workout/components/Media';
import { exerciseCues, exerciseName } from '@/features/workout/format';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { LoadUnit } from '@/features/workout/types';
import { colors, makeStyles, radius, spacing } from '@/theme';

/**
 * Exercise page (improvements v1, B3; mockups 11 + 18): Guidance (demo, cues,
 * common mistakes, muscles worked as body-map dots) and Performance (records,
 * best load by session, past sessions, private note).
 */
export default function ExerciseScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const unit: LoadUnit = profile.units === 'imperial' ? 'lb' : 'kg';
  const workouts = useWorkoutStore((s) => s.workouts);
  const { favourites, toggleFavourite, notes, setNote, removeCustom } = useLibraryStore();
  const [tab, setTab] = useState<'guidance' | 'performance'>('guidance');
  const e = library.find((x) => x.id === id);
  if (!e) {
    return (
      <Screen header={<Header onBack={() => router.back()} />}>
        <Notice>{t('library.empty')}</Notice>
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
          onBack={() => router.back()}
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
          {!e.custom ? <DemoLoop video={prototypeVideo(e.slug)} chips={[]} /> : null}
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
            <BodyPicker
              selected={primary}
              outlined={secondary}
              readOnly
              maxHeight={320}
              accessibilityLabel={[...primary, ...secondary]
                .map((m) => muscleLabel(t, m))
                .join(', ')}
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
                          best: s.bestLoad
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

const styles = makeStyles(() => ({
  card: { gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '30%', gap: spacing.xs },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 120 },
  bar: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.chip },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
}));
