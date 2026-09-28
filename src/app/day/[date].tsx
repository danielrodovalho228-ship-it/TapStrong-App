import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { generateBalanceSession, generateSession, MOBILITY_MINUTES } from '@/features/generator';
import { dayName } from '@/features/program/block';
import { useTrainingDaysPerWeek } from '@/features/program/useTrainingDays';
import { plannedDaysBetween, workoutsOn } from '@/features/program/week';
import { doseLine, exerciseName } from '@/features/workout/format';
import {
  createBalanceWorkout,
  createMobilityWorkout,
  createWorkoutFrom,
  useExerciseLibrary,
  useGeneratorInput,
} from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { WorkoutRecord } from '@/features/workout/types';
import { restFor, usePrefsStore } from '@/features/settings/store';
import { clock } from '@/lib/clock';
import { addDays, deviceWeekStart, localDate } from '@/lib/dates';
import { spacing, useColors } from '@/theme';

/**
 * A day from the week strip (improvements v1, A1; mockup 10 layout): a past
 * day shows what was logged, a future day previews the session the plan
 * would build. Start is offered only today.
 */
const validDate = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00`));

export default function DayScreen() {
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const prefs = usePrefsStore();
  const { date: param } = useLocalSearchParams<{ date: string }>();
  // Anything that isn't a YYYY-MM-DD date reads as today.
  const date = validDate(param) ? param : localDate(clock.now());
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
  // Stopped for sharp pain today: the same "take it easy" options as Home,
  // never a full workout preview (QA R6 P2).
  const easyDay = date === today && !!input?.stoppedToday?.length;
  const balanceOk = easyDay && !!input && !generateBalanceSession(input).error;
  const preview =
    !past && !restDay && !easyDay && input
      ? generateSession({ ...input, today: date, now: `${date}T12:00:00` })
      : null;

  const open = (id: string | null) =>
    router.push({ pathname: '/workout/[id]', params: { id: id ?? 'unavailable' } });

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

  // Not a date at all ("/day/not-a-date"): not found (QA R7 P2). The empty
  // or placeholder param of a pre-rendered page still reads as today.
  if (param && param !== '[date]' && !validDate(param)) {
    return (
      <Screen header={<Header onBack={() => router.back()} title={t('notFound.title')} />}>
        <Notice>{t('notFound.body')}</Notice>
      </Screen>
    );
  }

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
      {easyDay ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('home.stoppedTitle')}</AppText>
          <AppText color={colors.mutedStrong}>{t('home.stoppedBody')}</AppText>
          <Button
            variant="secondary"
            label={t('home.mobility', { minutes: MOBILITY_MINUTES })}
            onPress={() => open(createMobilityWorkout(input))}
          />
          {balanceOk ? (
            <Button
              variant="secondary"
              label={t('home.balance', { minutes: MOBILITY_MINUTES })}
              onPress={() => open(createBalanceWorkout(input))}
            />
          ) : null}
        </Card>
      ) : null}
      {!past && preview ? (
        preview.error ? (
          <Notice>
            {t(preview.error === 'all_recovering' ? 'home.recoveringBody' : 'day.noPreview')}
          </Notice>
        ) : (
          <Card style={styles.card}>
            <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
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
