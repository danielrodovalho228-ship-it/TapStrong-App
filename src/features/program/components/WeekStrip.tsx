import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, makeStyles, radius, sizes, spacing, useColors } from '@/theme';

import { useTrainingDaysPerWeek } from '../useTrainingDays';
import { weekStrip, type WeekDay } from '../week';

/**
 * Week strip (improvements v1, A1; Phase 31, G): this week's days, today on
 * a raised pill, a check on trained days and a coral dot on planned ones. Tap
 * a day to see its session (past = log, future = preview). `large` for 60+.
 */
export function WeekStrip({ large = false }: { large?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const { t, i18n } = useTranslation();
  const workouts = useWorkoutStore((s) => s.workouts);
  const daysPerWeek = useTrainingDaysPerWeek();
  const today = localDate(clock.now());
  const days = weekStrip({
    today,
    startsOn: deviceWeekStart(),
    daysPerWeek,
    workouts,
    toLocal: (iso) => localDate(new Date(iso)),
  });
  const label = (d: WeekDay) => {
    const date = new Date(`${d.date}T12:00:00`);
    const name = date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric' });
    const mark = d.mark ? t(`week.${d.mark}`) : '';
    return [name, d.today ? t('week.today') : '', mark].filter(Boolean).join(', ');
  };

  return (
    <View style={styles.row} accessibilityLabel={t('week.title')} testID="week-strip">
      {days.map((d) => {
        const date = new Date(`${d.date}T12:00:00`);
        return (
          <Pressable
            key={d.date}
            accessibilityRole="button"
            accessibilityLabel={label(d)}
            testID={`week-${d.date}`}
            onPress={() => router.push({ pathname: '/day/[date]', params: { date: d.date } })}
            style={[styles.day, large && styles.dayLarge, d.today && styles.today]}
          >
            <AppText
              variant="caption"
              color={d.mark === 'trained' ? colors.accentText : colors.mutedStrong}
            >
              {date.toLocaleDateString(i18n.language, { weekday: 'short' }).slice(0, 2)}
            </AppText>
            <AppText
              variant={large ? 'h3' : 'bodyStrong'}
              color={d.mark === 'trained' ? colors.accentText : colors.ink}
            >
              {date.getDate()}
            </AppText>
            {/* Done: a check; planned: a coral dot (Phase 31, G). */}
            {d.mark === 'trained' ? (
              <View style={styles.check} testID="week-trained">
                <Icon name="check" size={12} color={colors.background} />
              </View>
            ) : (
              <View style={[styles.dot, d.mark === 'planned' && styles.planned]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    minHeight: sizes.touchTarget + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRadius: radius.chip,
  },
  dayLarge: { minHeight: sizes.touchTarget + spacing.xl },
  today: { backgroundColor: colors.surface },
  dot: { width: 8, height: 8, borderRadius: 4 },
  planned: { backgroundColor: colors.accent },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
}));
