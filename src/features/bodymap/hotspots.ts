import data from './hotspots.json';

import type { BodyBand } from '../profile/age';

import type { BodySex, BodyView } from './images';

/** Hotspot centers in the 288×516 frame (SPEC §5), verified per body image. */
export const FRAME = data.frame;

export type Point = [number, number];
export type Hotspot = { key: string; points: Point[] };

type Models = Record<string, Record<string, number[][]>>;

export function hotspotsFor(band: BodyBand, sex: BodySex, view: BodyView): Hotspot[] {
  const model = (data.models as Models)[`${band}-${sex}-${view}`];
  if (!model) return [];
  return Object.entries(model).map(([key, points]) => ({
    key,
    points: points.map(([x, y]) => [x, y] as Point),
  }));
}

/**
 * Finds the muscle nearest to a tap, in frame units. Dots on the chest are
 * about 16 units apart, so each dot owns the area closest to it (up to
 * `maxDistance`), which keeps small targets easy to hit.
 */
export function nearestHotspot(
  hotspots: Hotspot[],
  x: number,
  y: number,
  maxDistance = 24,
): string | null {
  let best: { key: string; d: number } | null = null;
  for (const h of hotspots) {
    for (const [px, py] of h.points) {
      const d = Math.hypot(px - x, py - y);
      if (d <= maxDistance && (!best || d < best.d)) best = { key: h.key, d };
    }
  }
  return best?.key ?? null;
}
