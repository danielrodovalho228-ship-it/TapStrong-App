import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Checkbox,
  Chip,
  Header,
  Notice,
  RadioCard,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import {
  catalogAreas,
  jointsForArea,
  movementCatalog,
  movementKey,
  type MovementKey,
} from '@/features/movement/catalog';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { ParentGate } from '@/features/family/ParentGate';
import { useMovementPainStore, type PainDuration } from '@/features/movement/store';
import { areaName, movementExample, movementName, ScoreChips } from '@/features/movement/ui';
import { derive } from '@/features/onboarding/derived';
import type { PainArea } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useRestrictionsStore } from '@/features/restrictions/store';
import { clock } from '@/lib/clock';
import { uuid } from '@/lib/uuid';
import { colors, fonts, makeStyles, spacing, useColors } from '@/theme';

type Step = 'gate' | 'area' | 'side' | 'flags' | 'stop' | 'moves' | 'score' | 'duration';
type Rating = 'hurts' | 'fine' | 'untried';

/**
 * "Movement that hurts" (SPEC §8): area and side, red-flag screening, which
 * movements hurt and which don't, pain 0–10 and how long. Never a diagnosis.
 */
export default function MovementPainScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ area?: string }>();
  const catalog = useMemo(() => movementCatalog(), []);
  const mode = derive(useOnboardingStore())?.mode;
  const addReport = useMovementPainStore((s) => s.add);
  const reports = useMovementPainStore((s) => s.reports);
  // A managed teen's new report would replace the active recovery plan for
  // that area and side: that needs a parent, like ending it (QA R6-04).
  const access = useOwnerAccess();
  const [pinGate, setPinGate] = useState(false);
  const addRestriction = useRestrictionsStore((s) => s.add);

  const areas = catalog ? catalogAreas(catalog) : [];
  const preset = params.area && areas.includes(params.area) ? params.area : null;
  const child = mode === 'child';
  const [step, setStep] = useState<Step>(child ? 'gate' : preset ? 'side' : 'area');
  const [guardian, setGuardian] = useState(false);
  const [area, setArea] = useState<string | null>(preset);
  const [side, setSide] = useState<'left' | 'right' | 'both' | null>(null);
  const [flags, setFlags] = useState<string[] | null>(null);
  const [ratings, setRatings] = useState<Partial<Record<MovementKey, Rating>>>({});
  const [score, setScore] = useState<number | null>(null);
  const [duration, setDuration] = useState<PainDuration | null>(null);

  const header = (
    <Header
      onBack={() => router.back()}
      eyebrow={t('movementPain.eyebrow')}
      title={t('movementPain.title')}
    />
  );
  if (!catalog) {
    return (
      <Screen header={header}>
        <Notice icon>{t('movementPain.underReview')}</Notice>
      </Screen>
    );
  }

  const joints = area ? jointsForArea(catalog, area) : [];
  const sided = joints.some((j) => catalog.joints[j].sided);
  const keys = joints.flatMap((j) => catalog.joints[j].movements.map((m) => movementKey(j, m)));
  const painful = keys.filter((k) => ratings[k] === 'hurts');

  const afterArea = () => setStep(sided ? 'side' : 'flags');
  const next = () => {
    if (step === 'gate') setStep(preset ? (sided ? 'side' : 'flags') : 'area');
    else if (step === 'area') afterArea();
    else if (step === 'side') setStep('flags');
    else if (step === 'flags') {
      if (flags?.length) {
        // Red flag: no plan. Workouts leave the whole area out until it's checked.
        addRestriction({
          area: area as PainArea,
          side: side === 'left' || side === 'right' ? side : undefined,
          source: 'doctor',
        });
        setStep('stop');
      } else setStep('moves');
    } else if (step === 'moves') setStep('score');
    else if (step === 'score') setStep('duration');
    else if (step === 'duration') save();
  };

  const reportSide = side === 'left' || side === 'right' ? side : undefined;
  const replacesPlan = reports.some((r) => r.active && r.area === area && r.side === reportSide);
  const minorGated = access === 'gate' && (mode === 'teen' || mode === 'child');
  const save = () => {
    if (!area || score == null || !duration) return;
    if (replacesPlan && minorGated && !pinGate) return setPinGate(true);
    commit();
  };
  const commit = () => {
    if (!area || score == null || !duration) return;
    const id = uuid();
    addReport({
      id,
      area,
      joints,
      side: reportSide,
      painful,
      painFree: keys.filter((k) => ratings[k] === 'fine'),
      score,
      duration,
      active: true,
      createdAt: clock.now().toISOString(),
      checks: [],
      retests: [],
    });
    router.replace({ pathname: '/movement-pain/[id]', params: { id } });
  };

  const canGo =
    step === 'gate'
      ? guardian
      : step === 'area'
        ? !!area
        : step === 'side'
          ? !!side
          : step === 'flags'
            ? flags !== null
            : step === 'moves'
              ? painful.length > 0
              : step === 'score'
                ? score != null
                : step === 'duration'
                  ? !!duration
                  : false;

  const toggleFlag = (flag: string) => {
    const current = flags ?? [];
    setFlags(current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag]);
  };

  return (
    <Screen
      header={header}
      footer={
        step === 'stop' ? (
          // Straight to the restrictions list, where "Doctor first" now shows (QA round 2).
          <Button
            label={t('movementPain.stopDone')}
            onPress={() => router.replace('/restrictions')}
          />
        ) : (
          <Button
            label={step === 'duration' ? t('movementPain.save') : t('movementPain.next')}
            disabled={!canGo}
            onPress={next}
          />
        )
      }
    >
      {__DEV__ ? <Notice tone="warning">{t('movementPain.devOnly')}</Notice> : null}
      {pinGate ? <ParentGate onPass={commit} onCancel={() => setPinGate(false)} /> : null}

      {step === 'gate' ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('movementPain.childGate')}</AppText>
          <Checkbox
            label={t('movementPain.childConfirm')}
            checked={guardian}
            onChange={setGuardian}
          />
        </Card>
      ) : null}

      {step === 'area' ? (
        <>
          <AppText color={colors.mutedStrong}>{t('movementPain.intro')}</AppText>
          <AppText variant="h3">{t('movementPain.areaTitle')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {areas.map((a) => (
              <Chip
                key={a}
                label={areaName(t, a)}
                selected={area === a}
                onPress={() => {
                  setArea(a);
                  setRatings({});
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      {step === 'side' ? (
        <>
          <AppText variant="h3">{t('movementPain.sideTitle')}</AppText>
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
        </>
      ) : null}

      {step === 'flags' ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('movementPain.redFlagsTitle')}</AppText>
          <AppText color={colors.mutedStrong}>{t('movementPain.redFlagsBody')}</AppText>
          {catalog.redFlags.map((flag) => (
            <Checkbox
              key={flag}
              label={t(`movementPain.redFlags.${flag as 'trauma'}`)}
              checked={!!flags?.includes(flag)}
              onChange={() => toggleFlag(flag)}
            />
          ))}
          <Chip
            label={t('movementPain.noneApply')}
            selected={flags !== null && flags.length === 0}
            onPress={() => setFlags([])}
          />
        </Card>
      ) : null}

      {step === 'stop' ? (
        <Notice tone="warning" title={t('movementPain.stopTitle')}>
          {t('movementPain.stopBody')}
        </Notice>
      ) : null}

      {step === 'moves' ? (
        <>
          <AppText variant="h3">{t('movementPain.moveTitle')}</AppText>
          <AppText color={colors.mutedStrong}>{t('movementPain.moveBody')}</AppText>
          {joints.map((j) => (
            <View key={j} style={styles.group}>
              {joints.length > 1 ? (
                <AppText variant="caption" style={styles.caps}>
                  {t(`movementPain.joints.${j}`)}
                </AppText>
              ) : null}
              {catalog.joints[j].movements.map((m) => {
                const key = movementKey(j, m);
                return (
                  <Card key={key} style={styles.card}>
                    <AppText variant="bodyStrong">{movementName(t, key)}</AppText>
                    <AppText variant="caption" color={colors.mutedStrong}>
                      {movementExample(t, key)}
                    </AppText>
                    <SegmentedControl
                      accessibilityLabel={movementName(t, key)}
                      value={ratings[key] ?? 'untried'}
                      onChange={(v) => setRatings({ ...ratings, [key]: v })}
                      options={(['hurts', 'fine', 'untried'] as const).map((v) => ({
                        value: v,
                        label: t(`movementPain.states.${v}`),
                        accessibilityLabel: t('movementPain.moveA11y', {
                          movement: movementName(t, key),
                          state: t(`movementPain.states.${v}`),
                        }),
                      }))}
                    />
                  </Card>
                );
              })}
            </View>
          ))}
          <AppText variant="caption" color={colors.mutedStrong}>
            {painful.length ? t('movementPain.untriedNote') : t('movementPain.needPainful')}
          </AppText>
        </>
      ) : null}

      {step === 'score' ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('movementPain.scoreTitle')}</AppText>
          <ScoreChips value={score} onChange={setScore} />
        </Card>
      ) : null}

      {step === 'duration' ? (
        <>
          <AppText variant="h3">{t('movementPain.durationTitle')}</AppText>
          {catalog.durations.map((d) => (
            <RadioCard
              key={d}
              label={t(`movementPain.durations.${d as PainDuration}`)}
              selected={duration === d}
              onPress={() => setDuration(d as PainDuration)}
            />
          ))}
        </>
      ) : null}

      <AppText variant="caption" color={colors.muted}>
        {t('movementPain.disclaimer')}
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.sm },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: fonts.headingSemi,
    color: colors.muted,
  },
}));
