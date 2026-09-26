import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

export type StepProgressProps = { current: number; total: number; accessibilityLabel: string };

/** Segmented progress bar: done = ink, current = accent, upcoming = line (mockup 03). */
export function StepProgress({ current, total, accessibilityLabel }: StepProgressProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={styles.row}
    >
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const color = step < current ? colors.ink : step === current ? colors.accent : colors.line;
        return <View key={step} style={[styles.segment, { backgroundColor: color }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs + 2 },
  segment: { flex: 1, height: 4, borderRadius: 1 },
});
