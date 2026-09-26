import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Notice, RadioCard, Screen, Select, TextField } from '@/components/ui';
import { currentPlan, FAMILY_MAX_PROFILES } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { evaluateAgeGate } from '@/features/onboarding/age-gate';
import { birthYearOptions } from '@/features/profile/age';
import { clock } from '@/lib/clock';
import { uuid } from '@/lib/uuid';
import { spacing } from '@/theme';

type Kind = 'child' | 'parent';
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Add a family member (SPEC §11.7): a child or teen managed by the parent,
 * or a parent/grandparent managed by an adult child. Family plan only.
 */
export default function AddMemberScreen() {
  const { t } = useTranslation();
  const { profiles, add } = useFamilyStore();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const [kind, setKind] = useState<Kind>('child');
  const [name, setName] = useState('');
  const [month, setMonth] = useState<number>();
  const [year, setYear] = useState<number>();
  const years = useMemo(() => birthYearOptions(), []);

  const full = profiles.length >= FAMILY_MAX_PROFILES;
  const gate = month && year ? evaluateAgeGate(kind, { year, month }) : null;
  const underThirteen = gate?.status === 'guardian_consent';
  const charged =
    plan === 'family' && entitlement.status !== 'trial' && !!entitlement.firstChargedAt;

  const blocker = full
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
            label={t(`family.kinds.${k}`)}
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
