import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, makeStyles, spacing } from '@/theme';

import type { WeekBar } from '../stats';

const HEIGHT = 140;

/** Weekly sets bars; the current week in accent (mockup 18). */
export function WeekChart({ bars }: { bars: WeekBar[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...bars.map((b) => b.sets));
  const summary = bars
    .map((b, i) => t('progress.chart.barLabel', { n: i + 1, count: b.sets }))
    .join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={styles.plot}>
        {bars.map((b, i) => {
          const current = i === bars.length - 1;
          return (
            <View key={b.weekStart} style={styles.col}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(2, (b.sets / max) * HEIGHT) },
                  current ? styles.barOn : styles.barOff,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis} />
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <AppText
            key={b.weekStart}
            variant="caption"
            color={i === bars.length - 1 ? colors.accentText : colors.muted}
            style={styles.label}
          >
            {t('progress.chart.week', { n: i + 1, count: b.sets })}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  plot: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barOn: { backgroundColor: colors.accent },
  barOff: { backgroundColor: colors.line },
  axis: { height: 1.5, backgroundColor: colors.ink },
  labels: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  label: { flex: 1, textAlign: 'center' },
}));
