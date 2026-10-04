import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { ROM_STEPS } from './progress';

const SIZE = 220;
const PIVOT = { x: 70, y: 110 };
const R = 92;
/** The arm's end at this angle: 0° hangs down, 90° points forward, 180° points up. */
const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return { x: PIVOT.x + r * Math.sin(a), y: PIVOT.y + r * Math.cos(a) };
};

/**
 * "Range of the week" (Phase 32 C, "Surprising"): the person taps how high
 * the arm went today, 0–180° in 15° steps, on a side-view drawing, and sees
 * the curve of the weeks below. Pain-free only: the caption says so.
 */
export function RomPicker({
  value,
  onPick,
  weeks,
}: {
  value: number | null;
  onPick: (degrees: number) => void;
  /** The best of each program week (null = not measured that week). */
  weeks: (number | null)[];
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const arm = value === null ? null : point(value);
  const arc = `M ${point(0).x} ${point(0).y} A ${R} ${R} 0 0 0 ${point(180).x} ${point(180).y}`;
  const step = (dir: 1 | -1) =>
    onPick(Math.max(0, Math.min(180, (value ?? (dir > 0 ? -15 : 15)) + dir * 15)));
  return (
    <View style={styles.wrap} testID="rom-picker">
      <AppText variant="caption" color={colors.mutedStrong}>
        {t('rehab.rom.hint')}
      </AppText>
      <View
        style={styles.drawing}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('rehab.rom.title')}
        accessibilityValue={
          value === null ? undefined : { text: t('rehab.rom.value', { degrees: value }) }
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <Svg width={SIZE} height={SIZE} pointerEvents="none">
          <Path d={arc} stroke={colors.line} strokeWidth={2} fill="none" strokeDasharray="4 6" />
          {/* The body, side view: head, trunk, the arm at the chosen angle. */}
          <Circle cx={PIVOT.x - 4} cy={PIVOT.y - 34} r={14} fill={colors.mutedStrong} />
          <Line
            x1={PIVOT.x - 4}
            y1={PIVOT.y - 18}
            x2={PIVOT.x - 4}
            y2={PIVOT.y + 80}
            stroke={colors.mutedStrong}
            strokeWidth={10}
            strokeLinecap="round"
          />
          {arm ? (
            <Line
              x1={PIVOT.x}
              y1={PIVOT.y}
              x2={arm.x}
              y2={arm.y}
              stroke={colors.accent}
              strokeWidth={8}
              strokeLinecap="round"
            />
          ) : null}
          {ROM_STEPS.map((d) => {
            const p = point(d);
            return (
              <Circle
                key={d}
                cx={p.x}
                cy={p.y}
                r={d === value ? 8 : 5}
                fill={d === value ? colors.accent : colors.muted}
              />
            );
          })}
        </Svg>
        {ROM_STEPS.map((d) => {
          const p = point(d);
          return (
            <Pressable
              key={d}
              testID={`rom-${d}`}
              // The drawing above is one adjustable control for screen readers.
              accessible={false}
              onPress={() => onPick(d)}
              style={[styles.target, { left: p.x - 16, top: p.y - 16 }]}
            />
          );
        })}
      </View>
      <AppText variant="h3" testID="rom-value">
        {value === null ? t('rehab.rom.ask') : t('rehab.rom.value', { degrees: value })}
      </AppText>
      {/* The weekly curve: the best of each week. */}
      <View style={styles.curve} testID="rom-curve">
        {weeks.map((deg, i) => (
          <View key={i} style={styles.col}>
            <View style={styles.track}>
              {deg !== null ? (
                <View style={[styles.bar, { height: `${Math.max(6, (deg / 180) * 100)}%` }]} />
              ) : null}
            </View>
            <AppText variant="caption" color={colors.mutedStrong}>
              {t('rehab.calendarWeek', { n: i + 1 })}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.sm, alignItems: 'center' },
  drawing: { width: SIZE, height: SIZE },
  target: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
  curve: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  col: { alignItems: 'center', gap: spacing.xxs },
  track: {
    width: 22,
    height: 64,
    borderRadius: radius.chip,
    backgroundColor: colors.line,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: colors.teal },
}));
