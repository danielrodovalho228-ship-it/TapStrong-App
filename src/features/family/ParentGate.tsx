import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Notice, TextField, TextLink } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { spacing, useColors } from '@/theme';

import { familyAvailable } from '@/lib/features';

import { isValidPin, lockMinutesLeft, MAX_TRIES, PIN_LENGTH, useParentPinStore } from './parentPin';
import { pullPinStatus, savePin, verifyPin } from './pinLockout';
import { useAccountStore } from '../account/store';

import {
  maskEmail,
  ownerEmail,
  resolveOwnerAuth,
  sendPinResetCode,
  verifyPinResetCode,
} from './pinReset';
import { isOwnerProfile, useOwnerIdentityStore } from './ownerIdentity';
import { useSecondsLeft } from '@/lib/useSecondsLeft';

import { codeLockMinutesLeft, codeWaitSeconds, useResetCodeStore } from './resetCodeLock';
import { activeProfile, useFamilyStore } from './store';

/**
 * Parent gate (QA B-01, B-03, R2-05): owner-only actions on a child or teen
 * profile ask for the parent PIN, with a 15-minute lockout after 5 wrong
 * tries (also counted on the account when online). Without a PIN, only the
 * owner's own profile may create one; a child profile is told to ask a parent.
 */
/** `onPass` gets the PIN that passed, so a PIN change can prove it (S2-P2-2). */
export function ParentGate({
  onPass,
  onCancel,
}: {
  onPass: (pin?: string) => void;
  onCancel?: () => void;
}) {
  // The web can't keep a PIN safe: family profiles are mobile-only for now
  // (security round 1, S1-03).
  if (!familyAvailable()) return <FamilyMobileOnly onCancel={onCancel} />;
  return <ParentGateInner onPass={onPass} onCancel={onCancel} />;
}

/** "Family profiles are available in the mobile app" (web, S1-03). */
export function FamilyMobileOnly({ onCancel }: { onCancel?: () => void }) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <Notice>{t('family.mobileOnly')}</Notice>
      {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
    </Card>
  );
}

