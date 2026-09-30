import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AppText, Button, Chip, Header, Notice, Screen, Select } from '@/components/ui';
import { AreaChip } from '@/features/bodymap/components/AreaChip';
import { BodyMapCanvas } from '@/features/bodymap/components/BodyMapCanvas';
import type { BodySex, BodyView } from '@/features/bodymap/images';
import {
  allowedBands,
  displayBand,
  expandToHotspots,
  toggleMuscle,
} from '@/features/bodymap/selection';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { defaultMuscleGoal } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { muscleLabel } from '@/features/onboarding/summaries';
import { muscleByKey, muscleFamily } from '@/features/muscles';
import { recoveryFills } from '@/features/workout/components/RecoveryBody';
import { useBodyStates } from '@/features/workout/hooks';
import { track } from '@/lib/analytics';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/** Mockup 08 — Body map (SPEC §9 /(tabs)/body). */
export default function BodyMapScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const s = useOnboardingStore();
  const derived = derive(s);
  const { states } = useBodyStates();
  const member = useFamilyStore(activeProfile);
  // "Choose on the body" from the month summary (Phase 26): the suggested focus stands out.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const suggested = (focus ?? '').split(',').filter((m) => !!muscleByKey(m));

  // Goals set on a parent (e.g. "chest") in the interview apply to its parts.
  useEffect(() => {
    const expanded = expandToHotspots(s.muscleGoals);
    if (expanded.length !== s.muscleGoals.length) s.update({ muscleGoals: expanded });
  }, [s]);

  if (!derived) return <Redirect href="/onboarding/who" />;

  const band = displayBand(s.bodyModel.band, derived.band, derived.mode);
  const sex: BodySex = s.bodyModel.sex ?? (s.sex === 'f' ? 'f' : 'm');
  const selected = s.muscleGoals.map((m) => m.muscleKey);
  const minor = derived.mode === 'child' || derived.mode === 'teen';

  const toggle = (key: string) => {
    const adding = !selected.includes(key);
    s.update({ muscleGoals: toggleMuscle(s.muscleGoals, key, defaultMuscleGoal(s.mainGoals)) });
    if (adding) track('bodymap_muscle_tapped', { mode: derived.mode });
  };

  const openGoals = (muscle: string) => router.push({ pathname: '/goals', params: { muscle } });
  const suggestedFills = Object.fromEntries(
    suggested.flatMap((m) => [m, ...muscleFamily(m)]).map((k) => [k, colors.accent]),
  );
  const missing = suggested.filter(
    (m) => !selected.some((k) => k === m || muscleByKey(k)?.parentKey === m),
  );

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Header
            onBack={router.canGoBack() ? () => router.back() : undefined}
            title={t('bodyMap.title')}
          />
          <AppText variant="caption" color={colors.teal} style={styles.subtitle}>
            {/* A child or teen profile can't change its age: no "change anytime" (QA round 2). */}
            {member?.kind === 'child' ? t('bodyMap.subtitleLocked') : t('bodyMap.subtitle')}
          </AppText>
        </View>
      }
      footer={
        <Button
          label={t('bodyMap.setGoals')}
          disabled={!selected.length}
          onPress={() => openGoals(selected[0])}
        />
      }
    >
      <View style={styles.controls}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('bodyMap.bodyModel')}
          style={styles.row}
        >
          {(['m', 'f'] as const).map((value) => (
            <Chip
              key={value}
              label={
                minor
                  ? t(value === 'm' ? 'bodyMap.boy' : 'bodyMap.girl')
                  : t(value === 'm' ? 'bodyMap.male' : 'bodyMap.female')
              }
              selected={sex === value}
              onPress={() => s.update({ bodyModel: { ...s.bodyModel, sex: value } })}
            />
          ))}
        </View>
        <Select
          label={t('bodyMap.ageModel')}
          placeholder={t('bodyMap.ageModel')}
          value={band}
          onChange={(value) => s.update({ bodyModel: { ...s.bodyModel, band: value } })}
          options={allowedBands(derived.mode).map((b) => ({
            value: b,
            label: t('bodyMap.ageOption', { range: t(`bodyMap.bands.${b}`) }),
          }))}
        />
      </View>

      {missing.length ? (
        <Notice>
          <View style={styles.suggest}>
            <AppText>
              {t('month.bodyNote', {
                list: missing.map((m) => muscleLabel(t, m)).join(', '),
              })}
            </AppText>
            {missing.map((m) => (
              <Button
                key={m}
                variant="secondary"
                label={t('month.addFocus', { muscle: muscleLabel(t, m) })}
                onPress={() => toggle(m)}
              />
            ))}
          </View>
        </Notice>
      ) : null}

      <View>
        <BodyMapCanvas
          band={band}
          sex={sex}
          view={s.bodyView}
          selected={selected}
          recovery={{ ...recoveryFills(states), ...suggestedFills }}
          onToggle={toggle}
          maxHeight={Math.max(360, Math.min(560, screenHeight * 0.58))}
        />
        <ViewToggle value={s.bodyView} onChange={(bodyView) => s.update({ bodyView })} />
        {/* One stacked column so the two captions never overlap (QA round 1). */}
        <View style={styles.hints} pointerEvents="none">
          <AppText variant="caption" color={colors.onCanvasMuted}>
            {t('bodyMap.hint')}
          </AppText>
          <AppText variant="caption" color={colors.onCanvasMuted}>
            {t('bodyMap.zoomHint')}
          </AppText>
        </View>
      </View>

      <View style={styles.selectedHeader}>
        <AppText variant="label" style={styles.count}>
          {selected.length
            ? t('bodyMap.selectedCount', { count: selected.length })
            : t('bodyMap.none')}
        </AppText>
        {selected.length ? (
          <AppText variant="caption" color={colors.muted}>
            {t('bodyMap.chipHint')}
          </AppText>
        ) : null}
      </View>
      <View style={styles.chips}>
        {s.muscleGoals.map((m) => {
          const muscle = muscleLabel(t, m.muscleKey);
          const goal = t(`muscleGoals.${m.goal}`);
          return (
            <AreaChip
              key={m.muscleKey}
              muscle={muscle}
              goal={goal}
              separator={t('common.separator')}
              pressLabel={t('bodyMap.changeGoal', { muscle, goal })}
              removeLabel={t('bodyMap.removeArea', { muscle })}
              onPress={() => openGoals(m.muscleKey)}
              onRemove={() => toggle(m.muscleKey)}
            />
          );
        })}
      </View>
    </Screen>
  );
}

function ViewToggle({ value, onChange }: { value: BodyView; onChange: (v: BodyView) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('bodyMap.view')}
      style={styles.toggle}
    >
      {(['front', 'back'] as const).map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            // "Back view", not a second "Back" next to the header's back button (QA round 2).
            accessibilityLabel={t(`bodyMap.${v}View`)}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            onPress={() => onChange(v)}
            style={[styles.toggleItem, on && styles.toggleOn]}
          >
            <AppText variant="button" color={on ? colors.onInk : colors.mutedStrong}>
              {t(`bodyMap.${v}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  suggest: { gap: spacing.sm },
  header: { gap: 0 },
  subtitle: {
    marginLeft: sizes.touchTarget + spacing.lg + spacing.md,
    marginTop: -spacing.sm,
    fontFamily: fonts.bodySemi,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  toggleItem: {
    minHeight: sizes.touchTarget,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.ink },
  hints: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    maxWidth: 120,
    gap: spacing.sm,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  count: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
