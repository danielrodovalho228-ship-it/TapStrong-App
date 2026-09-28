import { Pressable, View } from 'react-native';

import { colors, makeStyles, sizes, spacing } from '@/theme';

import { AppText } from './AppText';

export type ToggleRowProps = {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/**
 * Setting row with a switch (mockup 16). The whole row is one switch
 * (QA R5 P2): a single focus stop with its name and state (aria-checked on
 * web), and a target far bigger than 44 px. The track is drawn, not native.
 */
export function ToggleRow({ label, detail, value, onChange }: ToggleRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {detail ? (
          <AppText variant="caption" color={colors.mutedStrong}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget + spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: spacing.xxs },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.ink },
  trackOff: { backgroundColor: colors.line },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
}));
