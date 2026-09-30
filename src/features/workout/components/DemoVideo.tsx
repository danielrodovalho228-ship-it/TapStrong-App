import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

/**
 * Muted autoplay loop (SPEC §3: expo-video). The poster (the clip's starting
 * image, same sex) covers the view until the first frame is on screen.
 */
export function DemoVideo({
  source,
  poster = null,
  mirrored = false,
}: {
  source: number;
  poster?: number | null;
  mirrored?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // The other side of a one-sided move: the same clip, mirrored.
  const flip = mirrored && { transform: [{ scaleX: -1 }] };
  return (
    <>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, flip]}
        contentFit="contain"
        nativeControls={false}
        onFirstFrameRender={() => setPlaying(true)}
      />
      {poster && !playing ? (
        <Image
          testID="demo-poster"
          source={poster}
          style={[StyleSheet.absoluteFill, flip]}
          contentFit="contain"
          accessible={false}
        />
      ) : null}
    </>
  );
}
