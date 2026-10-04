import { Platform, Pressable, View } from 'react-native';

import { colors, makeStyles, sizes, spacing, useColors } from '@/theme';

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
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      // Space toggles a switch on the web keyboard, like Enter (QA R6 P2).
      {...(Platform.OS === 'web' ? { onKeyDown: spaceToggles(() => onChange(!value)) } : {})}
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
        <View
          style={[
            styles.thumb,
            value ? [styles.thumbOn, styles.thumbOnFill] : [styles.thumbOff, styles.thumbOffFill],
          ]}
        />
      </View>
    </Pressable>
  );
}

type KeyEvent = { key?: string; nativeEvent?: { key?: string }; preventDefault?: () => void };
const spaceToggles = (toggle: () => void) => (e: KeyEvent) => {
  if ((e.nativeEvent?.key ?? e.key) !== ' ') return;
  e.preventDefault?.();
  toggle();
};

const useStyles = makeStyles(() => ({
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
  // On is teal, unmistakable in both themes (Phase 32: a light track read as "on" when off).
  trackOn: { backgroundColor: colors.teal },
  // Off must read against the card too (≥ 3:1, QA R6 P2): an outlined track
  // with a dark thumb.
  trackOff: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.muted,
    padding: 1.5,
  },
  thumb: { width: 22, height: 22, borderRadius: 11 },
  thumbOnFill: { backgroundColor: colors.onTeal },
  thumbOffFill: { backgroundColor: colors.muted },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
}));
