import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen } from '@/components/ui';
import type { BodySex } from '@/features/bodymap/images';
import { displayBand } from '@/features/bodymap/selection';
import { generateSession } from '@/features/generator';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { LegendRow, RecoveryBody, STATE_COLOR } from '@/features/workout/components/RecoveryBody';
import { mainSetCounts } from '@/features/workout/flow';
import { useWorkout } from '@/features/workout/hooks';
import { finisherInput } from '@/features/workout/plan';
import {
  bodyStates,
  groupMuscles,
  muscleActivity,
  neglectedGroup,
} from '@/features/workout/recovery';
import { useWorkoutStore } from '@/features/workout/store';
import { streakToday } from '@/features/workout/streak';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { colors, fonts, radius, spacing } from '@/theme';

/** Mockup 14 — done: the body turns red, stats, a finisher suggestion. */
export default function DoneScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workout, library, input } = useWorkout(id);
  const profile = useOnboardingStore();
  const { workouts, streak, create, setNextFocus } = useWorkoutStore();
  const [focusSaved, setFocusSaved] = useState(false);
  const derived = derive(profile);
  if (!workout || !derived) return <Redirect href="/home" />;

  const now = clock.now();
  const finished = workouts.filter((w) => w.status === 'done' || w.status === 'partial');
  const number = finished.findIndex((w) => w.id === workout.id) + 1 || finished.length;
  const activity = muscleActivity(workouts, library, now);
  const group = neglectedGroup(activity, library, now);
  const groupList = group ? groupMuscles(group, library) : [];
  const groupNeverTrained = groupList.every((k) => !activity[k]?.lastPrimaryAt);
  const states = bodyStates(activity, now, derived.mode, [
    ...profile.muscleGoals.map((g) => g.muscleKey),
    ...groupList,
  ]);

  const band = displayBand(profile.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = profile.bodyModel.sex ?? (profile.sex === 'f' ? 'f' : 'm');

  const minutes = Math.max(
    1,
    Math.round(
      (Date.parse(workout.endedAt ?? now.toISOString()) -
        Date.parse(workout.startedAt ?? workout.createdAt)) /
        60000,
    ),
  );
  const { done: sets } = mainSetCounts(workout);
  const perMuscle = new Map<string, number>();
  for (const log of workout.logs) {
    const item = workout.session.items.find((i) => i.id === log.itemId);
    if (item?.role === 'main' && item.targetMuscle) {
      perMuscle.set(item.targetMuscle, (perMuscle.get(item.targetMuscle) ?? 0) + 1);
    }
  }
  const top = [...perMuscle.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];

  const addTen = () => {
    if (!input || !group) return;
    const session = generateSession(finisherInput(input, group, library));
    if (session.error) return;
    const newId = create(session, 'finisher');
    router.replace({ pathname: '/workout/[id]', params: { id: newId } });
  };

  const goHome = () => {
    router.dismissAll();
    router.replace('/home');
  };

  return (
    <Screen footer={<Button label={t('workout.done.home')} onPress={goHome} />}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.accent} style={styles.caps}>
            {t('workout.done.eyebrow', { n: number })}
          </AppText>
          <AppText variant="h1" accessibilityRole="header">
            {number === 1 ? t('workout.done.firstTitle') : t('workout.done.title')}
          </AppText>
        </View>
        <View style={styles.streak}>
          <View style={styles.flame}>
            <Icon name="flame" size={18} color={colors.onAccent} />
          </View>
          <AppText variant="button" color={colors.onAccent}>
            {t('workout.done.streak', { count: streakToday(streak, localDate(now)) })}
          </AppText>
        </View>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.bodyCol}>
          <RecoveryBody band={band} sex={sex} states={states} maxHeight={340} />
        </View>
        <View style={styles.legend}>
          <AppText variant="h3">{t('workout.bodyNow')}</AppText>
          <LegendRow color={STATE_COLOR.fresh} label={t('workout.legend.main')} />
          <LegendRow color={STATE_COLOR.recovering} label={t('workout.legend.also')} />
          <LegendRow color={STATE_COLOR.neglected} label={t('workout.legend.notYet')} />
          <AppText variant="caption" color={colors.muted}>
            {t(derived.mode === 'senior' ? 'workout.legend.fadeSenior' : 'workout.legend.fade')}
          </AppText>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={t('workout.minutes', { value: minutes })} label={t('workout.done.time')} />
        <Stat value={`${sets}`} label={t('workout.done.sets')} />
        {top ? <Stat value={`${top[1]}`} label={muscleLabel(t, top[0])} /> : null}
      </View>

      {group && input ? (
        <Card tone="dark" style={styles.finish}>
          <AppText variant="caption" color={colors.dark.accentSoft} style={styles.caps}>
            {t('workout.finish.eyebrow')}
          </AppText>
          <AppText color={colors.dark.text}>
            {t(groupNeverTrained ? 'workout.finish.never' : 'workout.finish.stale', {
              group: t(`workout.finish.groups.${group}`),
            })}
          </AppText>
          {focusSaved ? (
            <AppText variant="bodyStrong" color={colors.dark.accentSoft}>
              {t('workout.finish.saved', { group: t(`workout.finish.groups.${group}`) })}
            </AppText>
          ) : (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button variant="accent" label={t('workout.finish.addTen')} onPress={addTen} />
              </View>
              <View style={styles.flex}>
                <Button
                  variant="onDark"
                  label={t('workout.finish.nextTime', {
                    group: t(`workout.finish.short.${group}`),
                  })}
                  onPress={() => {
                    setNextFocus(group);
                    setFocusSaved(true);
                  }}
                />
              </View>
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="h2">{value}</AppText>
      <AppText variant="caption" color={colors.muted} style={styles.caps} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
  },
  flame: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyRow: { flexDirection: 'row', gap: spacing.lg },
  bodyCol: { flex: 1.1 },
  legend: { flex: 1, gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  finish: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
});
