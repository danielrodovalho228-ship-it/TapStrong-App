import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Card, Chip, Header, Icon, Notice, Screen } from '@/components/ui';
import { useRehabRun } from '@/features/rehab/hooks';
import { AFFECTED_SIDES as SIDES, type AffectedSide } from '@/features/rehab/programs';
import { useRehabStore } from '@/features/rehab/store';
import { clock } from '@/lib/clock';
import { makeStyles, spacing, useColors } from '@/theme';

const RULES = ['followUp', 'noPain', 'load', 'painButton'] as const;

/**
 * The safety rules (Phase 30, §3): before the first session, with the
 * question "Which shoulder is affected?", and later from the "?" button.
 */
export default function RehabSafetyScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: 'start' | 'help' }>();
  const { minor, today } = useRehabRun(id);
  const start = useRehabStore((s) => s.start);
  const [side, setSide] = useState<AffectedSide | null>(null);
  const starting = mode === 'start';

  return (
    <Screen
      header={<Header onBack={() => router.back()} title={t('rehab.safety.title')} />}
      footer={
        starting ? (
          <Button
            label={t('rehab.safety.accept')}
            disabled={!side}
            onPress={() => {
              if (!side) return;
              start(id, side, today, clock.now().toISOString());
              router.replace({ pathname: '/rehab/[id]', params: { id } });
            }}
          />
        ) : (
          <Button
            variant="secondary"
            label={t('rehab.safety.close')}
            onPress={() => router.back()}
          />
        )
      }
    >
      {minor ? <Notice tone="warning">{t('rehab.minor')}</Notice> : null}
      <Card style={styles.card}>
        {RULES.map((k) => (
          <View key={k} style={styles.rule}>
            <Icon name={k === 'noPain' ? 'alert' : 'shield'} size={20} color={colors.teal} />
            <AppText style={styles.flex}>{t(`rehab.safety.${k}`)}</AppText>
          </View>
        ))}
      </Card>
      {starting ? (
        <Card style={styles.card}>
          <AppText variant="h3" accessibilityRole="header">
            {t('rehab.sideQuestion')}
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {SIDES.map((s) => (
              <Chip
                key={s}
                label={t(`rehab.sideOptions.${s}`)}
                selected={side === s}
                accessibilityRole="radio"
                accessibilityState={{ checked: side === s }}
                onPress={() => setSide(s)}
              />
            ))}
          </View>
          <AppText variant="caption" color={colors.mutedStrong}>
            {t('rehab.sideNote')}
          </AppText>
        </Card>
      ) : null}
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('rehab.educational')}
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  card: { gap: spacing.md },
  rule: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
