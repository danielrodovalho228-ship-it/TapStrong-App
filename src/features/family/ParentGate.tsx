import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, TextField } from '@/components/ui';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

/** A task an adult can do and a young child can't (store "parental gate" rule). */
export function gateQuestion(seed: number): { a: number; b: number; answer: number } {
  const a = 6 + (seed % 4);
  const b = 7 + (Math.floor(seed / 4) % 3);
  return { a, b, answer: a * b };
}

/**
 * Parent gate (QA B-01, B-03): owner-only actions on a child's profile ask a
 * multiplication written in words, so a child can't tap through.
 */
export function ParentGate({ onPass, onCancel }: { onPass: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  const q = useMemo(() => gateQuestion(clock.now().getMinutes()), []);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const check = () => {
    if (Number(value.trim()) === q.answer) onPass();
    else {
      setWrong(true);
      setValue('');
    }
  };

  return (
    <Card style={styles.card}>
      <AppText variant="h3">{t('parentGate.title')}</AppText>
      <AppText color={colors.mutedStrong}>
        {t('parentGate.question', {
          a: t(`parentGate.numbers.${q.a}` as 'parentGate.numbers.6'),
          b: t(`parentGate.numbers.${q.b}` as 'parentGate.numbers.7'),
        })}
      </AppText>
      <TextField
        label={t('parentGate.answer')}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
      />
      {wrong ? (
        <AppText variant="caption" color={colors.accent}>
          {t('parentGate.wrong')}
        </AppText>
      ) : null}
      <Button label={t('parentGate.continue')} disabled={!value.trim()} onPress={check} />
      {onCancel ? <Button variant="ghost" label={t('common.back')} onPress={onCancel} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
