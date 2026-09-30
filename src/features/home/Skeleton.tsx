import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

import { colors, makeStyles, radius, spacing } from '@/theme';
import { useReducedMotion } from '@/lib/motion';

/**
 * Loading placeholder with the shape of the content (Phase 27, B3): the
 * coral-tinted blocks breathe softly; no spinner and no blank white screen.
 * With "reduce motion" on, they stay still.
 */
export function Skeleton({ variant }: { variant: 'player' | 'home' | 'list' }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const blocks =
    variant === 'player'
      ? [styles.media, styles.title, styles.line, styles.big]
      : variant === 'home'
        ? [styles.big, styles.line, styles.media]
        : [styles.row, styles.row, styles.row, styles.row];
  return (
    <View testID={`skeleton-${variant}`} accessibilityLabel="…" style={styles.wrap}>
      {blocks.map((b, i) => (
        <Animated.View key={i} style={[styles.block, b, { opacity: pulse }]} />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.lg },
  block: { backgroundColor: colors.primarySoft, borderRadius: radius.card },
  media: { height: 220 },
  title: { height: 36, width: '70%' },
  line: { height: 18, width: '90%' },
  big: { height: 96 },
  row: { height: 64 },
}));
