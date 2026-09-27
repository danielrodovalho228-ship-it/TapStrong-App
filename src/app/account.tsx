import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Header,
  Notice,
  Screen,
  TextField,
  TextLink,
  ToggleRow,
} from '@/components/ui';
import { sendEmailCode, signOut, verifyEmailCode, type EmailMode } from '@/features/account/auth';
import { afterAccountSaved, syncNow } from '@/features/account/cloud';
import { useAccountStore } from '@/features/account/store';
import { requestPermission } from '@/features/notifications/apply';
import { parseTime, TRAINING_DAYS } from '@/features/notifications/plan';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { getSupabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/theme';
import { OwnerOnly } from '@/features/family/OwnerOnly';

type Step = 'start' | 'code';

/** Mockup 16 — save progress after the first workout (SPEC §8, §9 /account). */
function AccountScreenInner() {
  const { t, i18n } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const account = useAccountStore();
  const profile = useOnboardingStore();
  const mode = derive(profile)?.mode ?? 'adult';
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState(account.email ?? '');
  const [code, setCode] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('upgrade');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const send = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendEmailCode(getSupabase(), email);
    setBusy(false);
    if (result.status === 'sent') {
      setEmailMode(result.mode);
      setStep('code');
    } else setMessage(t(`account.errors.${result.status}`));
  };

  const confirm = async () => {
    setBusy(true);
    setMessage(null);
    const result = await verifyEmailCode(getSupabase(), email, code, emailMode);
    if (result !== 'ok') {
      setBusy(false);
      setMessage(t(result === 'wrong_code' ? 'account.errors.wrongCode' : 'account.errors.error'));
      return;
    }
    account.update({ saved: true, email: email.trim().toLowerCase(), promptDismissed: false });
    track('account_created', { method: 'email' });
    await afterAccountSaved();
    setBusy(false);
    setStep('start');
  };

  const toggle = async (key: 'reminders' | 'streakSaver', value: boolean) => {
    if (value && !(await requestPermission())) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    account.setNotifications({ [key]: value });
  };

  const timeText = (hhmm: string) => {
    const { hour, minute } = parseTime(hhmm);
    const d = clock.now();
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  };
  const dayNames = (TRAINING_DAYS[profile.daysPerWeek ?? 3] ?? TRAINING_DAYS[3]).map((day) => {
    const d = new Date(2026, 8, 20 + day, 12); // Sep 20 2026 is a Sunday
    return d.toLocaleDateString(i18n.language, { weekday: 'short' });
  });

  return (
    <Screen header={<Header onBack={close} />}>
      <View style={styles.head}>
        <AppText variant="caption" color={colors.accent} style={styles.caps}>
          {from === 'done' ? t('account.eyebrowDone') : t('account.eyebrow')}
        </AppText>
        <AppText variant="h1" accessibilityRole="header">
          {account.saved ? t('account.savedTitle') : t('account.title')}
        </AppText>
        <AppText color={colors.mutedStrong}>
          {account.saved ? t('account.savedBody', { email: account.email }) : t('account.body')}
        </AppText>
      </View>

      {mode === 'child' ? (
        <Notice>{t('account.under13')}</Notice>
      ) : account.saved ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t('account.syncNow')}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const r = await syncNow();
              setBusy(false);
              setMessage(t(r.status === 'ok' ? 'account.synced' : 'account.errors.offline'));
            }}
          />
          <Button
            variant="ghost"
            label={t('account.signOut')}
            onPress={async () => {
              await signOut(getSupabase());
              account.update({ saved: false, referralCode: undefined });
            }}
          />
        </View>
      ) : step === 'start' ? (
        <View style={styles.actions}>
          <TextField
            label={t('account.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Button label={t('account.sendCode')} loading={busy} onPress={send} />
          <TextLink
            label={t('account.notNow')}
            onPress={() => {
              account.update({ promptDismissed: true });
              close();
            }}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <AppText>{t('account.codeSent', { email: email.trim() })}</AppText>
          <TextField
            label={t('account.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={10}
          />
          <Button label={t('account.confirm')} loading={busy} onPress={confirm} />
          <TextLink label={t('account.changeEmail')} onPress={() => setStep('start')} />
        </View>
      )}

      {message ? <Notice tone="warning">{message}</Notice> : null}

      <Card style={styles.toggles}>
        <ToggleRow
          label={t('account.reminders')}
          detail={t('account.remindersDetail', {
            days: dayNames.join(' · '),
            time: timeText(account.notifications.reminderTime),
          })}
          value={account.notifications.reminders}
          onChange={(v) => void toggle('reminders', v)}
        />
        <View style={styles.divider} />
        <ToggleRow
          label={t('account.streakSaver')}
          detail={t('account.streakSaverDetail', {
            time: timeText(account.notifications.streakSaverTime),
          })}
          value={account.notifications.streakSaver}
          onChange={(v) => void toggle('streakSaver', v)}
        />
      </Card>
      {permissionDenied ? <Notice tone="warning">{t('account.permissionDenied')}</Notice> : null}

      {mode !== 'child' ? <Notice>{t('account.under13')}</Notice> : null}

      <View style={styles.links}>
        <TextLink label={t('account.planBilling')} onPress={() => router.push('/billing')} />
        <TextLink
          label={t('account.deleteAccount')}
          onPress={() => router.push('/delete-account')}
        />
      </View>

      <AppText variant="caption" color={colors.muted} style={styles.center}>
        {t('account.terms')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  actions: { gap: spacing.md },
  toggles: { gap: 0, paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: colors.line },
  center: { textAlign: 'center' },
  links: { alignItems: 'center', gap: spacing.sm },
});

/** Owner-only: a child profile needs the parent gate (QA B-03). */
export default function AccountScreen() {
  return (
    <OwnerOnly>
      <AccountScreenInner />
    </OwnerOnly>
  );
}
