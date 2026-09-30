import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { noteTap } from '@/lib/usage';
import { colors, fonts, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

/**
 * The one action on Home (Phase 27, A2): "Train now · Back and biceps ·
 * 35 min", big, at the top. One tap opens the player. `large` is the 60+
 * version (teal, bigger type); `tone="calm"` is the easy-day option.
 */
export function StartHero({
  title,
  detail,
  eyebrow,
  onPress,
  large = false,
  testID = 'start-hero',
}: {
  title: string;
  detail?: string;
  eyebrow?: string;
  onPress: () => void;
  large?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const styles = useStyles();
  const fg = large ? colors.onTeal : colors.onAccent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
      onPress={onPress}
      onPressIn={noteTap}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        {
          backgroundColor: large ? colors.teal : pressed ? colors.accentPressed : colors.accent,
        },
        // A light "press in" (B2).
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.text}>
        {eyebrow ? (
          <AppText variant="caption" color={fg} style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant={large ? 'display' : 'h1'} color={fg}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant={large ? 'h3' : 'bodyStrong'} color={fg} style={styles.detail}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.play, large && styles.playLarge]} aria-hidden>
        <Icon name="play" size={large ? 36 : 28} color={large ? colors.teal : colors.accent} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: sizes.primaryButtonHeight * 2,
    padding: spacing.xl,
    borderRadius: radius.card,
  },
  large: { minHeight: sizes.primaryButtonHeight * 3, padding: spacing.xxl },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { flex: 1, gap: spacing.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: fonts.headingSemi },
  detail: { textTransform: 'none', fontFamily: fonts.bodySemi },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLarge: { width: 72, height: 72, borderRadius: 36 },
}));
