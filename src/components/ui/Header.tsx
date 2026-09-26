import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, sizes, spacing } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export type HeaderProps = {
  title?: string;
  /** Small uppercase line above the title (e.g. "Step 2 of 5"). */
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function Header({ title, eyebrow, onBack, right }: HeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton icon="chevron-left" accessibilityLabel={t('common.back')} onPress={onBack} />
        ) : null}
      </View>
      <View style={styles.center}>
        {eyebrow ? (
          <AppText variant="caption" color={colors.muted} style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        {title ? (
          <AppText variant="h3" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  side: { width: sizes.touchTarget, alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
