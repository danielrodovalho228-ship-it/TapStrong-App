import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Checkbox, Header, Icon, Notice, Screen } from '@/components/ui';
import { ensureOwnerProfileSynced } from '@/features/account/cloud';
import { useBillingStore } from '@/features/billing/store';
import { createChildProfileRemote } from '@/features/family/remote';
import { ownerAge } from '@/features/family/profiles';
import { childConsentBlocker } from '@/features/family/rules';
import { useOnboardingStore } from '@/features/onboarding/store';
import { kvStorage } from '@/lib/storage';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';
import { OwnerOnly } from '@/features/family/OwnerOnly';

const POINTS = ['collect', 'use', 'never', 'rights'] as const;

/**
 * Parent notice + verified consent for a child under 13 (COPPA). The
 * verification is the charged Family subscription (Daniel, Sep 2026); the
 * database refuses the profile without it. To be reviewed by a lawyer.
 */
function ParentConsentScreenInner() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; name?: string; month: string; year: string }>();
  const { add, profiles, activeId } = useFamilyStore();
  const live = useOnboardingStore();
  const entitlement = useBillingStore((s) => s.entitlement);
  const birthMonth = Number(params.month);
  const birthYear = Number(params.year);
  // Never trust the URL: re-check id, age, room and the charged plan (QA B-06).
  const blocker = childConsentBlocker({
    id: params.id,
    birth: { month: birthMonth, year: birthYear },
    profiles,
    entitlement,
    now: clock.now(),
    ownerAge: ownerAge(profiles, activeId, live, kvStorage.getItem),
  });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (blocker) return;
    setBusy(true);
    setError(null);
    // Owner first (Phase 12): the database checks the owner's age from it.
    const synced = await ensureOwnerProfileSynced();
    if (synced !== 'ok') {
      setBusy(false);
      setError(t(`family.ownerSync.${synced}`));
      return;
    }
    const result = await createChildProfileRemote({
      id: params.id,
      birthMonth,
      birthYear,
      sex: null,
      name: params.name || null,
    });
    setBusy(false);
    if (result !== 'ok') {
      setError(t(`family.consent.errors.${result}`));
      return;
    }
    ensureSelfProfile();
    const added = add({
      id: params.id,
      kind: 'child',
      name: params.name || undefined,
      consentAt: clock.now().toISOString(),
    });
    // Never switch to a profile that wasn't added (QA B-06).
    if (!added) {
      setError(t('family.consent.errors.full'));
      return;
    }
    switchProfile(params.id, { who: 'child', birthMonth, birthYear });
    router.replace('/onboarding/who');
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('family.consent.title')} />}
      footer={
        <Button
          label={t('family.consent.create')}
          disabled={!agreed || !!blocker}
          loading={busy}
          onPress={create}
        />
      }
    >
      <AppText color={colors.mutedStrong}>
        {t('family.consent.intro', { name: params.name || t('family.member') })}
      </AppText>
      <View style={styles.list}>
        {POINTS.map((p) => (
          <View key={p} style={styles.row}>
            <Icon name="shield" color={colors.teal} />
            <AppText style={styles.flex}>{t(`family.consent.points.${p}`)}</AppText>
          </View>
        ))}
      </View>
      <Notice>{t('family.consent.verification')}</Notice>
      <Checkbox label={t('family.consent.agree')} checked={agreed} onChange={setAgreed} />
      {blocker ? <Notice tone="warning">{t(`family.consent.blockers.${blocker}`)}</Notice> : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
});

/** Owner-only: a child profile needs the parent gate (QA B-03). */
export default function ParentConsentScreen() {
  return (
    <OwnerOnly>
      <ParentConsentScreenInner />
    </OwnerOnly>
  );
}
