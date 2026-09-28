import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Header, Screen } from '@/components/ui';
import { loadReferralCode, referralLink } from '@/features/account/cloud';
import { currentPlan } from '@/features/billing/rules';
import { useBillingStore } from '@/features/billing/store';
import { useOwnerAccess } from '@/features/family/OwnerOnly';
import { ParentGate, ParentPinSetup } from '@/features/family/ParentGate';
import { useParentPinStore } from '@/features/family/parentPin';
import { activeProfile, canShare, useFamilyStore } from '@/features/family/store';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { clock } from '@/lib/clock';
import { contactSupport } from '@/lib/support';
import { colors, spacing } from '@/theme';

/**
 * Settings (QA round 1): one findable place for the account, plan and
 * restrictions, with Delete account at the bottom (App Store rule). Owner-only
 * screens keep their own parent gate.
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const entitlement = useBillingStore((s) => s.entitlement);
  const plan = currentPlan(entitlement, clock.now());
  const owner = useOwnerAccess() === 'owner';
  const hasPin = useParentPinStore((s) => !!s.hash);
  // Changing the parent PIN asks for the current one first (QA R2-05).
  const [pinStep, setPinStep] = useState<'check' | 'set' | 'saved' | null>(null);
  // "Share with friends" shares the invite link, only where sharing is on (QA R4 P2).
  const member = useFamilyStore(activeProfile);
  const mode = derive(useOnboardingStore())?.mode ?? 'adult';
  const shareOk = canShare(member, mode);
  const shareInvite = async () => {
    const code = await loadReferralCode();
    if (!code) return router.push('/share');
    await Share.share({ message: t('share.inviteMessage', { link: referralLink(code) }) });
  };

  return (
    <Screen
      header={
        <Header
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          title={t('settings.title')}
        />
      }
    >
      <View style={styles.list}>
        <Button
          variant="secondary"
          label={t('settings.account')}
          onPress={() => router.push('/account')}
        />
        <Button
          variant="secondary"
          label={t('settings.plan')}
          onPress={() => router.push(plan === 'free' ? '/plans' : '/billing')}
        />
        <Button
          variant="secondary"
          label={t('settings.workout')}
          onPress={() => router.push('/settings/workout')}
        />
        <Button
          variant="secondary"
          label={t('settings.reminders')}
          onPress={() => router.push('/settings/reminders')}
        />
        <Button
          variant="secondary"
          label={t('settings.demoModel')}
          onPress={() =>
            router.push({ pathname: '/onboarding/chat', params: { step: 'body', edit: '1' } })
          }
        />
        <Button
          variant="secondary"
          label={t('equipmentSettings.title')}
          onPress={() => router.push('/settings/equipment')}
        />
        <Button
          variant="secondary"
          label={t('settings.restrictions')}
          onPress={() => router.push('/restrictions')}
        />
        {owner ? (
          <Button
            variant="secondary"
            label={hasPin ? t('settings.changePin') : t('settings.setPin')}
            onPress={() => setPinStep(hasPin ? 'check' : 'set')}
          />
        ) : null}
        {pinStep === 'check' ? (
          <ParentGate onPass={() => setPinStep('set')} onCancel={() => setPinStep(null)} />
        ) : pinStep === 'set' ? (
          <ParentPinSetup onDone={() => setPinStep('saved')} onCancel={() => setPinStep(null)} />
        ) : pinStep === 'saved' ? (
          <AppText color={colors.teal}>{t('settings.pinSaved')}</AppText>
        ) : null}
        <Button
          variant="secondary"
          label={t('settings.help')}
          onPress={() => void contactSupport(t('settings.helpSubject'))}
        />
        {shareOk ? (
          <Button
            variant="secondary"
            label={t('settings.shareFriends')}
            onPress={() => void shareInvite()}
          />
        ) : null}
      </View>
      <View style={styles.danger}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('settings.deleteNote')}
        </AppText>
        <Button
          variant="ghost"
          label={t('settings.delete')}
          onPress={() => router.push('/delete-account')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  danger: { gap: spacing.sm, marginTop: spacing.xl },
});
