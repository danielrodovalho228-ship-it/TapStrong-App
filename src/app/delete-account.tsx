import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Notice, Screen, TextField } from '@/components/ui';
import { deleteAccount } from '@/features/account/deleteAccount';
import { useAccountStore } from '@/features/account/store';
import { currentPlan, manageSubscriptionUrl } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

/** Delete account (App Store rule; Daniel, Sep 2026). */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const saved = useAccountStore((s) => s.saved);
  const entitlement = useBillingStore((s) => s.entitlement);
  const subscribed = currentPlan(entitlement, clock.now()) !== 'free' && entitlement.willRenew;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = t('deleteAccount.word');

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteAccount();
    setBusy(false);
    if (result === 'ok') router.replace('/welcome');
    else setError(t(`deleteAccount.errors.${result}`));
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('deleteAccount.title')} />}
      footer={
        <Button
          variant="danger"
          label={saved ? t('deleteAccount.confirm') : t('deleteAccount.confirmLocal')}
          disabled={typed.trim().toUpperCase() !== word.toUpperCase()}
          loading={busy}
          onPress={confirm}
        />
      }
    >
      <AppText color={colors.mutedStrong}>
        {saved ? t('deleteAccount.body') : t('deleteAccount.bodyLocal')}
      </AppText>
      <Notice tone="warning" title={t('deleteAccount.storeTitle')}>
        {t('deleteAccount.storeBody')}
      </Notice>
      {subscribed ? (
        <Button
          variant="secondary"
          label={t('deleteAccount.openStore')}
          onPress={() =>
            void Linking.openURL(manageSubscriptionUrl(Platform.OS, entitlement.productId))
          }
        />
      ) : null}
      <View style={styles.field}>
        <TextField
          label={t('deleteAccount.typeToConfirm', { word })}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
        />
      </View>
      {error ? <Notice tone="warning">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ field: { gap: spacing.sm } });
