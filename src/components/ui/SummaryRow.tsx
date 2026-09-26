import { StyleSheet, View } from 'react-native';

import { colors, fonts, spacing } from '@/theme';

import { AppText } from './AppText';
import { TextLink } from './TextLink';

export type SummaryRowProps = {
  label: string;
  value: string;
  editLabel: string;
  onEdit?: () => void;
  last?: boolean;
};

/** Labeled value with an Edit link (mockup 05). */
export function SummaryRow({ label, value, editLabel, onEdit, last }: SummaryRowProps) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <View style={styles.text}>
        <AppText variant="caption" color={colors.muted} style={styles.label}>
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
      {onEdit ? (
        <TextLink
          label={editLabel}
          tone="accent"
          onPress={onEdit}
          accessibilityLabel={`${editLabel}: ${label}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  text: { flex: 1, gap: spacing.xxs },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: fonts.headingSemi,
  },
});