function ParentGateInner({
  onPass,
  onCancel,
}: {
  onPass: (pin?: string) => void;
  onCancel?: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  // A PIN on this phone or on the account (a new phone learns it from the server).
  const hasPin = useParentPinStore((s) => !!s.hash || s.serverHasPin);
  const [busy, setBusy] = useState(false);
  const active = useFamilyStore(activeProfile);
  const ownerId = useOwnerIdentityStore((s) => s.ownerId);
  const activeId = useOwnerIdentityStore((s) => s.activeId);
  const owner = isOwnerProfile(active, { ownerId, activeId });
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState<false | 'reset' | 'create'>(false);
  const accountSaved = useAccountStore((s) => s.saved);
  // Whether the account has a PIN, and its lock, from the server (S1-03).
  const [, setSynced] = useState(0);
  useEffect(() => {
    void pullPinStatus(getSupabase()).then(() => setSynced((n) => n + 1));
  }, []);

  // A correct PIN proves the owner's profile is really the active one: an
  // upgraded phone with no secure active id records it here (QA R6-05).
  const pass = (pin?: string) => {
    const identity = useOwnerIdentityStore.getState();
    if (!identity.activeId && active && active.id === identity.ownerId && active.kind === 'self')
      identity.setActive(active.id);
    onPass(pin);
  };

  // Forgotten PIN: the owner proves it with an email code (Phase 12). With no
  // PIN yet on an unproven profile (an upgraded phone), the same email code
  // lets the owner create one, so nobody is locked out (QA R7 P2).
  if (resetting)
    return (
      <ParentPinReset
        creating={resetting === 'create'}
        onDone={() => pass()}
        onCancel={() => setResetting(false)}
      />
    );

  const canCreate = accountSaved || !!ownerEmail();
  if (!hasPin) {
    return owner ? (
      <ParentPinSetup onDone={() => onPass()} onCancel={onCancel} />
    ) : (
      <Card style={styles.card}>
        <AppText variant="h3">{t('parentGate.title')}</AppText>
        {/* "Create", not "reset": there is no PIN yet (QA R8 P2). */}
        <Notice>{t(canCreate ? 'parentGate.noPinCreate' : 'parentGate.noPin')}</Notice>
        {canCreate ? (
          <Button
            variant="secondary"
            label={t('parentGate.createWithEmail')}
            onPress={() => setResetting('create')}
          />
        ) : null}
        {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
      </Card>
    );
  }

  const check = async () => {
    const pin = value.trim();
    setValue('');
    setBusy(true);
    // The server decides with a saved account; the phone's copy only offline.
    const result = await verifyPin(getSupabase(), pin);
    setBusy(false);
    if (result === 'ok') return pass(pin);
    if (result === 'offline') setMessage(t('parentGate.offline'));
    else if (result === 'no_pin') setMessage(t('parentGate.noPinCreate'));
    else if (result === 'locked') setMessage(t('parentGate.locked', { count: lockMinutesLeft() }));
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
        <AppText variant="caption" color={colors.accentText}>
          {locked ? t('parentGate.locked', { count: lockMinutesLeft() }) : message}
        </AppText>
      ) : null}
      <Button
        label={t('parentGate.continue')}
        loading={busy}
        disabled={locked || !isValidPin(value.trim())}
        onPress={() => void check()}
      />
      <TextLink tone="accent" label={t('pinReset.forgot')} onPress={() => setResetting('reset')} />
      {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
    </Card>
  );
}

/**
 * Creates or replaces the parent PIN (owner's own profile only). Replacing
 * it sends the current PIN (`oldPin`, from the gate just passed) or uses the
 * window of a fresh email code (security round 2, S2-P2-2).
 */
export function ParentPinSetup({
  onDone,
  onCancel,
  oldPin,
}: {
  onDone: () => void;
  onCancel?: () => void;
  oldPin?: string;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The server wants proof first (an account that already manages minors):
  // the email code opens its window, then the PIN is saved (S1-03).
  const [viaEmail, setViaEmail] = useState(false);

  if (viaEmail)
    return (
      <ParentPinReset creating onDone={onDone} onCancel={onCancel ?? (() => setViaEmail(false))} />
    );

  const save = async () => {
    if (pin !== again || !isValidPin(pin)) {
      setError(t('parentGate.mismatch'));
      setAgain('');
      return;
    }
    setBusy(true);
    const result = await savePin(getSupabase(), pin, oldPin);
    setBusy(false);
    if (result === 'ok') return onDone();
    setAgain('');
    // The PIN changed elsewhere meanwhile: prove it with the email code.
    if (result === 'reauth' || result === 'wrong') return setViaEmail(true);
    if (result === 'locked') return setError(t('parentGate.locked', { count: lockMinutesLeft() }));
    setError(t(result === 'offline' ? 'parentGate.offlineSave' : 'parentGate.mismatch'));
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
        <AppText variant="caption" color={colors.accentText}>
          {error}
        </AppText>
      ) : null}
      <Button
        label={t('parentGate.savePin')}
        loading={busy}
        disabled={!isValidPin(pin) || again.length !== PIN_LENGTH}
        onPress={() => void save()}
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
export function ParentPinReset({
  onDone,
  onCancel,
  creating = false,
}: {
  onDone: () => void;
  onCancel: () => void;
  /** No PIN yet: the same email code creates the first one (QA R8 P2 wording). */
  creating?: boolean;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const [step, setStep] = useState<'intro' | 'code' | 'new'>('intro');
  const lockedUntil = useResetCodeStore((s) => s.lockedUntil);
  // "Send the code" stays off during the minute between codes and the lock (S2-P2-5).
  const lastCodeAt = useResetCodeStore((s) => s.lastCodeAt);
  const waitLeft = useSecondsLeft(codeWaitSeconds, lastCodeAt);
  const sendLock = useSecondsLeft(() => codeLockMinutesLeft() * 60, lockedUntil);
  // The code passed but the phone lost its session (QA R10-03).
  const [signedOut, setSignedOut] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Only the owner's email from the secure record (QA R8-05); an older phone
  // learns it from the signed-in account.
  const [email, setEmail] = useState(ownerEmail);
  const [looking, setLooking] = useState(!email);
  useEffect(() => {
    if (email) return;
    void resolveOwnerAuth(getSupabase()).then((auth) => {
      setEmail(auth?.email ?? null);
      setLooking(false);
    });
  }, [email]);

  if (step === 'new')
    return (
      <View style={styles.card}>
        {signedOut ? <Notice tone="warning">{t('pinReset.signedOut')}</Notice> : null}
        {/* The server clears the lock itself when it saves the new PIN. */}
        <ParentPinSetup onDone={onDone} onCancel={onCancel} />
      </View>
    );

  const send = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendPinResetCode(getSupabase());
    setBusy(false);
    if (result === 'sent') setStep('code');
    else if (result === 'wait') setMessage(t('pinReset.errors.wait', { count: codeWaitSeconds() }));
    else setMessage(t(`pinReset.errors.${result}`));
  };

  const verify = async () => {
    setBusy(true);
    setMessage(null);
    const result = await verifyPinResetCode(getSupabase(), code);
    setBusy(false);
    if (result === 'ok' || result === 'ok_signed_out') {
      setSignedOut(result === 'ok_signed_out');
      setStep('new');
    } else if (result === 'locked') setMessage(null);
    else setMessage(t(`pinReset.errors.${result}`));
  };
  // Wrong codes lock only the code, never the PIN (R10 decision 1).
  const codeLocked = lockedUntil ? codeLockMinutesLeft() : 0;

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t(creating ? 'pinReset.createTitle' : 'pinReset.title')}</AppText>
      {looking ? null : !email ? (
        <Notice>{t('pinReset.errors.no_account')}</Notice>
      ) : step === 'intro' ? (
        <>
          <AppText color={colors.mutedStrong}>
            {t(creating ? 'pinReset.createBody' : 'pinReset.body', { email: maskEmail(email) })}
          </AppText>
          <Button
            label={t('pinReset.send')}
            loading={busy}
            disabled={waitLeft > 0 || sendLock > 0}
            onPress={send}
          />
          {sendLock > 0 || waitLeft > 0 ? (
            <AppText variant="caption" color={colors.mutedStrong}>
              {sendLock > 0
                ? t('pinReset.errors.locked', { count: Math.ceil(sendLock / 60) })
                : t('pinReset.errors.wait', { count: waitLeft })}
            </AppText>
          ) : null}
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
            disabled={codeLocked > 0 || code.trim().length < 6}
            onPress={verify}
          />
        </>
      )}
      {message || (step === 'code' && codeLocked > 0) ? (
        <AppText variant="caption" color={colors.accentText}>
          {step === 'code' && codeLocked > 0
            ? t('pinReset.errors.locked', { count: codeLocked })
            : message}
        </AppText>
      ) : null}
      <Button variant="ghost" label={t('common.back')} onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
