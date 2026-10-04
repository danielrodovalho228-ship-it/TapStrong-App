import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { weekdayShort } from '@/features/program/components/WeekStrip';
import { colors, makeStyles, radius, spacing, useColors } from '@/theme';

import { weekDays } from './daily';

/**
 * "Week" (Phase 32 C): the 7 days of this week, Monday first. A day with the
 * shoulder done fills coral; today waits with a coral edge; days in a row
 * show under it from 2 on.
 */
export function WeekSquares({
  today,
  done,
  streak,
}: {
  today: string;
  done: Set<string>;
  streak: number;
}) {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.row} testID="rehab-week">
        {weekDays(today).map((d) => {
          const isDone = done.has(d);
          return (
            <View
              key={d}
              style={styles.col}
              accessible
              accessibilityLabel={`${new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, {
                weekday: 'long',
              })}${isDone ? `, ${t('rehab.weekDoneDay')}` : d === today ? `, ${t('week.today')}` : ''}`}
            >
              <AppText variant="caption" color={colors.mutedStrong}>
                {weekdayShort(new Date(`${d}T12:00:00`), i18n.language)}
              </AppText>
              <View
                testID={
                  isDone ? 'rehab-square-done' : d === today ? 'rehab-square-today' : undefined
                }
                style={[
                  styles.square,
                  isDone && styles.done,
                  !isDone && d === today && styles.today,
                ]}
              >
                {isDone ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      {streak >= 2 ? (
        <AppText color={colors.accentText} testID="rehab-streak">
          {t('rehab.streak', { count: streak })}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.xs },
  col: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  square: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 44,
    borderRadius: radius.chip,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: colors.accent },
  today: { borderWidth: 2, borderColor: colors.accent },
}));
