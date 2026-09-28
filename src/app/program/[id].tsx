import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { planAllowed, planById } from '@/features/program/plans';
import { useProgramStore } from '@/features/program/store';
import { discardPlannedWorkouts } from '@/features/workout/hooks';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { spacing, useColors } from '@/theme';

/**
 * A ready-made plan (A5, mockup 19 detail): the week layout, then "Use this
 * plan". The generator still picks the exercises safely. "My plan" (id
 * "mine") goes back to the coach's plan.
 */
export default function ProgramScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { planId, choosePlan } = useProgramStore();
  const [saved, setSaved] = useState(false);
  const mode = derive(useOnboardingStore())?.mode;
  const plan = planById(id);
  // An id that is neither "mine" nor a plan is "not found", never "Plan set" (QA R5 P2).
  const unknown = id !== 'mine' && !plan;
  const mine = id === 'mine';
  // Plans are offered per age mode; a deep link can't switch one on (QA R4-04).
  const blocked = !mine && !unknown && !planAllowed(plan, mode);
  const active = mine ? !planId : planId === plan?.id && !blocked;

  const use = () => {
    if (blocked || unknown) return;
    choosePlan(mine ? null : plan!.id, localDate(clock.now()));
    // Today's planned workout follows the new plan (QA R4-08).
    discardPlannedWorkouts();
    setSaved(true);
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          title={mine ? t('plans.myPlan') : `${t(`plans.goals.${plan!.goal}`)}`}
        />
      }
      footer={
        active || blocked || unknown ? undefined : (
          <Button label={mine ? t('plans.useMine') : t('plans.use')} onPress={use} />
        )
      }
    >
      {unknown ? (
        <Notice tone="warning">{t('plans.notFound')}</Notice>
      ) : blocked ? (
        <Notice tone="warning">{t('plans.notForYou')}</Notice>
      ) : mine ? (
        <AppText color={colors.mutedStrong}>{t('plans.myPlanBody')}</AppText>
      ) : (
        <>
          <AppText variant="h3">{t(`plans.splits.${plan!.split}`)}</AppText>
          <AppText color={colors.mutedStrong}>
            {t('plans.meta', { days: plan!.daysPerWeek, minutes: plan!.minutes })}
          </AppText>
          <AppText color={colors.mutedStrong}>
            {t('plans.weeks', { count: plan!.blockWeeks })}
          </AppText>
          <Card style={styles.card}>
            <AppText variant="label">{t('plans.schedule')}</AppText>
            {plan!.days.map((d, i) => (
              <View key={i} style={styles.row}>
                <AppText color={colors.muted}>{i + 1}</AppText>
                <AppText variant="bodyStrong">{t(`program.day.${d.name}`)}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}
      {!unknown && (saved || active) ? <Notice>{t('plans.chosen')}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
