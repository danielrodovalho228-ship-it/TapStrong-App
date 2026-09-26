import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, sizes, spacing } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export type HeaderProps = {
  title?: string;
  /** Small uppercase line (e.g. "Step 1 of 7"), beside the back button or under the title. */
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
};

/** Left-aligned top bar, as in the mockups: outlined back box, eyebrow, optional title. */
export function Header({ title, eyebrow, onBack, right }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {onBack ? (
        <IconButton
          icon="chevron-left"
          variant="outlined"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
        />
      ) : null}
      <View style={styles.text}>
        {/* With a title, the eyebrow sits under it (mockup 03); alone, it stands by the back button (mockup 02). */}
        {title ? (
          <AppText variant="h3" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {eyebrow ? (
          <AppText variant="caption" color={colors.muted} style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: { flex: 1 },
  right: { alignItems: 'flex-end' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.8 },
});
