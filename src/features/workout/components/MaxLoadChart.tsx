import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { colors, makeStyles, spacing, useColors } from '@/theme';

/**
 * "Max load" (Phase 31, D): a small area chart of the best load of each past
 * session of this exercise, with the next goal as a dashed line. Adults only;
 * the caller decides.
 */
export function MaxLoadChart({
  points,
  goal,
  unitLabel,
  best: top3 = null,
  width = 220,
  height = 96,
}: {
  /** Best load per session, oldest first, in the person's unit. */
  points: number[];
  goal?: number | null;
  unitLabel: string;
  /** The heaviest set so far: load, reps and date, shown on the left. */
  best?: { load: number; reps: number | null; date: string } | null;
  width?: number;
  height?: number;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  if (!points.length) return null;
  const top = Math.max(...points, goal ?? 0) * 1.1 || 1;
  const x = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width);
  const y = (v: number) => height - (v / top) * height;
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  const area = `${line.join(' ')} L${x(points.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;
  const best = Math.max(...points);
  const bestText = `${best} ${unitLabel}`;
  return (
    <View style={styles.wrap} testID="max-load-chart">
      {/* Phase 31, G: the record on the left, the chart on the right. */}
      <View style={styles.left}>
        <AppText variant="bodyStrong">{t('workout.logger.maxLoad')}</AppText>
        <AppText>{top3 ? `${top3.load} ${unitLabel}` : bestText}</AppText>
        {top3?.reps ? (
          <AppText>{t('workout.logger.repsValue', { count: top3.reps })}</AppText>
        ) : null}
        {top3 ? (
          <AppText color={colors.mutedStrong}>
            {new Date(top3.date).toLocaleDateString(i18n.language)}
          </AppText>
        ) : null}
        {goal ? (
          <AppText color={colors.accentText}>
            {t('workout.logger.goalShort', { load: `${goal} ${unitLabel}` })}
          </AppText>
        ) : null}
      </View>
      <View
        style={styles.chart}
        accessible
        accessibilityLabel={t('workout.logger.maxLoadA11y', {
          best: `${best} ${unitLabel}`,
          goal: goal ? `${goal} ${unitLabel}` : '—',
        })}
      >
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <Path d={area} fill={colors.primarySoft} />
          <Path d={line.join(' ')} stroke={colors.accent} strokeWidth={2} fill="none" />
          {goal ? (
            <Line
              x1={0}
              x2={width}
              y1={y(goal)}
              y2={y(goal)}
              stroke={colors.accentText}
              strokeWidth={1.5}
              strokeDasharray="6 5"
              testID="max-load-goal"
            />
          ) : null}
        </Svg>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  left: { gap: spacing.xxs, minWidth: 120 },
  chart: { flex: 1 },
}));
