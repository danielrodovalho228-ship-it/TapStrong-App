import { View } from 'react-native';

import { AppText, Icon, TextLink, type IconName } from '@/components/ui';
import { colors, makeStyles, spacing, useColors } from '@/theme';

/**
 * A drawn empty state (Phase 27, B3): never "No data". An icon in a soft
 * coral circle, one line that says what will appear, and one way to start.
 */
export function EmptyState({
  icon,
  title,
  action,
  testID = 'empty-state',
}: {
  icon: IconName;
  title: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.circle} aria-hidden>
        <Icon name={icon} size={32} color={c.accentText} />
      </View>
      <AppText variant="bodyStrong" style={styles.center}>
        {title}
      </AppText>
      {action ? <TextLink tone="accent" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
}));
