import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, G } from 'react-native-svg';

import { bodyMapColors, radius, spacing } from '@/theme';

import { muscleFamily } from '../../muscles';
import type { BodyBand } from '../../profile/age';
import { FRAME, hotspotsFor } from '../hotspots';
import { bodyImage, type BodySex, type BodyView } from '../images';

/**
 * Painted muscle areas (Phase 29, A4): an ellipse per hotspot, in frame
 * units (288 × 516), shaped like the muscle (rx, ry and a tilt that follows
 * the limb). Left-side points tilt one way, right-side points the other.
 */
export const AREA_SHAPES: Record<string, { rx: number; ry: number; tilt?: number }> = {
  traps: { rx: 22, ry: 10 },
  shoulders: { rx: 15, ry: 13 },
  rearDelts: { rx: 14, ry: 12 },
  upperChest: { rx: 17, ry: 8 },
  midChest: { rx: 18, ry: 9 },
  lowerChest: { rx: 15, ry: 7 },
  biceps: { rx: 9, ry: 20, tilt: 14 },
  triceps: { rx: 9, ry: 21, tilt: 14 },
  forearms: { rx: 8, ry: 24, tilt: 14 },
  upperAbs: { rx: 16, ry: 14 },
  lowerAbs: { rx: 14, ry: 16 },
  obliques: { rx: 8, ry: 18, tilt: -8 },
  upperBack: { rx: 26, ry: 16 },
  lats: { rx: 14, ry: 26, tilt: -12 },
  lowerBack: { rx: 18, ry: 14 },
  hips: { rx: 12, ry: 16 },
  glutes: { rx: 19, ry: 20 },
  adductors: { rx: 8, ry: 26 },
  quads: { rx: 15, ry: 34 },
  hamstrings: { rx: 14, ry: 34 },
  knees: { rx: 10, ry: 9 },
  shins: { rx: 9, ry: 30 },
  calves: { rx: 12, ry: 26 },
};
const DEFAULT_SHAPE = { rx: 12, ry: 12 };
const MID = FRAME.width / 2;

/** A single midline point on a paired muscle (adductors) paints both legs. */
function pointsOf(points: [number, number][]): [number, number][] {
  if (points.length !== 1) return points;
  const [x, y] = points[0];
  return Math.abs(x - MID) < 4 && y > 280
    ? [
        [x - 9, y],
        [x + 9, y],
      ]
    : points;
}

/** Child keys for parents ("chest" → its three parts); primary wins over secondary. */
export function workedAreas(primary: string[], secondary: string[]) {
  const main = [...new Set(primary.flatMap(muscleFamily))];
  const also = [...new Set(secondary.flatMap(muscleFamily))].filter((k) => !main.includes(k));
  return { main, also };
}

/**
 * "Muscles worked" (Phase 29, A4; like Gymverse): the body with the muscles
 * painted as areas, primary in a strong color and secondary in a light one,
 * front and back side by side. Read-only, one accessible image per view.
 */
export function MuscleAreaMap({
  band,
  sex,
  primary,
  secondary = [],
  views = ['front', 'back'],
  maxHeight = 360,
  testID = 'muscle-area-map',
}: {
  band: BodyBand;
  sex: BodySex;
  primary: string[];
  secondary?: string[];
  views?: BodyView[];
  maxHeight?: number;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { main, also } = workedAreas(primary, secondary);
  return (
    <View style={styles.row} testID={testID}>
      {views.map((v) => (
        <View key={v} style={styles.half}>
          <AreaBody
            band={band}
            sex={sex}
            view={v}
            main={main}
            also={also}
            maxHeight={maxHeight}
            label={`${t('workout.worked')}, ${t(`bodyMap.${v}`)}`}
          />
        </View>
      ))}
    </View>
  );
}

function AreaBody({
  band,
  sex,
  view,
  main,
  also,
  maxHeight,
  label,
}: {
  band: BodyBand;
  sex: BodySex;
  view: BodyView;
  main: string[];
  also: string[];
  maxHeight: number;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const height = Math.min(maxHeight, (width * FRAME.height) / FRAME.width);
  const imageWidth = (height * FRAME.width) / FRAME.height;
  const hotspots = hotspotsFor(band, sex, view);
  const area = (key: string, color: string, opacity: number) => {
    const h = hotspots.find((x) => x.key === key);
    if (!h) return null;
    const shape = AREA_SHAPES[key] ?? DEFAULT_SHAPE;
    return (
      <G key={key} testID={`area-${key}-${color === bodyMapColors.areaPrimary ? 'main' : 'also'}`}>
        {pointsOf(h.points).map(([x, y], i) => {
          const tilt = (shape.tilt ?? 0) * (x < FRAME.width / 2 ? 1 : -1);
          return (
            <Ellipse
              key={i}
              cx={x}
              cy={y}
              rx={shape.rx}
              ry={shape.ry}
              fill={color}
              fillOpacity={opacity}
              transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}
            />
          );
        })}
      </G>
    );
  };
  return (
    <View
      style={styles.canvas}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {width > 0 ? (
        <View style={[styles.body, { width: imageWidth, height }]}>
          <Image
            source={bodyImage(band, sex, view)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            alt=""
          />
          <Svg
            width={imageWidth}
            height={height}
            viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {also.map((k) => area(k, bodyMapColors.areaSecondary, 0.6))}
            {main.map((k) => area(k, bodyMapColors.areaPrimary, 0.72))}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  half: { flex: 1 },
  canvas: { width: '100%', alignItems: 'center' },
  body: { borderRadius: radius.bodyCard, overflow: 'hidden' },
});
