import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Image } from 'expo-image';

import { AppText, Card, Chip, Icon } from '@/components/ui';
import { demoPoster, demoSexFor } from '@/features/exercises/videos';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { AppMode } from '@/features/profile/age';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

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

/** One of our exercise posters per goal (no gym photos, no logos). */
export const GOAL_POSTER: Record<PlanGoal, string> = {
  shape: 'glute_bridge',
  muscle: 'wall_push_up',
  strength: 'bodyweight_squat',
  weightLoss: 'low_step_up',
  mobilityBalance: 'standing_supported_bird_dog',
  seniorSteady: 'sit_to_stand',
};

/** The plan's picture: the poster in the profile's sex, or a quiet panel. */
function PlanPicture({ goal }: { goal: PlanGoal }) {
  const colors = useColors();
  const styles = useStyles();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  const poster = demoPoster(GOAL_POSTER[goal], sex);
  return (
    <View style={styles.picture} aria-hidden>
      {poster ? (
        <Image
          source={typeof poster === 'string' ? { uri: poster } : poster}
          style={styles.pictureImage}
          contentFit="cover"
          contentPosition="top"
        />
      ) : (
        <Icon name="body" size={40} color={colors.onCanvasMuted} />
      )}
    </View>
  );
}

/**
 * Ready-made plans (improvements v1, A5; mockup 19 cards): "My plan" first,
 * then plans for this age mode with day, goal, split and length filters.
 */
export function PlansBrowser({ mode }: { mode: AppMode }) {
  const colors = useColors();
  const styles = useStyles();
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
      {/* Large card with our own poster and the goal (Phase 29, B8). */}
      <Card
        style={[styles.card, styles.big, activeId === p.id && styles.active]}
        testID="plan-card"
      >
        <PlanPicture goal={p.goal} />
        <View style={styles.bigText}>
          <View style={styles.row}>
            <AppText variant="h3" style={styles.flex}>
              {t(`plans.goals.${p.goal}`)}
            </AppText>
            {activeId === p.id ? (
              <AppText variant="caption" color={colors.teal} style={styles.caps}>
                {t('plans.active')}
              </AppText>
            ) : null}
          </View>
          <AppText color={colors.mutedStrong}>
            {[
              t(`plans.splits.${p.split}`),
              t('plans.meta', { days: p.daysPerWeek, minutes: p.minutes }),
            ].join(' · ')}
          </AppText>
        </View>
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

      <AppText variant="label" style={styles.caps}>
        {t('plans.filters.equipment')}
      </AppText>
      <View style={styles.wrapChips}>
        <Chip
          label={t('plans.filters.noWeights')}
          selected={!!filter.noWeights}
          onPress={() => toggle('noWeights', true)}
        />
      </View>
      <AppText variant="label" style={styles.caps}>
        {t('plans.filters.muscles')}
      </AppText>
      <View style={styles.wrapChips}>
        {(['push', 'pull', 'legs', 'core'] as const).map((g) => (
          <Chip
            key={g}
            label={t(`plans.groups.${g}`)}
            selected={filter.muscleGroup === g}
            onPress={() => toggle('muscleGroup', g)}
          />
        ))}
      </View>

      {plans.length ? (
        plans.map(card)
      ) : (
        <AppText color={colors.mutedStrong}>{t('plans.empty')}</AppText>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.sm },
  card: {
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.card,
  },
  active: { borderColor: colors.teal },
  big: { padding: 0, overflow: 'hidden', gap: 0 },
  bigText: { padding: spacing.md, gap: spacing.xxs },
  picture: {
    height: 150,
    backgroundColor: colors.bodyCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pictureImage: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  chips: { gap: spacing.sm },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
