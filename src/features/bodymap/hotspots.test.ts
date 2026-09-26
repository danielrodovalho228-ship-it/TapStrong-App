import { MUSCLES } from '../muscles';

import data from './hotspots.json';
import { FRAME, hotspotsFor, nearestHotspot } from './hotspots';
import { BAND_OPTIONS } from './selection';

const VIEWS = ['front', 'back'] as const;

describe('hotspots.json (SPEC §5)', () => {
  it('has all 28 body models', () => {
    expect(Object.keys(data.models)).toHaveLength(28);
    for (const band of BAND_OPTIONS)
      for (const sex of ['m', 'f'] as const)
        for (const view of VIEWS) expect(hotspotsFor(band, sex, view).length).toBeGreaterThan(0);
  });

  it('uses only muscles from the database, on the view they belong to', () => {
    for (const [model, spots] of Object.entries(data.models)) {
      const view = model.split('-')[2] as (typeof VIEWS)[number];
      for (const key of Object.keys(spots)) {
        const muscle = MUSCLES.find((m) => m.key === key);
        expect({ model, key, known: !!muscle }).toEqual({ model, key, known: true });
        expect(muscle!.views).toContain(view);
      }
    }
  });

  it('gives every muscle with a view a dot on every body in that view', () => {
    for (const view of VIEWS) {
      const expected = MUSCLES.filter((m) => m.views.includes(view))
        .map((m) => m.key)
        .sort();
      for (const band of BAND_OPTIONS)
        for (const sex of ['m', 'f'] as const)
          expect(
            hotspotsFor(band, sex, view)
              .map((h) => h.key)
              .sort(),
          ).toEqual(expected);
    }
  });

  it('keeps every point inside the frame, paired muscles mirrored left/right', () => {
    for (const band of BAND_OPTIONS)
      for (const sex of ['m', 'f'] as const)
        for (const view of VIEWS)
          for (const h of hotspotsFor(band, sex, view)) {
            for (const [x, y] of h.points) {
              expect(x).toBeGreaterThan(0);
              expect(x).toBeLessThan(FRAME.width);
              expect(y).toBeGreaterThan(0);
              expect(y).toBeLessThan(FRAME.height);
            }
            if (h.points.length === 2) expect(h.points[0][0]).toBeLessThan(h.points[1][0]);
          }
  });
});

describe('nearestHotspot', () => {
  const spots = hotspotsFor('adult', 'm', 'front');

  it('picks the closest dot within reach', () => {
    expect(nearestHotspot(spots, 126, 116)).toBe('upperChest');
    expect(nearestHotspot(spots, 126, 130)).toBe('midChest');
    expect(nearestHotspot(spots, 199, 162)).toBe('biceps');
  });

  it('ignores taps far from any dot', () => {
    expect(nearestHotspot(spots, 10, 10)).toBeNull();
  });
});
