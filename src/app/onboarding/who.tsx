import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Header,
  Notice,
  RadioCard,
  Screen,
  Select,
  TextLink,
} from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { ParentGate } from '@/features/family/ParentGate';
import { activeProfile, useFamilyStore } from '@/features/family/store';
import {
  isOwnerProfile,
  minorLockFor,
  useOwnerIdentityStore,
} from '@/features/family/ownerIdentity';
import { evaluateAgeGate, whoErrorKey } from '@/features/onboarding/age-gate';
import { STEP_NUMBER, TOTAL_STEPS, WHO_OPTIONS, type Who } from '@/features/onboarding/options';
import { ageLockApplies, isAgeBlocked, useAgeBlockStore } from '@/features/onboarding/ageBlock';
import { useOnboardingStore } from '@/features/onboarding/store';
import { birthYearOptions } from '@/features/profile/age';
import { track } from '@/lib/analytics';
import { kidsUnder13Enabled } from '@/lib/features';
import { contactSupport, SUPPORT_EMAIL } from '@/lib/support';
import { useAppModeStore } from '@/stores/app-mode';
import { fonts, spacing, useColors } from '@/theme';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Mockup 02 — Who's training + age mode (step 1 of 7). */
export default function WhoScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const stored = useOnboardingStore();
  const setMode = useAppModeStore((s) => s.setMode);

  const [who, setWho] = useState<Who>(stored.who ?? 'me');
  const [month, setMonth] = useState<number | undefined>(stored.birthMonth);
  const [year, setYear] = useState<number | undefined>(stored.birthYear);

  const years = useMemo(() => birthYearOptions(), []);
  const ageBlock = useAgeBlockStore();
  const accountSaved = useAccountStore((s) => s.saved);
  const profile = useFamilyStore(activeProfile);
  const [underMinShown, setUnderMinShown] = useState(false);
  const minors = useOwnerIdentityStore((s) => s.minors);
  const ownerId = useOwnerIdentityStore((s) => s.ownerId);
  const activeId = useOwnerIdentityStore((s) => s.activeId);
  // The lock comes from the secure record, not the editable kind (QA R4-05).
  const lock = minorLockFor(profile, minors);
  const consented = lock === 'under13';
  // A child or teen profile's birth date is locked: only a parent, behind the
  // gate, may fix it. An under-13 profile can never move to 13+, and a teen
  // profile stays 13–17 (QA B-01, R2-01).
  // A family whose active profile is missing, or a "self" that isn't the
  // secure owner, also needs a parent to change the birth date.
  const unknown =
    !!ownerId &&
    (!profile || (profile.kind === 'self' && !isOwnerProfile(profile, { ownerId, activeId })));
  const locked = !!lock || unknown;
  const [unlocked, setUnlocked] = useState(false);
  const [gate, setGate] = useState(false);
  const effectiveWho: Who = lock ? 'child' : who;
  const result =
    month && year
      ? evaluateAgeGate(effectiveWho, { year, month }, undefined, consented, lock)
      : null;

  // QA R3-01: the phone-wide stop is only for the self-signup "Me" flow before
  // an account exists. A family profile or an edit just says "13 and up".
  const lockApplies = ageLockApplies({
    who: effectiveWho,
    editing: !!edit,
    accountSaved,
    familyProfile: !!profile && profile.kind !== 'self',
  });

  const onContinue = () => {
    if (result?.status === 'under_min' && month && year) {
      // Under 13 answering for themselves (kids off): neutral stop, kept on
      // this phone until the date entered turns 13.
      if (lockApplies) return ageBlock.block({ year, month });
      return setUnderMinShown(true);
    }
    if (result?.status !== 'ok') return;
    stored.update({ who: effectiveWho, birthMonth: month, birthYear: year });
    setMode(result.mode);
    track('age_mode_set', { mode: result.mode });
    if (edit) router.back();
    else router.push('/onboarding/chat');
  };

  if (lockApplies && isAgeBlocked(ageBlock.birth)) {
    return (
      <Screen>
        <View style={styles.block}>
          <AppText variant="h1" accessibilityRole="header">
            {t('ageBlock.title')}
          </AppText>
          <AppText color={colors.mutedStrong}>{t('ageBlock.body')}</AppText>
          <AppText variant="caption" color={colors.muted}>
            {t('ageBlock.support', { email: SUPPORT_EMAIL })}
          </AppText>
          <TextLink
            tone="accent"
            label={t('ageBlock.contact')}
            onPress={() => contactSupport(t('ageBlock.subject'))}
          />
        </View>
      </Screen>
    );
  }

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
            disabled={result?.status !== 'ok' && result?.status !== 'under_min'}
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
              label={
                option === 'child' && !kidsUnder13Enabled()
                  ? t('who.options.childTeen')
                  : t(`who.options.${option}`)
              }
              selected={who === option}
              onPress={() => setWho(option)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          {/* A teen on their own profile reads "Your birth month" (QA R4 P2). */}
          {t(
            `who.birth.${
              lock && !isOwnerProfile(profile, { ownerId, activeId })
                ? 'me'
                : effectiveWho === 'child' && !kidsUnder13Enabled()
                  ? 'teen'
                  : effectiveWho
            }`,
          )}
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
              onChange={(m) => {
                setMonth(m);
                setUnderMinShown(false);
              }}
              options={MONTHS.map((m) => ({ value: m, label: t(`months.${m}` as 'months.1') }))}
            />
            <Select
              label={t('who.year')}
              placeholder={t('who.yearPlaceholder')}
              value={year}
              onChange={(y) => {
                setYear(y);
                setUnderMinShown(false);
              }}
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
      {/* Neutral: the "13 and up" stop shows only after Continue, never as a live hint. */}
      {result?.status === 'under_min' && underMinShown ? (
        <Notice tone="warning" icon>
          {t('who.errors.under_min')}
        </Notice>
      ) : null}
      {result && result.status !== 'ok' && result.status !== 'under_min' ? (
        <Notice tone="warning" icon>
          {t(whoErrorKey(result.status))}
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
  block: { gap: spacing.md, paddingTop: spacing.xxl },
});
