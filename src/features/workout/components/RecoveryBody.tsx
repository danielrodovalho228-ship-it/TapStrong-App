import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText, SegmentedControl } from '@/components/ui';
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

/** Same dot as the tappable body map (mockup 08), filled with the recovery color. */
const DOT = 18;

/**
 * Read-only body with recovery colors (mockups 07, 14, 15). Uses the body-map
 * hotspot dots (QA O-1): one small dot per muscle point, filled red, orange,
 * peach, neutral or grey-blue. `views="toggle"` adds a front/back switch;
 * `views="both"` shows the two side by side (share card).
 */
export function RecoveryBody({
  band,
  sex,
  states,
  maxHeight,
  views = 'toggle',
}: {
  band: BodyBand;
  sex: BodySex;
  states: Record<string, RecoveryState>;
  maxHeight: number;
  views?: 'toggle' | 'both';
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<BodyView>('front');
  if (views === 'both') {
    return (
      <View style={styles.both}>
        {(['front', 'back'] as const).map((v) => (
          <View key={v} style={styles.half}>
            <BodyDots band={band} sex={sex} view={v} states={states} maxHeight={maxHeight} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <BodyDots band={band} sex={sex} view={view} states={states} maxHeight={maxHeight} />
      <SegmentedControl
        accessibilityLabel={t('bodyMap.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: t('bodyMap.front') },
          { value: 'back', label: t('bodyMap.back') },
        ]}
      />
    </View>
  );
}

function BodyDots({
  band,
  sex,
  view,
  states,
  maxHeight,
}: {
  band: BodyBand;
  sex: BodySex;
  view: BodyView;
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
      accessibilityLabel={`${t('workout.bodyNow')}, ${t(`bodyMap.${view}`)}`}
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
            const state = states[h.key] ?? 'neutral';
            return h.points.map(([x, y], i) => (
              <View
                key={`${h.key}-${i}`}
                testID={`recovery-${h.key}-${state}`}
                pointerEvents="none"
                style={[
                  styles.dot,
                  {
                    left: x * scale - DOT / 2,
                    top: y * scale - DOT / 2,
                  },
                  state === 'neutral'
                    ? styles.dotNeutral
                    : { backgroundColor: STATE_COLOR[state], borderColor: colors.surface },
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
  wrap: { gap: spacing.sm },
  both: { flexDirection: 'row', gap: spacing.xs },
  half: { flex: 1 },
  canvas: {
    backgroundColor: colors.bodyCanvas,
    borderRadius: radius.card,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2.5,
  },
  dotNeutral: { backgroundColor: colors.surface, borderColor: colors.ink },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: DOT / 2 },
  legendText: { flex: 1 },
});
