import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { MuscleAreaMap } from '@/features/bodymap/components/MuscleAreaMap';
import type { BodySex } from '@/features/bodymap/images';
import type { BodyBand } from '@/features/profile/age';
import { useReducedMotion } from '@/lib/motion';
import { fonts, makeStyles, spacing, useColors } from '@/theme';

import { feel } from '../feel';

/** Milliseconds between two muscles lighting up; 60+ get it slower. */
export const LIGHT_STEP_MS = 150;
export const LIGHT_STEP_SENIOR_MS = 320;

/**
 * The end-of-workout signature (Phase 27, B1): the muscles worked light up
 * on the body one by one, with a light haptic each, then the big
 * "8 muscles · 42 min". Painted areas, front and back side by side, primary
 * strong and secondary light (Phase 29, A4). With "reduce motion" on, the
 * final state shows straight away. 60+: slower, and bigger type.
 */
export function LightUpBody({
  band,
  sex,
  primary,
  secondary,
  order,
  minutes,
  senior = false,
  maxHeight = 320,
}: {
  band: BodyBand;
  sex: BodySex;
  /** The muscles the exercises worked as primary / as secondary. */
  primary: string[];
  secondary: string[];
  /** The muscles worked, in the order they light up. */
  order: string[];
  minutes: number;
  senior?: boolean;
  maxHeight?: number;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(0);
  const count = reduced ? order.length : lit;

  useEffect(() => {
    if (reduced || lit >= order.length) return;
    const id = setTimeout(
      () => {
        feel.light();
        setLit((n) => n + 1);
      },
      senior ? LIGHT_STEP_SENIOR_MS : LIGHT_STEP_MS,
    );
    return () => clearTimeout(id);
  }, [lit, order.length, reduced, senior]);

  const unlit = new Set(order.slice(count));
  const done = count >= order.length;

  return (
    <View style={styles.wrap} testID={done ? 'light-up-done' : 'light-up-running'}>
      <MuscleAreaMap
        band={band}
        sex={sex}
        primary={primary.filter((k) => !unlit.has(k))}
        secondary={secondary.filter((k) => !unlit.has(k))}
        maxHeight={maxHeight}
      />
      <View style={[styles.total, !done && styles.hidden]} aria-hidden={!done}>
        <AppText
          variant={senior ? 'display' : 'h1'}
          style={styles.num}
          accessibilityLabel={t('workout.done.lightTotal', { count: order.length, minutes })}
        >
          {t('workout.done.lightTotal', { count: order.length, minutes })}
        </AppText>
        <AppText color={colors.mutedStrong} variant={senior ? 'bodyStrong' : 'body'}>
          {t('workout.done.lightNote')}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  total: { alignItems: 'center', gap: spacing.xs },
  hidden: { opacity: 0 },
  num: { fontFamily: fonts.heading, fontVariant: ['tabular-nums'], textAlign: 'center' },
}));
