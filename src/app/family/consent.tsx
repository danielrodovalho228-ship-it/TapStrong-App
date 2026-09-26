import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Checkbox, Header, Icon, Notice, Screen } from '@/components/ui';
import { createChildProfileRemote } from '@/features/family/remote';
import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

const POINTS = ['collect', 'use', 'never', 'rights'] as const;

/**
 * Parent notice + verified consent for a child under 13 (COPPA). The
 * verification is the charged Family subscription (Daniel, Sep 2026); the
 * database refuses the profile without it. To be reviewed by a lawyer.
 */
export default function ParentConsentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; name?: string; month: string; year: string }>();
  const add = useFamilyStore((s) => s.add);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const birthMonth = Number(params.month);
    const birthYear = Number(params.year);
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
    add({
      id: params.id,
      kind: 'child',
      name: params.name || undefined,
      consentAt: clock.now().toISOString(),
    });
    switchProfile(params.id, { who: 'child', birthMonth, birthYear });
    router.replace('/onboarding/who');
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('family.consent.title')} />}
      footer={
        <Button
          label={t('family.consent.create')}
          disabled={!agreed}
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
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
