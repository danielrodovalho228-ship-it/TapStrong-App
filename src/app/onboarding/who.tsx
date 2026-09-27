import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Notice, RadioCard, Screen, Select } from '@/components/ui';
import { ParentGate } from '@/features/family/ParentGate';
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
  // A child profile's birth date is locked: only a parent, behind the gate,
  // may fix it, and it can never move the profile out of kids mode (QA B-01).
  const locked = profile?.kind === 'child';
  const [unlocked, setUnlocked] = useState(false);
  const [gate, setGate] = useState(false);
  const effectiveWho: Who = locked ? 'child' : who;
  const result =
    month && year
      ? evaluateAgeGate(effectiveWho, { year, month }, undefined, consented, locked)
      : null;

  const onContinue = () => {
    if (result?.status !== 'ok') return;
    stored.update({ who: effectiveWho, birthMonth: month, birthYear: year });
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

      {!locked ? (
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
      ) : null}

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          {t(`who.birth.${effectiveWho}`)}
        </AppText>
        {locked && !unlocked ? (
          <>
            <AppText variant="h3">
              {month && year ? `${t(`months.${month}` as 'months.1')} ${year}` : '—'}
            </AppText>
            <Notice>{t('who.locked')}</Notice>
            {gate ? (
              <ParentGate
                onPass={() => {
                  setUnlocked(true);
                  setGate(false);
                }}
                onCancel={() => setGate(false)}
              />
            ) : (
              <Button
                variant="secondary"
                label={t('who.changeParent')}
                onPress={() => setGate(true)}
              />
            )}
          </>
        ) : (
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
        )}
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
      {result?.status === 'guardian_consent' ? (
        // Not a dead end: the parent sets up their own profile first, then adds
        // the child from Family (QA B-05).
        <Button
          variant="secondary"
          label={t('who.parentFirst')}
          onPress={() => {
            setWho('me');
            setMonth(undefined);
            setYear(undefined);
          }}
        />
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
