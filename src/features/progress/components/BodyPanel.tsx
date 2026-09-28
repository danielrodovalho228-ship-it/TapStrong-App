import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, TextField, TextLink } from '@/components/ui';
import { latest, TAPE, useBodyStore, whtr, type BodyEntry } from '@/features/body/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { lbToKg } from '@/features/profile/units';
import { clock } from '@/lib/clock';
import { localDate } from '@/lib/dates';
import { colors, spacing } from '@/theme';

import { formatLength, formatWeight, inchesToCm } from '../format';
import { useProgressStore } from '../store';

const FIELDS = ['weight', ...TAPE] as const;
type Field = (typeof FIELDS)[number];

/**
 * Progress → Body (improvements v1, D3), adults only (the tab checks
 * measurementsAllowed): waist-to-height first, weight trend, tape entries.
 */
export function BodyPanel() {
  const { t, i18n } = useTranslation();
  const { units, heightCm } = useOnboardingStore();
  const checkins = useProgressStore((s) => s.checkins);
  const { entries, add } = useBodyStore();
  const imperial = units === 'imperial';
  const now = latest(entries, checkins);
  const ratio = whtr(now.waistCm, heightCm);
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [saved, setSaved] = useState(false);

  const weights = [
    ...checkins.map((c) => ({ date: c.takenAt, kg: c.weightKg })),
    ...entries.map((e) => ({ date: e.date, kg: e.weightKg })),
  ]
    .filter((w): w is { date: string; kg: number } => !!w.kg)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = weights[0];
  const last = weights.at(-1);
  const changeKg = first && last && weights.length > 1 ? last.kg - first.kg : null;

  const num = (s?: string) => {
    const v = Number((s ?? '').replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const unitOf = (f: Field) =>
    f === 'weight'
      ? t(`chat.units.${imperial ? 'lb' : 'kg'}`)
      : t(`chat.units.${imperial ? 'in' : 'cm'}`);
  const save = () => {
    const entry: BodyEntry = { date: localDate(clock.now()) };
    for (const f of FIELDS) {
      const v = num(draft[f]);
      if (v === undefined) continue;
      if (f === 'weight') entry.weightKg = imperial ? lbToKg(v) : v;
      else entry[`${f}Cm`] = imperial ? inchesToCm(v) : v;
    }
    if (Object.keys(entry).length === 1) return;
    add(entry);
    setDraft({});
    setSaved(true);
  };

  return (
    <>
      <Card style={styles.card}>
        <AppText variant="h3">{t('progress.body.whtr')}</AppText>
        {ratio !== null ? (
          <>
            <AppText variant="h1">
              {ratio.toLocaleString(i18n.language, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </AppText>
            <AppText color={colors.mutedStrong}>{t('progress.body.whtrNote')}</AppText>
          </>
        ) : (
          <AppText color={colors.mutedStrong}>
            {heightCm ? t('progress.body.whtrNeedsWaist') : t('progress.body.whtrNeedsHeight')}
          </AppText>
        )}
      </Card>

      {last ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('progress.body.weight')}</AppText>
          <AppText variant="h2">{formatWeight(t, last.kg, units)}</AppText>
          {changeKg !== null && first ? (
            <AppText color={colors.mutedStrong}>
              {t('progress.body.weightChange', {
                change: `${changeKg > 0 ? '+' : changeKg < 0 ? '−' : ''}${formatWeight(t, Math.abs(changeKg), units)}`,
                date: new Date(first.date).toLocaleDateString(i18n.language, {
                  month: 'short',
                  day: 'numeric',
                }),
              })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {TAPE.some((k) => now[`${k}Cm`]) ? (
        <Card style={styles.card}>
          <AppText variant="h3">{t('progress.body.latest')}</AppText>
          {TAPE.filter((k) => now[`${k}Cm`]).map((k) => (
            <View key={k} style={styles.line}>
              <AppText style={styles.flex}>{t(`progress.body.tape.${k}`)}</AppText>
              <AppText variant="bodyStrong">{formatLength(t, now[`${k}Cm`]!, units)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="h3">{t('progress.body.add')}</AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('progress.body.addNote')}
        </AppText>
        <View style={styles.fields}>
          {FIELDS.map((f) => (
            <View key={f} style={styles.field}>
              <TextField
                label={t('progress.body.field', {
                  name: t(`progress.body.tape.${f}`),
                  unit: unitOf(f),
                })}
                accessibilityLabel={t('progress.body.field', {
                  name: t(`progress.body.tape.${f}`),
                  unit: unitOf(f),
                })}
                keyboardType="decimal-pad"
                value={draft[f] ?? ''}
                onChangeText={(v) => {
                  setSaved(false);
                  setDraft({ ...draft, [f]: v });
                }}
              />
            </View>
          ))}
        </View>
        <Button
          label={t('progress.body.save')}
          disabled={!FIELDS.some((f) => num(draft[f]) !== undefined)}
          onPress={save}
        />
        {saved ? <AppText color={colors.teal}>{t('progress.body.saved')}</AppText> : null}
      </Card>

      <TextLink
        tone="accent"
        label={t('progress.openCheckin')}
        onPress={() => router.push('/checkin')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  line: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  flex: { flex: 1 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { flexBasis: '47%', flexGrow: 1 },
});
