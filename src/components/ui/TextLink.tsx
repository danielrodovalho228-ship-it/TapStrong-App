import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { sizes, useColors } from '@/theme';

import { AppText } from './AppText';

export type TextLinkProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  tone?: 'ink' | 'accent';
};

/** Underlined text action ("I already have an account", "Edit"). */
export function TextLink({ label, tone = 'ink', ...rest }: TextLinkProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      {...rest}
    >
      <AppText
        variant="bodyStrong"
        color={tone === 'accent' ? colors.accentText : colors.ink}
        style={styles.text}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
  text: { textDecorationLine: 'underline' },
});
