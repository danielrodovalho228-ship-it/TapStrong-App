import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Card, Chip, Icon } from '@/components/ui';
import { normalizeEquipment } from '@/features/equipment/catalog';
import { demoPoster, demoSexFor } from '@/features/exercises/videos';
import { hasWeights, usePlanFilterStore } from '@/features/library/planFilter';
import type { MovementGroup } from '@/features/muscles';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { AppMode } from '@/features/profile/age';
import { REHAB_PROGRAMS } from '@/features/rehab/programs';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

import { findPlans, type PlanGoal, type ReadyPlan } from '../plans';
import { useProgramStore } from '../store';

const GROUPS: MovementGroup[] = ['push', 'pull', 'legs', 'core'];

/** One of our exercise posters per goal (no gym photos, no logos). */
export const GOAL_POSTER: Record<PlanGoal, string> = {
  shape: 'glute_bridge',
  muscle: 'wall_push_up',
  strength: 'bodyweight_squat',
  weightLoss: 'low_step_up',
  mobilityBalance: 'standing_supported_bird_dog',
  seniorSteady: 'sit_to_stand',
};
const REHAB_POSTER = 'pendulum_swing';

/** Rows by days a week: 60+ train fewer days. */
export const rowDays = (mode: AppMode) => (mode === 'senior' ? [2, 3, 4] : [3, 4, 5, 6]);

/** The plans of one row: one card per goal, filtered (Phase 31, F). */
export function rowPlans(
  mode: AppMode,
  days: number,
  opts: { noWeights: boolean; short: boolean; groups: MovementGroup[] },
): ReadyPlan[] {
  const seen = new Set<PlanGoal>();
  return findPlans(mode, {
    days,
    noWeights: opts.noWeights || undefined,
    maxMinutes: opts.short ? 30 : undefined,
  }).filter((p) => {
    if (seen.has(p.goal)) return false;
    if (
      opts.groups.length &&
      !p.days.some((d) => d.groups.some((g) => opts.groups.includes(g as MovementGroup)))
    )
      return false;
    seen.add(p.goal);
    return true;
  });
}

/** A poster in the profile's own sex, or a quiet panel. */
function Poster({ slug, height }: { slug: string; height: number }) {
  const colors = useColors();
  const styles = useStyles();
  const sex = useOnboardingStore((s) => demoSexFor(s));
  const poster = demoPoster(slug, sex);
  return (
    <View style={[styles.picture, { height }]} aria-hidden>
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
 * Library (Phase 31, F): filters for equipment, muscles and time, "My plan",
 * then rows of big plan cards by days a week with the goal on each, and the
 * care programs. No calories anywhere.
 */
export function PlansBrowser({ mode }: { mode: AppMode }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const activeId = useProgramStore((s) => s.planId);
  const profileEquipment = useOnboardingStore((s) => s.equipment);
  const f = usePlanFilterStore();
  const [musclesOpen, setMusclesOpen] = useState(false);
  const equipment = f.equipment ?? normalizeEquipment(profileEquipment);
  const opts = { noWeights: !hasWeights(equipment), short: f.short, groups: f.groups };

  const card = (p: ReadyPlan) => (
    <Pressable
      key={p.id}
      accessibilityRole="button"
      accessibilityLabel={`${t(`plans.goals.${p.goal}`)}, ${t(`plans.splits.${p.split}`)}, ${t('plans.meta', { days: p.daysPerWeek, minutes: p.minutes })}`}
      onPress={() => router.push({ pathname: '/program/[id]', params: { id: p.id } })}
      testID="plan-card"
    >
      <Card style={[styles.big, activeId === p.id && styles.active]}>
        <Poster slug={GOAL_POSTER[p.goal]} height={170} />
        <View style={styles.bigText}>
          <AppText variant="label" color={colors.accentText} style={styles.caps}>
            {t(`plans.labels.${p.goal}`)}
          </AppText>
          <AppText color={colors.mutedStrong} numberOfLines={2}>
            {[
              t(`plans.splits.${p.split}`),
              t('plans.meta', { days: p.daysPerWeek, minutes: p.minutes }),
            ].join(' · ')}
          </AppText>
          {activeId === p.id ? (
            <AppText variant="caption" color={colors.teal} style={styles.caps}>
              {t('plans.active')}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
      >
        <Chip
          label={t('plans.filters.equipmentCount', { count: equipment.length })}
          selected={f.equipment != null}
          onPress={() => router.push('/library-equipment')}
        />
        <Chip
          label={t('plans.filters.musclesCount', { count: f.groups.length })}
          selected={musclesOpen || f.groups.length > 0}
          onPress={() => setMusclesOpen((v) => !v)}
        />
        <Chip label={t('plans.filters.short')} selected={f.short} onPress={f.toggleShort} />
      </ScrollView>
      {musclesOpen ? (
        <View style={styles.wrapChips} testID="plan-muscles">
          {GROUPS.map((g) => (
            <Chip
              key={g}
              label={t(`plans.groups.${g}`)}
              selected={f.groups.includes(g)}
              onPress={() => f.toggleGroup(g)}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('plans.myPlan')}, ${t('plans.myPlanBody')}`}
        onPress={() => router.push({ pathname: '/program/[id]', params: { id: 'mine' } })}
      >
        <Card style={[styles.mine, !activeId && styles.active]}>
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

      {rowDays(mode).map((days) => {
        const plans = rowPlans(mode, days, opts);
        if (!plans.length) return null;
        return (
          <View key={days} style={styles.section} testID={`plan-row-${days}`}>
            <AppText variant="label" style={styles.caps} accessibilityRole="header">
              {t('plans.rowDays', { count: days })}
            </AppText>
            <ScrollView
              horizontal
              contentContainerStyle={styles.rowCards}
              showsHorizontalScrollIndicator={false}
            >
              {plans.map((p) => (
                <View key={p.id} style={styles.cardWidth}>
                  {card(p)}
                </View>
              ))}
            </ScrollView>
          </View>
        );
      })}

      {mode !== 'child' ? (
        <View style={styles.section}>
          <AppText variant="label" style={styles.caps} accessibilityRole="header">
            {t('plans.care')}
          </AppText>
          <ScrollView
            horizontal
            contentContainerStyle={styles.rowCards}
            showsHorizontalScrollIndicator={false}
          >
            {REHAB_PROGRAMS.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `rehab.programs.${p.id as 'shoulder_mobility_strength'}.title`,
                )}
                onPress={() => router.push({ pathname: '/rehab/[id]', params: { id: p.id } })}
                style={styles.cardWidth}
              >
                <Card style={styles.big} testID="care-card">
                  <Poster slug={REHAB_POSTER} height={170} />
                  <View style={styles.bigText}>
                    <AppText variant="label" color={colors.accentText} style={styles.caps}>
                      {t('plans.labels.shoulderRehab')}
                    </AppText>
                    <AppText color={colors.mutedStrong} numberOfLines={2}>
                      {t(`rehab.programs.${p.id as 'shoulder_mobility_strength'}.body`)}
                    </AppText>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  section: { gap: spacing.sm },
  mine: { gap: spacing.xs, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.card },
  active: { borderWidth: 1.5, borderColor: colors.teal },
  big: { padding: 0, overflow: 'hidden', gap: 0, borderRadius: radius.card },
  bigText: { padding: spacing.md, gap: spacing.xxs },
  cardWidth: { width: 248 },
  rowCards: { gap: spacing.sm, paddingRight: spacing.lg },
  picture: {
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
