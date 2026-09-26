import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppModeStore } from '@/stores/app-mode';
import { colors, fontSizeFor, SENIOR_TYPE_BOOST, textVariants, type TextVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
  /** Forces a type-scale boost; defaults to the senior boost in senior mode. */
  boost?: number;
};

export function AppText({
  variant = 'body',
  color = colors.ink,
  boost,
  style,
  ...rest
}: AppTextProps) {
  const mode = useAppModeStore((s) => s.mode);
  const spec = textVariants[variant];
  const fontSize = fontSizeFor(variant, boost ?? (mode === 'senior' ? SENIOR_TYPE_BOOST : 0));

  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2}
      style={[
        styles.base,
        {
          color,
          fontFamily: spec.font,
          fontSize,
          lineHeight: Math.round(fontSize * spec.lineHeightRatio),
          letterSpacing: spec.letterSpacing,
          textTransform: spec.uppercase ? 'uppercase' : 'none',
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
