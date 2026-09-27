import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { generateSession } from '@/features/generator';
import { dayName } from '@/features/program/block';
import { workoutsOn } from '@/features/program/week';
import { doseLine, exerciseName } from '@/features/workout/format';
import { createWorkoutFrom, useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { colors, spacing } from '@/theme';

/**
 * A day from the week strip (improvements v1, A1; mockup 10 layout): a past
 * day shows what was logged, a future day previews the session the plan
 * would build. Start is offered only today.
 */
export default function DayScreen() {
  const { t, i18n } = useTranslation();
  const { date } = useLocalSearchParams<{ date: string }>();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const workouts = useWorkoutStore((s) => s.workouts);
  const byId = new Map(library.map((e) => [e.id, e]));
  const today = localDate(clock.now());
  const past = date < today;
  const logged = workoutsOn(workouts, date, (iso) => localDate(new Date(iso)));
  const title = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const preview =
    !past && input ? generateSession({ ...input, today: date, now: `${date}T12:00:00` }) : null;

  const start = () => {
    const id = createWorkoutFrom(input, library);
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });
  };

  const loggedCard = (w: WorkoutRecord) => {
    const main = w.session.items.filter((i) => i.role === 'main');
    return (
      <Card key={w.id} style={styles.card}>
        <AppText variant="h3">{t(`program.day.${dayName(w.session, library, w.kind)}`)}</AppText>
        {main.map((i) => {
          const sets = w.logs.filter((l) => l.itemId === i.id);
          if (!sets.length) return null;
          const best = sets.reduce((a, b) => ((b.load ?? 0) > (a.load ?? 0) ? b : a), sets[0]);
          return (
            <View key={i.id} style={styles.row}>
              <AppText style={styles.flex}>
                {exerciseName(t, byId.get(best.exerciseId), best.exerciseId)}
              </AppText>
              <AppText color={colors.mutedStrong}>
                {[
                  t('day.sets', { count: sets.length }),
                  best.load ? `${best.load} ${t(`workout.units.${best.unit ?? 'lb'}`)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          );
        })}
      </Card>
    );
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={title} />}
      footer={
        date === today && preview && !preview.error && !logged.length ? (
          <Button label={t('day.start')} onPress={start} />
        ) : undefined
      }
    >
      {logged.map(loggedCard)}
      {past && !logged.length ? <Notice>{t('day.nothing')}</Notice> : null}
      {!past && preview ? (
        preview.error ? (
          <Notice>
            {t(preview.error === 'all_recovering' ? 'home.recoveringBody' : 'day.noPreview')}
          </Notice>
        ) : (
          <Card style={styles.card}>
            <AppText variant="caption" color={colors.accent} style={styles.caps}>
              {t('day.preview')}
            </AppText>
            <AppText variant="h3">{t(`program.day.${dayName(preview, library)}`)}</AppText>
            {preview.items
              .filter((i) => i.role === 'main')
              .map((i) => (
                <View key={i.id} style={styles.row}>
                  <AppText style={styles.flex}>
                    {exerciseName(t, byId.get(i.exerciseId), i.exerciseId)}
                  </AppText>
                  <AppText color={colors.mutedStrong}>{doseLine(t, i)}</AppText>
                </View>
              ))}
          </Card>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
