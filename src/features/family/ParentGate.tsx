import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Notice, TextField } from '@/components/ui';
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
import { activeProfile, useFamilyStore } from './store';

/**
 * Parent gate (QA B-01, B-03, R2-05): owner-only actions on a child or teen
 * profile ask for the parent PIN, with a 15-minute lockout after 5 wrong
 * tries. Without a PIN, only the owner's own profile may create one; a child
 * profile is told to ask a parent.
 */
export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const hasPin = useParentPinStore((s) => !!s.hash);
  const active = useFamilyStore(activeProfile);
  const owner = !active || active.kind === 'self';
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
