import { View, type ViewProps } from 'react-native';

import { colors, makeStyles, radius, spacing } from '@/theme';

export type CardTone = 'default' | 'safety' | 'dark';

export type CardProps = ViewProps & {
  tone?: CardTone;
};

export function Card({ tone = 'default', style, ...rest }: CardProps) {
  return <View style={[styles.base, styles[tone], style]} {...rest} />;
}

const styles = makeStyles(() => ({
  base: {
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  default: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  safety: { backgroundColor: colors.tealTint },
  dark: { backgroundColor: colors.dark.background },
}));
