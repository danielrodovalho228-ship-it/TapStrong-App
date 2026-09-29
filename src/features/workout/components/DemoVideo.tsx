import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

/** Muted autoplay loop (SPEC §3: expo-video). */
export function DemoVideo({ source, mirrored = false }: { source: number; mirrored?: boolean }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      // The other side of a one-sided move: the same clip, mirrored.
      style={[StyleSheet.absoluteFill, mirrored && { transform: [{ scaleX: -1 }] }]}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
