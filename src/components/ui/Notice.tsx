import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors, fonts, makeStyles, radius, spacing, useColors } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NoticeProps = {
  title?: string;
  children?: ReactNode;
  /**
   * safety: teal tint (trust). warning: accent outline (doctor notice).
   * neutral: plain surface, for information like "not found" (Phase 21).
   */
  tone?: 'safety' | 'warning' | 'neutral';
  icon?: boolean;
};

export function Notice({ title, children, tone = 'safety', icon = false }: NoticeProps) {
  const colors = useColors();
  const styles = useStyles();
  const warning = tone === 'warning';
  const neutral = tone === 'neutral';
  const color = warning ? colors.accentText : neutral ? colors.mutedStrong : colors.teal;
  return (
    <View
      accessibilityRole={warning ? 'alert' : undefined}
      style={[styles.box, warning ? styles.warning : neutral ? styles.neutral : styles.safety]}
    >
      {icon ? <Icon name="alert" color={color} /> : null}
      <View style={styles.text}>
        {title ? (
          <AppText variant="label" color={color} style={styles.title}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText color={warning || neutral ? colors.ink : colors.teal}>{children}</AppText>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  safety: { backgroundColor: colors.tealTint },
  warning: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accent },
  // A visible edge: the light line token was ~1.2:1 on white (QA R9 P2).
  neutral: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.mutedStrong },
  text: { flex: 1, gap: spacing.xs },
  title: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.heading },
}));
