/**
 * QA round 2 — O-1b: the recovery map is the body map (docs/qa-round-2.md §0).
 */
import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BodyMapCanvas, DOT_FRAME, dotGeometry } from '@/features/bodymap/components/BodyMapCanvas';
import { FRAME, hotspotsFor } from '@/features/bodymap/hotspots';

import { RecoveryBody, STATE_COLOR } from './components/RecoveryBody';

type Box = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
};
const box = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style) as Box;
const WIDTH = 342;
const layout = { nativeEvent: { layout: { width: WIDTH, height: 700, x: 0, y: 0 } } };

async function bodyMapDots() {
  await render(<BodyMapCanvas band="adult" sex="f" view="front" selected={[]} maxHeight={1000} />);
  await fireEvent(screen.getByTestId('bodymap-canvas'), 'layout', layout);
  return screen.getAllByTestId(/^dot-/, { includeHiddenElements: true });
}

describe('O-1b recovery map = body map', () => {
  it('same positions and the same dot size at the same width', async () => {
    const mapDots = await bodyMapDots();
    const mapSize = box(mapDots[0]).width!;

    await render(<RecoveryBody band="adult" sex="f" states={{ upperChest: 'fresh' }} />);
    await fireEvent(screen.getByLabelText('Your body now, Front'), 'layout', layout);
    const recDots = screen.getAllByTestId(/^recovery-\w+-/, { includeHiddenElements: true });

    const scale = WIDTH / FRAME.width;
    const points = hotspotsFor('adult', 'f', 'front').flatMap((h) => h.points);
    expect(recDots).toHaveLength(points.length);
    expect(mapDots).toHaveLength(points.length);
    recDots.forEach((d, i) => {
      const b = box(d);
      expect(b.width).toBeCloseTo(mapSize, 5);
      // Centre of each recovery dot = the hotspot position on /body.
      expect(b.left! + b.width! / 2).toBeCloseTo(points[i][0] * scale, 5);
      expect(b.top! + b.height! / 2).toBeCloseTo(points[i][1] * scale, 5);
    });
  });

  it('dot size is a fixed share of the body, never a fixed pixel size', () => {
    for (const width of [150, 342, 600]) {
      const scale = width / FRAME.width;
      expect(dotGeometry(scale).dot / width).toBeCloseTo(DOT_FRAME / FRAME.width, 8);
    }
    // About 18 px on the full body map (≈ 490 px tall at 390 × 844).
    expect(dotGeometry(490 / FRAME.height).dot).toBeGreaterThan(17);
    expect(dotGeometry(490 / FRAME.height).dot).toBeLessThan(19);
  });

  it('trained muscles get a colored dot plus a soft halo; ready ones stay white', async () => {
    await render(
      <RecoveryBody band="adult" sex="f" states={{ upperChest: 'fresh', quads: 'neutral' }} />,
    );
    await fireEvent(screen.getByLabelText('Your body now, Front'), 'layout', layout);
    const [fresh] = screen.getAllByTestId('recovery-upperChest-fresh', {
      includeHiddenElements: true,
    });
    expect(box(fresh).backgroundColor).toBe(STATE_COLOR.fresh);
    const [ready] = screen.getAllByTestId('recovery-quads-neutral', {
      includeHiddenElements: true,
    });
    expect(box(ready).backgroundColor).toBe('#FFFFFF');
    await fireEvent.press(screen.getByRole('radio', { name: 'Back' }));
    await fireEvent(screen.getByLabelText('Your body now, Back'), 'layout', layout);
    expect(
      screen.getAllByTestId(/recovery-\w+-neutral/, { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
  });
});
