import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { clock } from '@/lib/clock';

/** Re-renders every `ms` and returns the current time (from the app clock). */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => clock.now().getTime());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now().getTime()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Countdown ring (mockup 12). `progress` 0–1 is the part already elapsed. */
export function TimerRing({
  size,
  progress,
  track,
  color,
  children,
}: {
  size: number;
  progress: number;
  track: string;
  color: string;
  children?: React.ReactNode;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, 1 - progress));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - left)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
