import { Image } from 'expo-image';
import { useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { colors, radius, sizes, spacing } from '@/theme';

import { muscleByKey } from '../../muscles';
import type { BodyBand } from '../../profile/age';
import { FRAME, hotspotsFor, nearestHotspot } from '../hotspots';
import { bodyImage, type BodySex, type BodyView } from '../images';

const DOT = 18;
const HALO = 30;
const RECOVERY = 40;
// Dot hit area: the 44 px minimum touch target (QA D-05). Taps between dots
// still go to the nearest one via the image press.
const HIT = sizes.touchTarget;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.75;

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, v));
};

export type BodyMapCanvasProps = {
  band: BodyBand;
  sex: BodySex;
  view: BodyView;
  selected: string[];
  /** Recovery colors shown behind the dots (SPEC §4); neutral muscles have none. */
  recovery?: Record<string, string | undefined>;
  onToggle: (muscleKey: string) => void;
  maxHeight: number;
};

/** Body image with tappable muscle dots (mockup 08). */
export function BodyMapCanvas({
  band,
  sex,
  view,
  selected,
  recovery = {},
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

  // Pinch to zoom, two fingers to move (one finger stays for tapping dots).
  // The +/- buttons do the same for people who cannot pinch. Web has no second
  // finger on a mouse, so there a one-pointer drag moves the zoomed body (QA round 1).
  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const maxShift = (z: number, size: number) => {
    'worklet';
    return ((z - 1) * size) / 2;
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      zoom.value = clamp(startZoom.value * e.scale, MIN_ZOOM, MAX_ZOOM);
      x.value = clamp(x.value, -maxShift(zoom.value, imageWidth), maxShift(zoom.value, imageWidth));
      y.value = clamp(y.value, -maxShift(zoom.value, height), maxShift(zoom.value, height));
    })
    .onEnd(() => {
      if (zoom.value < 1.05) {
        zoom.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
      }
    })
    .runOnJS(true)
    .onFinalize(() => setZoomLevel(zoom.value));
  const pan = Gesture.Pan()
    .minPointers(Platform.OS === 'web' ? 1 : 2)
    .minDistance(10)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const mx = maxShift(zoom.value, imageWidth);
      const my = maxShift(zoom.value, height);
      x.value = clamp(startX.value + e.translationX, -mx, mx);
      y.value = clamp(startY.value + e.translationY, -my, my);
    });
  const gestures = Gesture.Simultaneous(pinch, pan);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }],
  }));

  const setZoom = (next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
    zoom.set(withTiming(z));
    x.set(withTiming(clamp(x.get(), -maxShift(z, imageWidth), maxShift(z, imageWidth))));
    y.set(withTiming(clamp(y.get(), -maxShift(z, height), maxShift(z, height))));
    setZoomLevel(z);
  };

  // Taps between dots go to the nearest dot (small targets on the chest).
  const onPressImage = (e: GestureResponderEvent) => {
    // Web has no locationX on some events; offsetX is the same position (QA D-05).
    const ev = e.nativeEvent as typeof e.nativeEvent & { offsetX?: number; offsetY?: number };
    const x = ev.locationX ?? ev.offsetX;
    const y = ev.locationY ?? ev.offsetY;
    if (x == null || y == null) return;
    const key = nearestHotspot(hotspots, x / scale, y / scale, 24);
    if (key) onToggle(key);
  };

  return (
    <View testID="bodymap-canvas" style={styles.canvas} onLayout={onLayout}>
      {width > 0 ? (
        <GestureDetector gesture={gestures}>
          <Animated.View style={[{ width: imageWidth, height }, zoomStyle]}>
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
                // Decorative; each muscle dot is its own accessible button.
                alt=""
              />
            </Pressable>
            {hotspots.flatMap((h) =>
              recovery[h.key]
                ? h.points.map(([x, y], i) => (
                    <View
                      key={`recovery-${h.key}-${i}`}
                      pointerEvents="none"
                      style={[
                        styles.recovery,
                        {
                          left: x * scale - RECOVERY / 2,
                          top: y * scale - RECOVERY / 2,
                          backgroundColor: recovery[h.key],
                        },
                      ]}
                    />
                  ))
                : [],
            )}
            {/* Halos are visual only, so they never steal a tap from a neighbour. */}
            {hotspots.flatMap((h) =>
              selected.includes(h.key)
                ? h.points.map(([x, y], i) => (
                    <View
                      key={`halo-${h.key}-${i}`}
                      pointerEvents="none"
                      style={[
                        styles.halo,
                        { left: x * scale - HALO / 2, top: y * scale - HALO / 2 },
                      ]}
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
                  tabIndex={i === 0 ? 0 : -1}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.hit, { left: x * scale - HIT / 2, top: y * scale - HIT / 2 }]}
                >
                  <View style={[styles.dot, isSelected ? styles.dotOn : styles.dotOff]} />
                </Pressable>
              ));
            })}
          </Animated.View>
        </GestureDetector>
      ) : null}
      {width > 0 ? (
        <View style={styles.zoomControls}>
          <IconButton
            icon="plus"
            variant="outlined"
            accessibilityLabel={t('bodyMap.zoomIn')}
            disabled={zoomLevel >= MAX_ZOOM}
            onPress={() => setZoom(zoomLevel + ZOOM_STEP)}
          />
          <IconButton
            icon="minus"
            variant="outlined"
            accessibilityLabel={t('bodyMap.zoomOut')}
            disabled={zoomLevel <= MIN_ZOOM}
            onPress={() => setZoom(zoomLevel - ZOOM_STEP)}
          />
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
  zoomControls: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    gap: spacing.xs,
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
  recovery: {
    position: 'absolute',
    width: RECOVERY,
    height: RECOVERY,
    borderRadius: RECOVERY / 2,
    opacity: 0.55,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2.5 },
  dotOn: { backgroundColor: colors.accent, borderColor: colors.surface },
  dotOff: { backgroundColor: colors.surface, borderColor: colors.ink },
});
