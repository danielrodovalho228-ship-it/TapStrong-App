import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Notice, TextField, TextLink } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

import {
  checkParentPin,
  isValidPin,
  lockMinutesLeft,
  MAX_TRIES,
  PIN_LENGTH,
  setParentPin,
  useParentPinStore,
} from './parentPin';
import { clearPinLock, pullPinLock, reportPinCheck } from './pinLockout';
import { maskEmail, ownerEmail, sendPinResetCode, verifyPinResetCode } from './pinReset';
import { isOwnerProfile, useOwnerIdentityStore } from './ownerIdentity';
import { activeProfile, useFamilyStore } from './store';

/**
 * Parent gate (QA B-01, B-03, R2-05): owner-only actions on a child or teen
 * profile ask for the parent PIN, with a 15-minute lockout after 5 wrong
 * tries (also counted on the account when online). Without a PIN, only the
 * owner's own profile may create one; a child profile is told to ask a parent.
 */
export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const hasPin = useParentPinStore((s) => !!s.hash);
  const active = useFamilyStore(activeProfile);
  const ownerId = useOwnerIdentityStore((s) => s.ownerId);
  const activeId = useOwnerIdentityStore((s) => s.activeId);
  const owner = isOwnerProfile(active, { ownerId, activeId });
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // A lock counted on the account applies here too (QA round 3).
  const [, setSynced] = useState(0);
  useEffect(() => {
    if (hasPin) void pullPinLock(getSupabase()).then(() => setSynced((n) => n + 1));
  }, [hasPin]);

  // Forgotten PIN: the owner proves it with an email code (Phase 12).
  if (hasPin && resetting)
    return <ParentPinReset onDone={onPass} onCancel={() => setResetting(false)} />;

  if (!hasPin) {
    return owner ? (
      <ParentPinSetup onDone={onPass} onCancel={onCancel} />
    ) : (
      <Card style={styles.card}>
        <AppText variant="h3">{t('parentGate.title')}</AppText>
        <Notice>{t('parentGate.noPin')}</Notice>
        {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
      </Card>
    );
  }

  const check = () => {
    const result = checkParentPin(value.trim());
    setValue('');
    void reportPinCheck(getSupabase(), result);
    if (result === 'ok') return onPass();
    if (result === 'locked') setMessage(t('parentGate.locked', { count: lockMinutesLeft() }));
    else
      setMessage(
        t('parentGate.wrong', { count: MAX_TRIES - useParentPinStore.getState().failures }),
      );
  };
  const locked = lockMinutesLeft() > 0;

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t('parentGate.title')}</AppText>
      <AppText color={colors.mutedStrong}>{t('parentGate.enterPin')}</AppText>
      <TextField
        label={t('parentGate.pin')}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        editable={!locked}
      />
      {message || locked ? (
        <AppText variant="caption" color={colors.accent}>
          {locked ? t('parentGate.locked', { count: lockMinutesLeft() }) : message}
        </AppText>
      ) : null}
      <Button
        label={t('parentGate.continue')}
        disabled={locked || !isValidPin(value.trim())}
        onPress={check}
      />
      <TextLink tone="accent" label={t('pinReset.forgot')} onPress={() => setResetting(true)} />
      {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
    </Card>
  );
}

/** Creates or replaces the parent PIN (owner's own profile only). */
export function ParentPinSetup({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState(false);

  const save = () => {
    if (pin !== again || !setParentPin(pin)) {
      setError(true);
      setAgain('');
      return;
    }
    onDone();
  };

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t('parentGate.setupTitle')}</AppText>
      <AppText color={colors.mutedStrong}>{t('parentGate.setupBody')}</AppText>
      <TextField
        label={t('parentGate.newPin')}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
      />
      <TextField
        label={t('parentGate.repeatPin')}
        value={again}
        onChangeText={setAgain}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
      />
      {error ? (
        <AppText variant="caption" color={colors.accent}>
          {t('parentGate.mismatch')}
        </AppText>
      ) : null}
      <Button
        label={t('parentGate.savePin')}
        disabled={!isValidPin(pin) || again.length !== PIN_LENGTH}
        onPress={save}
      />
      {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
    </Card>
  );
}

/**
 * Forgotten PIN (Phase 12): a code to the account owner's email signs them in
 * again, then they set a new PIN. A child can't pass it without the owner's
 * inbox.
 */
export function ParentPinReset({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'intro' | 'code' | 'new'>('intro');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const email = ownerEmail();

  if (step === 'new')
    return (
      <ParentPinSetup
        onDone={() => {
          void clearPinLock(getSupabase());
          onDone();
        }}
        onCancel={onCancel}
      />
    );

  const send = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendPinResetCode(getSupabase());
    setBusy(false);
    if (result === 'sent') setStep('code');
    else setMessage(t(`pinReset.errors.${result}`));
  };

  const verify = async () => {
    setBusy(true);
    setMessage(null);
    const result = await verifyPinResetCode(getSupabase(), code);
    setBusy(false);
    if (result === 'ok') setStep('new');
    else setMessage(t(`pinReset.errors.${result}`));
  };

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t('pinReset.title')}</AppText>
      {!email ? (
        <Notice>{t('pinReset.errors.no_account')}</Notice>
      ) : step === 'intro' ? (
        <>
          <AppText color={colors.mutedStrong}>
            {t('pinReset.body', { email: maskEmail(email) })}
          </AppText>
          <Button label={t('pinReset.send')} loading={busy} onPress={send} />
        </>
      ) : (
        <>
          <AppText color={colors.mutedStrong}>
            {t('pinReset.sent', { email: maskEmail(email) })}
          </AppText>
          <TextField
            label={t('pinReset.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={10}
          />
          <Button
            label={t('pinReset.verify')}
            loading={busy}
            disabled={code.trim().length < 6}
            onPress={verify}
          />
        </>
      )}
      {message ? (
        <AppText variant="caption" color={colors.accent}>
          {message}
        </AppText>
      ) : null}
      <Button variant="ghost" label={t('common.back')} onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
