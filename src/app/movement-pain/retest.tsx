import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Header, Screen } from '@/components/ui';
import type { MovementKey } from '@/features/movement/catalog';
import { useMovementPainStore } from '@/features/movement/store';
import { movementExample, movementName, reportTitle, ScoreChips } from '@/features/movement/ui';
import { clock } from '@/lib/clock';
import { colors, spacing } from '@/theme';

/** Weekly retest of the movements that hurt (SPEC §8). */
export default function PainRetestScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const report = useMovementPainStore((s) => s.reports.find((r) => r.id === id));
  const addRetest = useMovementPainStore((s) => s.addRetest);
  const [scores, setScores] = useState<Partial<Record<MovementKey, number>>>({});
  if (!report) return <Redirect href="/restrictions" />;
  const ready = report.painful.every((k) => scores[k] != null);

  return (
    <Screen
      header={
        <Header
          onBack={() => router.back()}
          eyebrow={reportTitle(t, report)}
          title={t('movementPain.retest.title')}
        />
      }
      footer={
        <Button
          label={t('movementPain.retest.save')}
          disabled={!ready}
          onPress={() => {
            addRetest(report.id, { at: clock.now().toISOString(), scores });
            router.back();
          }}
        />
      }
    >
      <AppText color={colors.mutedStrong}>{t('movementPain.retest.body')}</AppText>
      {report.painful.map((key) => (
        <Card key={key} style={styles.card}>
          <AppText variant="bodyStrong">{movementName(t, key)}</AppText>
          <AppText variant="caption" color={colors.mutedStrong}>
            {movementExample(t, key)}
          </AppText>
          <ScoreChips
            value={scores[key] ?? null}
            onChange={(v) => setScores({ ...scores, [key]: v })}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.sm } });
