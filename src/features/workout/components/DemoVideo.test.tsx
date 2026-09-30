/**
 * Media import 1: the poster (the clip's starting image) covers the player
 * until the first frame is on screen, and mirrors with "Other side".
 */
import { act, render, screen } from '@testing-library/react-native';

import { DemoVideo } from './DemoVideo';

let firstFrame: (() => void) | undefined;
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({}),
  VideoView: ({ onFirstFrameRender }: { onFirstFrameRender?: () => void }) => {
    firstFrame = onFirstFrameRender;
    const { View } = jest.requireActual('react-native');
    return <View testID="video-view" />;
  },
}));

it('shows the poster before play, then hides it on the first frame', async () => {
  await render(<DemoVideo source={1} poster={2} />);
  expect(screen.getByTestId('demo-poster')).toBeTruthy();
  await act(() => firstFrame?.());
  expect(screen.queryByTestId('demo-poster')).toBeNull();
  expect(screen.getByTestId('video-view')).toBeTruthy();
});

it('no poster: just the player', async () => {
  await render(<DemoVideo source={1} />);
  expect(screen.queryByTestId('demo-poster')).toBeNull();
});

it('the poster mirrors with the other side', async () => {
  await render(<DemoVideo source={1} poster={2} mirrored />);
  expect(screen.getByTestId('demo-poster')).toHaveStyle({ transform: [{ scaleX: -1 }] });
});
