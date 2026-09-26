import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

/** Muted autoplay loop (SPEC §3: expo-video). */
export function DemoVideo({ source }: { source: number }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
