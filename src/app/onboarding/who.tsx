import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Notice, RadioCard, Screen, Select } from '@/components/ui';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { STEP_NUMBER, TOTAL_STEPS, WHO_OPTIONS, type Who } from '@/features/onboarding/options';
import { useOnboardingStore } from '@/features/onboarding/store';
import { birthYearOptions } from '@/features/profile/age';
import { track } from '@/lib/analytics';
import { useAppModeStore } from '@/stores/app-mode';
import { colors, fonts, spacing } from '@/theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Mockup 02 — Who's training + age mode (step 1 of 7). */
export default function WhoScreen() {
  const { t } = useTranslation();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const stored = useOnboardingStore();
  const setMode = useAppModeStore((s) => s.setMode);

  const [who, setWho] = useState<Who>(stored.who ?? 'me');
  const [month, setMonth] = useState<number | undefined>(stored.birthMonth);
  const [year, setYear] = useState<number | undefined>(stored.birthYear);

  const years = useMemo(() => birthYearOptions(), []);
  const profile = useFamilyStore(activeProfile);
  const consented = profile?.kind === 'child' && !!profile.consentAt;
  const result = month && year ? evaluateAgeGate(who, { year, month }, undefined, consented) : null;

  const onContinue = () => {
    if (result?.status !== 'ok') return;
    stored.update({ who, birthMonth: month, birthYear: year });
    setMode(result.mode);
    track('age_mode_set', { mode: result.mode });
    if (edit) router.back();
    else router.push('/onboarding/chat');
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={t('onboarding.step', { current: STEP_NUMBER.who, total: TOTAL_STEPS })}
        />
      }
      footer={
        <>
          <Button
            label={t('common.continue')}
            onPress={onContinue}
            disabled={result?.status !== 'ok'}
          />
          <AppText variant="caption" color={colors.muted} style={styles.center}>
            {t('who.footnote')}
          </AppText>
        </>
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        {t('who.title')}
      </AppText>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {WHO_OPTIONS.map((option) => (
          <RadioCard
            key={option}
            label={t(`who.options.${option}`)}
            selected={who === option}
            onPress={() => setWho(option)}
          />
        ))}
      </View>

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          {t(`who.birth.${who}`)}
        </AppText>
        <View style={styles.row}>
          <Select
            label={t('who.month')}
            placeholder={t('who.monthPlaceholder')}
            value={month}
            onChange={setMonth}
            options={MONTHS.map((m) => ({ value: m, label: t(`months.${m}` as 'months.1') }))}
          />
          <Select
            label={t('who.year')}
            placeholder={t('who.yearPlaceholder')}
            value={year}
            onChange={setYear}
            options={years.map((y) => ({ value: y, label: String(y) }))}
          />
        </View>
      </View>

      {result?.status === 'ok' && result.mode !== 'child' ? (
        <Notice
          title={t('who.modeTitle', { mode: t(`who.modes.${result.mode}`), age: result.age })}
        >
          {t(`who.modeBody.${result.mode}`)}
        </Notice>
      ) : null}
      {result && result.status !== 'ok' ? (
        <Notice tone="warning" icon>
          {t(`who.errors.${result.status}`)}
        </Notice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.md },
  section: { gap: spacing.sm },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: fonts.heading },
  row: { flexDirection: 'row', gap: spacing.md },
  center: { textAlign: 'center' },
});
