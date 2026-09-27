import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, RadioCard, Screen, Select, TextField } from '@/components/ui';
import { currentPlan, FAMILY_MAX_PROFILES } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { ParentPinSetup } from '@/features/family/ParentGate';
import { hasParentPin } from '@/features/family/parentPin';
import { ownerAge } from '@/features/family/profiles';
import { useFamilyStore } from '@/features/family/store';
import { useOnboardingStore } from '@/features/onboarding/store';
import { kvStorage } from '@/lib/storage';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { birthYearOptions } from '@/features/profile/age';
import { clock } from '@/lib/clock';
import { kidsUnder13Enabled } from '@/lib/features';
import { uuid } from '@/lib/uuid';
import { spacing } from '@/theme';
import { OwnerOnly } from '@/features/family/OwnerOnly';

type Kind = 'child' | 'parent';
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Add a family member (SPEC §11.7): a child or teen managed by the parent,
 * or a parent/grandparent managed by an adult child. Family plan only.
 */
function AddMemberScreenInner() {
  const { t } = useTranslation();
  const { profiles, add, activeId } = useFamilyStore();
  const live = useOnboardingStore();
  // Only an adult owner manages family profiles or gives parental consent (QA R2-04).
  const owner = ownerAge(profiles, activeId, live, kvStorage.getItem);
  const ownerMinor = owner == null || owner < 18;
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const [kind, setKind] = useState<Kind>('child');
  const [name, setName] = useState('');
  const [month, setMonth] = useState<number>();
  const [year, setYear] = useState<number>();
  const years = useMemo(() => birthYearOptions(), []);
  // Kids and teens are protected by the parent PIN: create it first (QA R2-05).
  const [needPin, setNeedPin] = useState(false);

  const full = profiles.length >= FAMILY_MAX_PROFILES;
  const gate = month && year ? evaluateAgeGate(kind, { year, month }) : null;
  const underThirteen = gate?.status === 'guardian_consent';
  const charged =
    plan === 'family' && entitlement.status !== 'trial' && !!entitlement.firstChargedAt;

  const blocker = ownerMinor
    ? t('family.errors.ownerMinor')
    : full
      ? t('family.errors.full', { count: FAMILY_MAX_PROFILES })
      : plan !== 'family'
        ? t('family.errors.needFamily')
        : gate && gate.status !== 'ok' && !underThirteen
          ? t(`who.errors.${gate.status}`)
          : underThirteen && !charged
            ? t('family.errors.needCharge')
            : null;

  const next = () => {
    if (!gate || blocker || !month || !year) return;
    if (kind === 'child' && !hasParentPin()) {
      setNeedPin(true);
      return;
    }
    const id = uuid();
    const seed = { who: kind, birthMonth: month, birthYear: year };
    if (underThirteen) {
      router.push({
        pathname: '/family/consent',
        params: { id, name: name.trim(), month: String(month), year: String(year) },
      });
      return;
    }
    ensureSelfProfile();
    add({ id, kind, name: name.trim() || undefined });
    switchProfile(id, seed);
    router.replace('/onboarding/who');
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('family.addTitle')} />}
      footer={
        <Button
          label={underThirteen ? t('family.next') : t('family.create')}
          disabled={!gate || !!blocker || !name.trim()}
          onPress={next}
        />
      }
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        {(['child', 'parent'] as const).map((k) => (
          <RadioCard
            key={k}
            label={
              k === 'child' && !kidsUnder13Enabled()
                ? t('family.kinds.childTeen')
                : t(`family.kinds.${k}`)
            }
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <TextField label={t('family.name')} value={name} onChangeText={setName} maxLength={40} />
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
      {blocker ? <Notice tone="warning">{blocker}</Notice> : null}
      {needPin ? (
        <ParentPinSetup
          onDone={() => {
            setNeedPin(false);
            next();
          }}
          onCancel={() => setNeedPin(false)}
        />
      ) : null}
      {plan !== 'family' ? (
        <Button
          variant="secondary"
          label={t('family.seePlans')}
          onPress={() => router.push('/plans')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
});

/** Owner-only: a child profile needs the parent gate (QA B-03). */
export default function AddMemberScreen() {
  return (
    <OwnerOnly>
      <AddMemberScreenInner />
    </OwnerOnly>
  );
}
