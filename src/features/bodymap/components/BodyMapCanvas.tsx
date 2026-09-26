import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, radius } from '@/theme';

import { muscleByKey } from '../../muscles';
import type { BodyBand } from '../../profile/age';
import { FRAME, hotspotsFor, nearestHotspot } from '../hotspots';
import { bodyImage, type BodySex, type BodyView } from '../images';

const DOT = 18;
const HALO = 30;
// Dot hit area; taps between dots go to the nearest one via the image press.
const HIT = 22;

export type BodyMapCanvasProps = {
  band: BodyBand;
  sex: BodySex;
  view: BodyView;
  selected: string[];
  onToggle: (muscleKey: string) => void;
  maxHeight: number;
};

/** Body image with tappable muscle dots (mockup 08). */
export function BodyMapCanvas({
  band,
  sex,
  view,
  selected,
  onToggle,
  maxHeight,
}: BodyMapCanvasProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const hotspots = hotspotsFor(band, sex, view);

  const height = Math.min(maxHeight, (width * FRAME.height) / FRAME.width);
  const imageWidth = (height * FRAME.width) / FRAME.height;
  const scale = imageWidth / FRAME.width;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Taps between dots go to the nearest dot (small targets on the chest).
  const onPressImage = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const key = nearestHotspot(hotspots, locationX / scale, locationY / scale, 24);
    if (key) onToggle(key);
  };

  return (
    <View testID="bodymap-canvas" style={styles.canvas} onLayout={onLayout}>
      {width > 0 ? (
        <View style={{ width: imageWidth, height }}>
          <Pressable
            onPress={onPressImage}
            style={StyleSheet.absoluteFill}
            accessible={false}
            importantForAccessibility="no"
          >
            <Image
              source={bodyImage(band, sex, view)}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
          {/* Halos are visual only, so they never steal a tap from a neighbour. */}
          {hotspots.flatMap((h) =>
            selected.includes(h.key)
              ? h.points.map(([x, y], i) => (
                  <View
                    key={`halo-${h.key}-${i}`}
                    pointerEvents="none"
                    style={[styles.halo, { left: x * scale - HALO / 2, top: y * scale - HALO / 2 }]}
                  />
                ))
              : [],
          )}
          {hotspots.flatMap((h) => {
            const isSelected = selected.includes(h.key);
            const muscle = muscleByKey(h.key);
            const label = muscle ? t(muscle.labelKey as 'muscles.chest') : h.key;
            return h.points.map(([x, y], i) => (
              <Pressable
                key={`${h.key}-${i}`}
                onPress={() => onToggle(h.key)}
                // One screen-reader stop per muscle, even when it has two dots.
                accessible={i === 0}
                aria-hidden={i > 0}
                focusable={i === 0}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                style={[styles.hit, { left: x * scale - HIT / 2, top: y * scale - HIT / 2 }]}
              >
                <View style={[styles.dot, isSelected ? styles.dotOn : styles.dotOff]} />
              </Pressable>
            ));
          })}
        </View>
      ) : null}
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
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: 'rgba(194, 62, 23, 0.25)',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2.5 },
  dotOn: { backgroundColor: colors.accent, borderColor: colors.surface },
  dotOff: { backgroundColor: colors.surface, borderColor: colors.ink },
});
