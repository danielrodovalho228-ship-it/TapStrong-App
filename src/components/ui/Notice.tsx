import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NoticeProps = {
  title?: string;
  children?: ReactNode;
  /** safety: teal tint (trust). warning: accent outline (doctor notice). */
  tone?: 'safety' | 'warning';
  icon?: boolean;
};

export function Notice({ title, children, tone = 'safety', icon = false }: NoticeProps) {
  const warning = tone === 'warning';
  const color = warning ? colors.accent : colors.teal;
  return (
    <View
      accessibilityRole={warning ? 'alert' : undefined}
      style={[styles.box, warning ? styles.warning : styles.safety]}
    >
      {icon ? <Icon name="alert" color={color} /> : null}
      <View style={styles.text}>
        {title ? (
          <AppText
            variant="label"
            color={warning ? colors.accent : colors.teal}
            style={styles.title}
          >
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText color={warning ? colors.ink : colors.teal}>{children}</AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  safety: { backgroundColor: colors.tealTint },
  warning: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  text: { flex: 1, gap: spacing.xs },
  title: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.heading },
});
