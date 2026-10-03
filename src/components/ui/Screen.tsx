import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, makeStyles, spacing } from '@/theme';

export type ScreenProps = {
  header?: ReactNode;
  children: ReactNode;
  /** Pinned under the scroll area (primary action, footnote). */
  footer?: ReactNode;
  scroll?: boolean;
  /** The footer floats over the end of the list instead of a bar (Phase 31, G). */
  floatingFooter?: boolean;
};

/** Standard screen frame: safe area, optional header, scrolling body, pinned footer. */
export function Screen({
  header,
  children,
  footer,
  scroll = true,
  floatingFooter = false,
}: ScreenProps) {
  const styles = useStyles();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        floatingFooter && footer ? styles.roomForFooter : null,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header}
        {body}
        {footer ? (
          <View style={[styles.footer, floatingFooter && styles.floating]} pointerEvents="box-none">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  floating: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
  roomForFooter: { paddingBottom: spacing.xxxl * 2 },
}));
