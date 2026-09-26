import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

/** Label with − value + controls (mockup 09 quantities). */
export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const { t } = useTranslation();
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <View style={styles.row}>
      <AppText variant="bodyStrong" style={styles.label}>
        {label}
      </AppText>
      <IconButton
        icon="minus"
        variant="outlined"
        accessibilityLabel={t('goalsSheet.decrease', { what: label })}
        disabled={value <= min}
        onPress={() => set(value - 1)}
      />
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          set(e.nativeEvent.actionName === 'increment' ? value + 1 : value - 1)
        }
        style={styles.value}
      >
        <AppText variant="h2">{value}</AppText>
      </View>
      <IconButton
        icon="plus"
        variant="outlined"
        accessibilityLabel={t('goalsSheet.increase', { what: label })}
        disabled={value >= max}
        onPress={() => set(value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  label: { flex: 1 },
  value: { minWidth: 36, alignItems: 'center' },
});
