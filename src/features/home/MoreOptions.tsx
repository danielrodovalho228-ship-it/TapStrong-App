import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { makeStyles, sizes, spacing, useColors } from '@/theme';

/**
 * "More options", collapsed (Phase 27, A3): the less common choices stay one
 * tap away without competing with the screen's one main action.
 */
export function MoreOptions({
  children,
  label,
  testID = 'more-options',
}: {
  children: ReactNode;
  label?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const text = label ?? t('common.moreOptions');
  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
        style={styles.toggle}
      >
        <AppText variant="bodyStrong" color={colors.mutedStrong}>
          {text}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedStrong} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: sizes.touchTarget,
  },
  body: { gap: spacing.sm },
}));
