import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { generateSession } from '@/features/generator';
import { dayName } from '@/features/program/block';
import { useTrainingDaysPerWeek } from '@/features/program/useTrainingDays';
import { plannedDaysBetween, workoutsOn } from '@/features/program/week';
import { doseLine, exerciseName } from '@/features/workout/format';
import { createWorkoutFrom, useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { restFor, usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart, localDate } from '@/lib/dates';
import { colors, spacing } from '@/theme';

/**
 * A day from the week strip (improvements v1, A1; mockup 10 layout): a past
 * day shows what was logged, a future day previews the session the plan
 * would build. Start is offered only today.
 */
export default function DayScreen() {
  const { t, i18n } = useTranslation();
  const prefs = usePrefsStore();
  const { date: param } = useLocalSearchParams<{ date: string }>();
  // Anything that isn't a YYYY-MM-DD date reads as today.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param ?? '') ? param : localDate(clock.now());
  const library = useExerciseLibrary();
  const workouts = useWorkoutStore((s) => s.workouts);
  const today = localDate(clock.now());
  const daysPerWeek = useTrainingDaysPerWeek();
  // A future day previews the plan day it will be (QA R4-08): every planned
  // day before it moves the plan on, today's too unless already trained.
  const trainedToday = workoutsOn(workouts, today, (iso) => localDate(new Date(iso))).some(
    (w) => w.kind === 'regular',
  );
  const ahead =
    date > today
      ? plannedDaysBetween(
          trainedToday ? addDays(today, 1) : today,
          date,
          deviceWeekStart(),
          daysPerWeek,
        ).length
      : 0;
  const input = useGeneratorInput(library, date > today ? { date, days: ahead } : undefined);
  const byId = new Map(library.map((e) => [e.id, e]));
  const past = date < today;
  const logged = workoutsOn(workouts, date, (iso) => localDate(new Date(iso)));
  const title = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  // A future day the plan keeps free is a rest day, not a workout (QA R5 P2).
  const restDay =
    date > today &&
    plannedDaysBetween(date, addDays(date, 1), deviceWeekStart(), daysPerWeek).length === 0;
  const preview =
    !past && !restDay && input
      ? generateSession({ ...input, today: date, now: `${date}T12:00:00` })
      : null;

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
      {restDay ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('day.restTitle')}</AppText>
          <AppText color={colors.mutedStrong}>{t('day.restBody')}</AppText>
        </Card>
      ) : null}
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
                  <AppText color={colors.mutedStrong}>{doseLine(t, i, restFor(i, prefs))}</AppText>
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
