import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/ui';
import { FRAME, hotspotsFor } from '@/features/bodymap/hotspots';
import { bodyImage, type BodySex, type BodyView } from '@/features/bodymap/images';
import type { BodyBand } from '@/features/profile/age';
import { colors, radius, recoveryColors, spacing } from '@/theme';

import type { RecoveryState } from '../recovery';

export const STATE_COLOR: Record<Exclude<RecoveryState, 'neutral'>, string> = {
  fresh: recoveryColors.fresh,
  recovering: recoveryColors.recovering,
  almost: recoveryColors.almost,
  neglected: recoveryColors.neglected,
};

const HALO = 34;

/** Read-only body with recovery colors (mockups 07 and 14). */
export function RecoveryBody({
  band,
  sex,
  view = 'front',
  states,
  maxHeight,
}: {
  band: BodyBand;
  sex: BodySex;
  view?: BodyView;
  states: Record<string, RecoveryState>;
  maxHeight: number;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const height = Math.min(maxHeight, (width * FRAME.height) / FRAME.width);
  const imageWidth = (height * FRAME.width) / FRAME.height;
  const scale = imageWidth / FRAME.width;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      style={styles.canvas}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('workout.bodyNow')}
    >
      {width > 0 ? (
        <View style={{ width: imageWidth, height }}>
          <Image
            source={bodyImage(band, sex, view)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            alt=""
          />
          {hotspotsFor(band, sex, view).flatMap((h) => {
            const state = states[h.key];
            if (!state || state === 'neutral') return [];
            return h.points.map(([x, y], i) => (
              <View
                key={`${h.key}-${i}`}
                testID={`recovery-${h.key}-${state}`}
                pointerEvents="none"
                style={[
                  styles.halo,
                  {
                    left: x * scale - HALO / 2,
                    top: y * scale - HALO / 2,
                    backgroundColor: STATE_COLOR[state],
                  },
                ]}
              />
            ));
          })}
        </View>
      ) : null}
    </View>
  );
}

export function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <AppText style={styles.legendText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.bodyCanvas,
    borderRadius: radius.card,
    alignItems: 'center',
    overflow: 'hidden',
  },
  halo: { position: 'absolute', width: HALO, height: HALO, borderRadius: HALO / 2, opacity: 0.6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 3 },
  legendText: { flex: 1 },
});
