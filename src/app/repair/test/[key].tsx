import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Header, IconButton, Notice, Screen } from '@/components/ui';
import { useProgressStore, type RepairResult } from '@/features/progress/store';
import { useRepair } from '@/features/repair/useRepair';
import { useNow } from '@/features/workout/components/TimerRing';
import { clockText } from '@/features/workout/format';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { colors, fonts, sizes, spacing } from '@/theme';

/** Guided Repair test (SPEC §9 /repair/test/[key]): timer, left/right. */
export default function RepairTestScreen() {
  const { t } = useTranslation();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { tests } = useRepair();
  const save = useProgressStore((s) => s.saveRepairResult);
  const test = tests.find((x) => x.key === key);
  const existing = useProgressStore((s) => s.repairResults.find((r) => r.testKey === key));
  const [value, setValue] = useState(existing?.value ?? 0);
  const [left, setLeft] = useState(existing?.left ?? 0);
  const [right, setRight] = useState(existing?.right ?? 0);
  const [passLeft, setPassLeft] = useState<boolean | undefined>(existing?.passLeft);
  const [passRight, setPassRight] = useState<boolean | undefined>(existing?.passRight);
  if (!test) return <Redirect href="/repair" />;

  const name = t(`repair.tests.${test.key as 'squat'}.name`);
  const ready =
    test.kind === 'sides_pass'
      ? passLeft !== undefined && passRight !== undefined
      : test.kind === 'sides_hold'
        ? left > 0 && right > 0
        : value > 0;

  const done = () => {
    const result: RepairResult = {
      testKey: test.key,
      testedAt: clock.now().toISOString(),
      ...(test.kind === 'sides_pass'
        ? { passLeft, passRight }
        : test.kind === 'sides_hold'
          ? { left, right }
          : { value }),
    };
    save(result);
    track('repair_test_completed');
    router.back();
  };

  return (
    <Screen
      header={<Header onBack={() => router.back()} eyebrow={t('repair.eyebrow')} title={name} />}
      footer={<Button label={t('repair.saveResult')} disabled={!ready} onPress={done} />}
    >
      <AppText color={colors.mutedStrong}>{t(`repair.tests.${test.key as 'squat'}.how`)}</AppText>
      <Notice>{t('repair.safety')}</Notice>

      {test.kind === 'reps' ? (
        <Card style={styles.card}>
          <SecondsTimer
            label={t('repair.timer', { seconds: test.seconds })}
            limit={test.seconds}
            value={0}
            onChange={() => undefined}
            countdown
          />
          <Counter label={t('repair.reps')} value={value} onChange={setValue} />
        </Card>
      ) : null}

      {test.kind === 'hold' ? (
        <Card style={styles.card}>
          <SecondsTimer
            label={t('repair.hold')}
            limit={test.seconds}
            value={value}
            onChange={setValue}
          />
        </Card>
      ) : null}

      {test.kind === 'sides_hold' ? (
        <>
          <Card style={styles.card}>
            <SecondsTimer
              label={t('repair.sides.left')}
              limit={test.seconds}
              value={left}
              onChange={setLeft}
            />
          </Card>
          <Card style={styles.card}>
            <SecondsTimer
              label={t('repair.sides.right')}
              limit={test.seconds}
              value={right}
              onChange={setRight}
            />
          </Card>
        </>
      ) : null}

      {test.kind === 'sides_pass' ? (
        <Card style={styles.card}>
          {(['left', 'right'] as const).map((side) => {
            const current = side === 'left' ? passLeft : passRight;
            const set = side === 'left' ? setPassLeft : setPassRight;
            return (
              <View key={side} style={styles.passRow}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {t(`repair.sides.${side}`)}
                </AppText>
                <Button
                  fullWidth={false}
                  variant={current === true ? 'primary' : 'secondary'}
                  label={t('repair.reached')}
                  accessibilityState={{ selected: current === true }}
                  onPress={() => set(true)}
                />
                <Button
                  fullWidth={false}
                  variant={current === false ? 'primary' : 'secondary'}
                  label={t('repair.limited')}
                  accessibilityState={{ selected: current === false }}
                  onPress={() => set(false)}
                />
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

/** Start/stop timer; the result can be adjusted by hand. */
function SecondsTimer({
  label,
  limit,
  value,
  onChange,
  countdown = false,
}: {
  label: string;
  limit?: number;
  value: number;
  onChange: (v: number) => void;
  countdown?: boolean;
}) {
  const { t } = useTranslation();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(startedAt ? 250 : 5000);
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : null;
  const capped = elapsed != null && limit ? Math.min(elapsed, limit) : elapsed;
  const shown = countdown ? Math.max(0, (limit ?? 0) - (capped ?? 0)) : (capped ?? value);

  const stop = () => {
    if (!countdown && capped != null) onChange(capped);
    setStartedAt(null);
  };

  return (
    <View style={styles.timer}>
      <AppText variant="caption" style={styles.caps}>
        {label}
      </AppText>
      <AppText variant="display" accessibilityLabel={t('repair.time', { time: clockText(shown) })}>
        {clockText(shown)}
      </AppText>
      <Button
        variant={startedAt ? 'accent' : 'secondary'}
        label={startedAt ? t('repair.stop') : t('repair.start')}
        onPress={() => (startedAt ? stop() : setStartedAt(clock.now().getTime()))}
      />
      {!countdown ? (
        <Counter label={t('repair.seconds')} value={value} onChange={onChange} />
      ) : null}
    </View>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.counter}>
      <AppText variant="label" style={styles.flex}>
        {label}
      </AppText>
      <IconButton
        icon="minus"
        variant="outlined"
        accessibilityLabel={t('workout.player.decrease', { label })}
        onPress={() => onChange(Math.max(0, value - 1))}
      />
      <View style={styles.value} accessible accessibilityLabel={`${label}: ${value}`}>
        <AppText variant="h1">{value}</AppText>
      </View>
      <IconButton
        icon="plus"
        variant="outlined"
        accessibilityLabel={t('workout.player.increase', { label })}
        onPress={() => onChange(Math.min(600, value + 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  timer: { gap: spacing.sm, alignItems: 'stretch' },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: fonts.headingSemi,
    color: colors.muted,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  value: { minWidth: 64, alignItems: 'center' },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
