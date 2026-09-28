import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { AppText } from './AppText';

/** Coach line with the left rule (mockup 03). */
export function CoachMessage({ text, children }: { text?: string; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.coach}>
      {text ? <AppText variant="body">{text}</AppText> : null}
      {children}
    </View>
  );
}

/** User answer bubble, right aligned, ink background. */
export function UserMessage({ text }: { text: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.userWrap}>
      <View style={styles.user}>
        <AppText color={colors.onInk}>{text}</AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  coach: {
    borderLeftWidth: 3,
    borderLeftColor: colors.ink,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  userWrap: { alignItems: 'flex-end', paddingLeft: spacing.xxxl },
  user: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    borderBottomRightRadius: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
}));
