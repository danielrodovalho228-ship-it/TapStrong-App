import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { sizes, useColors } from '@/theme';

import { AppText } from './AppText';
import { noteTap } from '@/lib/usage';

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
      // Taps to the first set (Phase 27 "Measure"): a count, nothing else.
      onPressIn={(e) => {
        noteTap();
        rest.onPressIn?.(e);
      }}
    >
      <AppText
        variant="bodyStrong"
        // Links are ink in both tones: coral is for primary actions (QA R6 P2).
        // `tone` stays for emphasis (bolder underline).
        color={colors.ink}
        style={[styles.text, tone === 'accent' && styles.strong]}
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
  strong: { textDecorationStyle: 'solid', fontWeight: '700' },
});
