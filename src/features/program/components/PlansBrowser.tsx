import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Card, Chip } from '@/components/ui';
import type { AppMode } from '@/features/profile/age';
import { colors, fonts, radius, spacing } from '@/theme';

import {
  findPlans,
  type PlanFilter,
  type PlanGoal,
  type PlanSplit,
  type ReadyPlan,
} from '../plans';
import { useProgramStore } from '../store';

const GOALS: PlanGoal[] = [
  'shape',
  'muscle',
  'strength',
  'weightLoss',
  'mobilityBalance',
  'seniorSteady',
];
const SPLITS: PlanSplit[] = ['fullBody', 'upperLower', 'ppl'];
const DAYS = [2, 3, 4, 5, 6];

/**
 * Ready-made plans (improvements v1, A5; mockup 19 cards): "My plan" first,
 * then plans for this age mode with day, goal, split and length filters.
 */
export function PlansBrowser({ mode }: { mode: AppMode }) {
  const { t } = useTranslation();
  const activeId = useProgramStore((s) => s.planId);
  const [filter, setFilter] = useState<PlanFilter>({});
  const plans = findPlans(mode, filter);
  const goals = GOALS.filter((g) => findPlans(mode, { goal: g }).length);
  const toggle = <K extends keyof PlanFilter>(key: K, value: PlanFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));

  const card = (p: ReadyPlan) => (
    <Pressable
      key={p.id}
      accessibilityRole="button"
      accessibilityLabel={`${t(`plans.goals.${p.goal}`)}, ${t(`plans.splits.${p.split}`)}, ${t('plans.meta', { days: p.daysPerWeek, minutes: p.minutes })}`}
      onPress={() => router.push({ pathname: '/program/[id]', params: { id: p.id } })}
    >
      <Card style={[styles.card, activeId === p.id && styles.active]}>
        <View style={styles.row}>
          <AppText variant="bodyStrong" style={styles.flex}>
            {[t(`plans.goals.${p.goal}`), t(`plans.splits.${p.split}`)].join(' · ')}
          </AppText>
          {activeId === p.id ? (
            <AppText variant="caption" color={colors.teal} style={styles.caps}>
              {t('plans.active')}
            </AppText>
          ) : null}
        </View>
        <AppText color={colors.mutedStrong}>
          {t('plans.meta', { days: p.daysPerWeek, minutes: p.minutes })}
        </AppText>
      </Card>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('plans.myPlan')}, ${t('plans.myPlanBody')}`}
        onPress={() => router.push({ pathname: '/program/[id]', params: { id: 'mine' } })}
      >
        <Card style={[styles.card, !activeId && styles.active]}>
          <View style={styles.row}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {t('plans.myPlan')}
            </AppText>
            {!activeId ? (
              <AppText variant="caption" color={colors.teal} style={styles.caps}>
                {t('plans.active')}
              </AppText>
            ) : null}
          </View>
          <AppText color={colors.mutedStrong}>{t('plans.myPlanBody')}</AppText>
        </Card>
      </Pressable>

      <AppText variant="label" style={styles.caps}>
        {t('plans.filters.days')}
      </AppText>
      <ScrollView
        horizontal
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
      >
        {DAYS.map((d) => (
          <Chip
            key={d}
            label={t('plans.filters.daysValue', { count: d })}
            selected={filter.days === d}
            onPress={() => toggle('days', d)}
          />
        ))}
        <Chip
          label={t('plans.filters.short')}
          selected={filter.maxMinutes === 30}
          onPress={() => toggle('maxMinutes', 30)}
        />
      </ScrollView>
      <AppText variant="label" style={styles.caps}>
        {t('plans.filters.goal')}
      </AppText>
      <View style={styles.wrapChips}>
        {goals.map((g) => (
          <Chip
            key={g}
            label={t(`plans.goals.${g}`)}
            selected={filter.goal === g}
            onPress={() => toggle('goal', g)}
          />
        ))}
      </View>
      {mode !== 'senior' ? (
        <>
          <AppText variant="label" style={styles.caps}>
            {t('plans.filters.split')}
          </AppText>
          <View style={styles.wrapChips}>
            {SPLITS.map((sp) => (
              <Chip
                key={sp}
                label={t(`plans.splits.${sp}`)}
                selected={filter.split === sp}
                onPress={() => toggle('split', sp)}
              />
            ))}
          </View>
        </>
      ) : null}

      {plans.length ? (
        plans.map(card)
      ) : (
        <AppText color={colors.mutedStrong}>{t('plans.empty')}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.card,
  },
  active: { borderColor: colors.teal },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  chips: { gap: spacing.sm },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
