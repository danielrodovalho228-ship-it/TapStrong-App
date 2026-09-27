import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen } from '@/components/ui';
import { planById } from '@/features/program/plans';
import { useProgramStore } from '@/features/program/store';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { colors, spacing } from '@/theme';

/**
 * A ready-made plan (A5, mockup 19 detail): the week layout, then "Use this
 * plan". The generator still picks the exercises safely. "My plan" (id
 * "mine") goes back to the coach's plan.
 */
export default function ProgramScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { planId, choosePlan } = useProgramStore();
  const [saved, setSaved] = useState(false);
  const plan = planById(id);
  const mine = id === 'mine' || !plan;
  const active = mine ? !planId : planId === plan?.id;

  const use = () => {
    choosePlan(mine ? null : plan!.id, localDate(clock.now()));
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
        active ? undefined : (
          <Button label={mine ? t('plans.useMine') : t('plans.use')} onPress={use} />
        )
      }
    >
      {mine ? (
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
      {saved || active ? <Notice>{t('plans.chosen')}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
