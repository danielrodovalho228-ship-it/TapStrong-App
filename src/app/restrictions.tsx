import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  Header,
  Icon,
  Notice,
  Screen,
  TextLink,
} from '@/components/ui';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { ParentGate } from '@/features/family/ParentGate';
import { MovementPainEntry } from '@/features/movement/Entry';
import { modeOf } from '@/features/onboarding/derived';
import { PAIN_AREAS, type PainArea } from '@/features/onboarding/options';
import { restrictionAreas } from '@/features/onboarding/safety';
import { useOnboardingStore } from '@/features/onboarding/store';
import { excludedCount, painSwaps } from '@/features/restrictions/impact';
import { useRestrictionsStore, type Restriction } from '@/features/restrictions/store';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import type { Side } from '@/features/workout/types';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

const AREAS = PAIN_AREAS.filter((a) => a !== 'recent_surgery');
const SIDED: PainArea[] = ['shoulder', 'elbow_wrist', 'hip', 'knee', 'ankle_foot'];

/** Mockup 20 — My restrictions: applied to every workout until changed. */
export default function RestrictionsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const painAreas = useOnboardingStore((s) => s.painAreas);
  const { items, add, setActive } = useRestrictionsStore();
  const workouts = useWorkoutStore((s) => s.workouts);
  const library = useExerciseLibrary();
  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState<PainArea | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [side, setSide] = useState<Side | 'both' | undefined>();
  // A teen or child removing a restriction needs a parent (QA R4 P2).
  // The account owner (even a solo 17-year-old) is never asked (QA R5 P2).
  const access = useOwnerAccess();
  const mode = modeOf(useOnboardingStore());
  const minor = access === 'gate' && ['teen', 'child'].includes(mode);
  const [gateFor, setGateFor] = useState<string | null>(null);
  const heal = (id: string) => {
    if (minor && gateFor !== id) return setGateFor(id);
    setGateFor(null);
    setActive(id, false);
  };

  const gate = gateFor ? (
    <ParentGate
      onPass={() => {
        setActive(gateFor, false);
        setGateFor(null);
      }}
      onCancel={() => setGateFor(null)}
    />
  ) : null;
  const active = items.filter((r) => r.active);
  const healed = items.filter((r) => !r.active);
  const fromHealthCheck = restrictionAreas(painAreas);

  const label = (r: Pick<Restriction, 'area' | 'side'>) =>
    r.side
      ? t('restrictions.withSide', {
          side: t(`restrictions.sides.${r.side}`),
          area: t(`safety.painAreas.${r.area}`),
        })
      : t(`safety.painAreas.${r.area}`);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });

  const impact = (a: string) => {
    const { excluded, total } = excludedCount(library, a);
    return t('restrictions.impact', { excluded, total });
  };

  const save = () => {
    if (!area) return;
    // A restriction without a side covers both sides of the area.
    const sided = SIDED.includes(area) && side !== 'both' ? side : undefined;
    add({ area, side: sided, source: 'manual' });
    setAdding(false);
    setArea(null);
    setSide(undefined);
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          title={t('restrictions.title')}
          eyebrow={t('restrictions.subtitle')}
        />
      }
      // The PIN takes the footer, so it is on screen for any item (QA R8 P2).
      footer={gate ?? <Button label={t('restrictions.done')} onPress={() => router.back()} />}
    >
      <MovementPainEntry />
      {active.map((r) => {
        const swaps = painSwaps(workouts, r.area);
        return (
          <Card key={r.id} style={styles.card}>
            <View style={styles.row}>
              <AppText variant="h3" style={styles.flex}>
                {label(r)}
              </AppText>
              <View
                style={[
                  styles.badge,
                  r.source === 'pain_report' || r.source === 'doctor'
                    ? styles.badgeAccent
                    : styles.badgeMuted,
                ]}
              >
                <AppText variant="caption" style={styles.caps}>
                  {r.source === 'doctor'
                    ? t('restrictions.sources.doctor')
                    : t(`restrictions.sources.${r.source}`, { date: date(r.createdAt) })}
                </AppText>
              </View>
            </View>
            <View style={styles.rule}>
              <Icon name="close" color={colors.accentText} size={18} />
              <AppText style={styles.flex}>{impact(r.area)}</AppText>
            </View>
            {swaps ? (
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('restrictions.swaps', { count: swaps })}
              </AppText>
            ) : null}
            {r.source === 'doctor' ? (
              <AppText variant="caption" color={colors.mutedStrong}>
                {t('restrictions.doctorNote')}
              </AppText>
            ) : null}
            {confirmId === r.id ? (
              <View style={styles.confirm}>
                <AppText variant="bodyStrong">{t('restrictions.clearedQ')}</AppText>
                <Button
                  variant="secondary"
                  label={t('restrictions.clearedYes')}
                  onPress={() => {
                    heal(r.id);
                    setConfirmId(null);
                  }}
                />
                <Button
                  variant="ghost"
                  label={t('restrictions.clearedNo')}
                  onPress={() => setConfirmId(null)}
                />
              </View>
            ) : (
              <TextLink
                label={t('restrictions.healed')}
                // A red-flag area needs an explicit "cleared by a doctor" (QA C-02).
                onPress={() => (r.source === 'doctor' ? setConfirmId(r.id) : heal(r.id))}
              />
            )}
          </Card>
        );
      })}

      {fromHealthCheck.map((a) => (
        <Card key={`hc-${a}`} style={styles.card}>
          <View style={styles.row}>
            <AppText variant="h3" style={styles.flex}>
              {t(`safety.painAreas.${a}`)}
            </AppText>
            <View style={[styles.badge, styles.badgeMuted]}>
              <AppText variant="caption" style={styles.caps}>
                {t('restrictions.sources.health')}
              </AppText>
            </View>
          </View>
          <View style={styles.rule}>
            <Icon name="close" color={colors.accentText} size={18} />
            <AppText style={styles.flex}>{impact(a)}</AppText>
          </View>
          <TextLink
            label={t('restrictions.editHealth')}
            onPress={() => router.push({ pathname: '/onboarding/safety', params: { edit: '1' } })}
          />
        </Card>
      ))}

      {!active.length && !fromHealthCheck.length ? (
        <AppText color={colors.mutedStrong}>{t('restrictions.none')}</AppText>
      ) : null}

      {adding ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('restrictions.addTitle')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {AREAS.map((a) => (
              <Chip
                key={a}
                label={t(`safety.painAreas.${a}`)}
                selected={area === a}
                onPress={() => setArea(a)}
              />
            ))}
          </View>
          {area && SIDED.includes(area) ? (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {(['left', 'right', 'both'] as const).map((s) => (
                <Chip
                  key={s}
                  label={t(`restrictions.sides.${s}`)}
                  selected={side === s}
                  onPress={() => setSide(s)}
                />
              ))}
            </View>
          ) : null}
          <Button label={t('restrictions.save')} disabled={!area} onPress={save} />
        </Card>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('restrictions.add')}
          onPress={() => setAdding(true)}
          style={styles.add}
        >
          <Icon name="plus" />
          <AppText variant="bodyStrong">{t('restrictions.add')}</AppText>
        </Pressable>
      )}

      {healed.length ? (
        <View style={styles.healed}>
          <AppText variant="caption" style={styles.caps}>
            {t('restrictions.healedTitle')}
          </AppText>
          {healed.map((r) => (
            <View key={r.id} style={styles.row}>
              <AppText color={colors.mutedStrong} style={styles.flex}>
                {label(r)}
              </AppText>
              <TextLink
                label={t('restrictions.reactivate')}
                onPress={() => setActive(r.id, true)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Notice icon>{t('restrictions.disclaimer')}</Notice>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  confirm: { gap: spacing.sm },
  badge: { borderRadius: radius.chip, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeAccent: { backgroundColor: colors.primarySoft },
  badgeMuted: { backgroundColor: colors.line },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: fonts.headingSemi,
    color: colors.ink,
  },
  rule: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
  },
  healed: { gap: spacing.xs },
}));
