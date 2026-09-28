import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { generateSession } from '@/features/generator';
import { muscleLabel } from '@/features/onboarding/summaries';
import { useProgressStore } from '@/features/progress/store';
import { PLAN_MINUTES } from '@/features/repair/tests';
import { useExerciseLibrary, useGeneratorInput } from '@/features/workout/hooks';
import { repairInput } from '@/features/workout/plan';
import { useWorkoutStore } from '@/features/workout/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { colors, fonts, makeStyles, spacing, useColors } from '@/theme';

/** The 6-week Repair plan built from the check (SPEC §9 /repair/plan). */
export default function RepairPlanScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const { repairPlan: plan, setRepairPlan } = useProgressStore();
  const library = useExerciseLibrary();
  const input = useGeneratorInput(library);
  const { workouts, create } = useWorkoutStore();
  if (!plan) return <Redirect href="/repair" />;

  const done = workouts.filter(
    (w) =>
      w.kind === 'repair' &&
      (w.status === 'done' || w.status === 'partial') &&
      (w.endedAt ?? '') >= plan.createdAt,
  ).length;
  const total = plan.weeks * plan.sessionsPerWeek;
  const retest = new Date(plan.retestAt).toLocaleDateString(i18n.language, {
    month: 'short',
    day: 'numeric',
  });
  const retestDue = clock.now().toISOString() >= plan.retestAt;

  const start = () => {
    if (!input) return;
    const session = generateSession(repairInput(input, plan.focus, PLAN_MINUTES));
    if (session.error) return;
    const id = create(session, 'repair');
    track('workout_generated');
    router.push({ pathname: '/workout/[id]', params: { id } });
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('repair.eyebrow')}
          title={t('repair.planTitle')}
        />
      }
      footer={
        <>
          <Button
            variant="accent"
            label={t('repair.startSession', { minutes: PLAN_MINUTES })}
            onPress={start}
            disabled={!input}
          />
          <Button
            variant="ghost"
            label={t('repair.endPlan')}
            onPress={() => {
              setRepairPlan(null);
              router.replace('/repair');
            }}
          />
        </>
      }
    >
      <AppText color={colors.mutedStrong}>
        {t('repair.planIntro', {
          weeks: plan.weeks,
          times: plan.sessionsPerWeek,
          minutes: PLAN_MINUTES,
        })}
      </AppText>
      <Card style={styles.card}>
        <AppText variant="caption" style={styles.caps}>
          {t('repair.focus')}
        </AppText>
        {plan.focus.map((f) => (
          <View key={f.muscleKey} style={styles.row}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {muscleLabel(t, f.muscleKey)}
            </AppText>
            <AppText variant="caption" color={colors.teal} style={styles.caps}>
              {t(`muscleGoals.${f.goal}`)}
            </AppText>
          </View>
        ))}
      </Card>
      <Card style={styles.card}>
        <AppText variant="h2">
          {t('repair.sessionsDone', { done: Math.min(done, total), total })}
        </AppText>
        <AppText color={colors.mutedStrong}>{t('repair.retestOn', { date: retest })}</AppText>
      </Card>
      {retestDue ? <Notice title={t('repair.retestTitle')}>{t('repair.retestBody')}</Notice> : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: fonts.headingSemi,
    color: colors.muted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
}));
