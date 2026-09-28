import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { normalizeReferral, useAccountStore } from '@/features/account/store';
import { colors, fonts, spacing } from '@/theme';

/**
 * Referral link: tapstrong://r/CODE (and https://tapstrong.app/r/CODE once
 * the domain is set up). The code is kept until the account is saved, and the
 * person sees that the invite was received (QA round 1).
 */
export default function ReferralLink() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const update = useAccountStore((s) => s.update);
  const redeemed = useAccountStore((s) => s.referralRedeemed);
  const normalized = normalizeReferral(code);

  useEffect(() => {
    if (normalized && !redeemed) update({ pendingReferral: normalized });
  }, [normalized, redeemed, update]);

  if (!normalized || redeemed) return <Redirect href="/" />;

  return (
    <Screen footer={<Button label={t('referral.continue')} onPress={() => router.replace('/')} />}>
      <View style={styles.body}>
        <AppText variant="caption" color={colors.accentText} style={styles.caps}>
          {t('referral.eyebrow')}
        </AppText>
        <AppText variant="h1" accessibilityRole="header">
          {t('referral.title')}
        </AppText>
        <AppText color={colors.mutedStrong}>{t('referral.body')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingTop: spacing.xxl },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
});
