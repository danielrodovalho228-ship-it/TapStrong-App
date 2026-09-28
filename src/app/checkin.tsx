import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Header, Notice, Screen, TextField } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import {
  bmi,
  coachNote,
  measurementsAllowed,
  photosAllowed,
  strengthChanges,
  whtr,
  whtrBand,
} from '@/features/progress/checkin';
import { formatLength, formatWeight, inchesToCm } from '@/features/progress/format';
import { useProgressStore, type StrengthRow } from '@/features/progress/store';
import { lbToKg } from '@/features/profile/units';
import { exerciseName } from '@/features/workout/format';
import { useExerciseLibrary } from '@/features/workout/hooks';
import { useWorkoutStore } from '@/features/workout/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { uuid } from '@/lib/uuid';
import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

/** Mockup 25 — the 4-week check-in (SPEC §8 "Measurements"). */
export default function CheckinScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const adult = measurementsAllowed(mode);
  const workouts = useWorkoutStore((s) => s.workouts);
  const { checkins, addCheckin, seniorPhotos } = useProgressStore();
  const library = useExerciseLibrary();
  const imperial = profile.units === 'imperial';
  const now = clock.now();
  const strength = strengthChanges(workouts, now);
  // The one before this visit: saving must not make it compare with itself,
  // and each value comes from the last check-in that had it (QA P2).
  const [previous] = useState(() => ({
    waistCm: [...checkins].reverse().find((c) => c.waistCm)?.waistCm,
    weightKg: [...checkins].reverse().find((c) => c.weightKg)?.weightKg,
    whtr: [...checkins].reverse().find((c) => c.whtr)?.whtr,
  }));

  const [waist, setWaist] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saved, setSaved] = useState(false);

  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const waistCm = num(waist) ? (imperial ? inchesToCm(num(waist)!) : num(waist)) : undefined;
  const weightKg = num(weight) ? (imperial ? lbToKg(num(weight)!) : num(weight)) : undefined;
  const heightCm =
    profile.heightCm ??
    (num(height) ? (imperial ? inchesToCm(num(height)!) : num(height)) : undefined);
  const ratio = adult && waistCm && heightCm ? whtr(waistCm, heightCm) : undefined;
  const index = adult && weightKg && heightCm ? bmi(weightKg, heightCm) : undefined;
  const waistChange =
    adult && waistCm && previous?.waistCm
      ? Math.round((waistCm - previous.waistCm) * 10) / 10
      : null;
  const note = coachNote(strength, waistChange);

  const value = (r: StrengthRow, side: 'first' | 'last') => {
    const v = r[side];
    if (r.kind === 'load') return `${v.value} ${t(`workout.units.${v.unit ?? 'lb'}`)} × ${v.reps}`;
    if (r.kind === 'reps') return t('workout.rest.reps', { count: v.value });
    return t('workout.seconds', { value: v.value });
  };
  const change = (r: StrengthRow) =>
    r.kind === 'load'
      ? `${r.change > 0 ? '+' : ''}${r.change}%`
      : r.kind === 'seconds'
        ? `${r.change > 0 ? '+' : ''}${t('workout.seconds', { value: r.change })}`
        : `${r.change > 0 ? '+' : ''}${r.change}`;

  const save = () => {
    addCheckin({
      id: uuid(),
      takenAt: now.toISOString(),
      strength,
      ...(adult ? { waistCm, weightKg, whtr: ratio, bmi: index } : {}),
    });
    if (adult && !profile.heightCm && heightCm) profile.update({ heightCm });
    track('checkin_completed');
    setSaved(true);
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('checkin.eyebrow')}
          title={t('checkin.title')}
        />
      }
      footer={
        saved ? (
          <View style={styles.row}>
            {photosAllowed(mode, seniorPhotos) ? (
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  label={t('checkin.photos')}
                  onPress={() => router.push('/before-after')}
                />
              </View>
            ) : null}
            {mode !== 'child' ? (
              <View style={styles.flex}>
                <Button
                  variant="accent"
                  label={t('checkin.share')}
                  onPress={() => router.push({ pathname: '/share', params: { range: '4w' } })}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <Button label={t('checkin.save')} onPress={save} />
        )
      }
    >
      <Card style={styles.card}>
        <View style={styles.tableHead}>
          <AppText variant="caption" style={[styles.caps, styles.name]}>
            {t('checkin.strength')}
          </AppText>
          <AppText variant="caption" style={[styles.caps, styles.cell]}>
            {t('checkin.week1')}
          </AppText>
          <AppText variant="caption" style={[styles.caps, styles.cell]}>
            {t('checkin.week4')}
          </AppText>
          <AppText variant="caption" style={[styles.caps, styles.cell]}>
            {t('checkin.change')}
          </AppText>
        </View>
        {strength.length ? (
          strength.map((r) => (
            <View key={r.exerciseId} style={styles.tableRow}>
              <AppText style={styles.name}>
                {exerciseName(
                  t,
                  library.find((e) => e.id === r.exerciseId),
                  r.exerciseId,
                )}
              </AppText>
              <AppText variant="caption" style={styles.cell}>
                {value(r, 'first')}
              </AppText>
              <AppText variant="caption" style={styles.cell}>
                {value(r, 'last')}
              </AppText>
              <AppText
                variant="bodyStrong"
                color={r.change > 0 ? colors.teal : colors.mutedStrong}
                style={styles.cell}
              >
                {change(r)}
              </AppText>
            </View>
          ))
        ) : (
          <AppText color={colors.mutedStrong}>{t('checkin.noStrength')}</AppText>
        )}
      </Card>

      {adult ? (
        <Card style={styles.card}>
          <AppText variant="caption" style={styles.caps}>
            {t('checkin.body')}
          </AppText>
          <TextField
            label={t('checkin.waist', { unit: t(imperial ? 'chat.units.in' : 'chat.units.cm') })}
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('checkin.weight', { unit: t(imperial ? 'chat.units.lb' : 'chat.units.kg') })}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          {!profile.heightCm ? (
            <TextField
              label={t('checkin.height', { unit: t(imperial ? 'chat.units.in' : 'chat.units.cm') })}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />
          ) : null}
          {previous?.waistCm ? (
            <AppText variant="caption" color={colors.muted}>
              {t('checkin.lastTime', {
                waist: formatLength(t, previous.waistCm, profile.units),
                weight: previous.weightKg ? formatWeight(t, previous.weightKg, profile.units) : '—',
              })}
            </AppText>
          ) : null}
          <AppText variant="caption" color={colors.muted}>
            {t('checkin.optional')}
          </AppText>
        </Card>
      ) : (
        <Notice>{t('checkin.minorNote')}</Notice>
      )}

      {ratio != null ? (
        <Card style={styles.card}>
          <View style={styles.row}>
            <AppText variant="caption" style={[styles.caps, styles.flex]}>
              {t('checkin.whtr')}
            </AppText>
            <AppText variant="h1">{ratio.toFixed(2)}</AppText>
            {previous?.whtr ? (
              <AppText variant="bodyStrong" color={colors.muted}>
                {t('checkin.was', { value: previous.whtr.toFixed(2) })}
              </AppText>
            ) : null}
          </View>
          <View
            style={styles.track}
            accessibilityLabel={t(`checkin.bands.${whtrBand(ratio)}`)}
            accessible
          >
            <View style={[styles.segment, { flex: 50, backgroundColor: colors.tealTint }]} />
            <View style={[styles.segment, { flex: 10, backgroundColor: colors.dark.accentSoft }]} />
            <View style={[styles.segment, { flex: 20, backgroundColor: colors.dark.accent }]} />
            <View
              style={[
                styles.marker,
                { left: `${Math.min(98, Math.max(0, ((ratio - 0.3) / 0.5) * 100))}%` },
              ]}
            />
          </View>
          <View style={styles.row}>
            <AppText variant="caption" color={colors.muted} style={styles.flex}>
              {t('checkin.healthyUnder')}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {t('checkin.highOver')}
            </AppText>
          </View>
          {index != null ? (
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('checkin.bmi', { value: index.toFixed(1) })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Card tone="dark" style={styles.card}>
        <AppText color={colors.dark.text}>
          {t(
            `checkin.notes.${note.key}`,
            'waist' in note ? { waist: formatLength(t, note.waist, profile.units) } : {},
          )}
        </AppText>
      </Card>
      {saved ? <Notice>{t('checkin.saved')}</Notice> : null}
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
  tableHead: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.xs,
  },
  tableRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  name: { flex: 2 },
  cell: { flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  track: { flexDirection: 'row', height: 12, borderRadius: radius.chip, overflow: 'visible' },
  segment: { height: 12 },
  marker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
}));
