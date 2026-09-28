import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useAppModeStore } from '@/stores/app-mode';
import { colors, fontSizeFor, fonts, radius, SENIOR_TYPE_BOOST, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

export type TextFieldProps = TextInputProps & {
  label?: string;
  /** Short unit after the value, e.g. "ft", "lb". */
  suffix?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, suffix, style, accessibilityLabel, ...rest },
  ref,
) {
  const mode = useAppModeStore((s) => s.mode);
  const fontSize = fontSizeFor('body', mode === 'senior' ? SENIOR_TYPE_BOOST : 0);
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" color={colors.mutedStrong}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.field}>
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={colors.muted}
          style={[styles.input, { fontSize }, style]}
          {...rest}
        />
        {suffix ? (
          <AppText color={colors.muted} style={styles.suffix}>
            {suffix}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Grows in a row but never collapses in a column (QA R4 P2: search under the body map).
  wrap: { gap: spacing.xs, flexGrow: 1, flexShrink: 1 },
  field: {
    minHeight: sizes.primaryButtonHeight - 6,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  suffix: { marginLeft: spacing.xs },
});
