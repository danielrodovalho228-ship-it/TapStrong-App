import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';
import { deviceWeekStart, localDate } from '@/lib/dates';
import { colors, fonts, radius, sizes, spacing } from '@/theme';

import { useTrainingDaysPerWeek } from '../useTrainingDays';
import { weekStrip, type WeekDay } from '../week';

/**
 * Week strip (improvements v1, A1): this week's days, today outlined, a solid
 * dot on trained days and a hollow dot on planned ones. Tap a day to see its
 * session (past = log, future = preview). `large` for 60+.
 */
export function WeekStrip({ large = false }: { large?: boolean }) {
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
            <AppText variant="caption" color={colors.mutedStrong} style={styles.caps}>
              {date.toLocaleDateString(i18n.language, { weekday: 'narrow' })}
            </AppText>
            <AppText variant={large ? 'h3' : 'bodyStrong'}>{date.getDate()}</AppText>
            <View
              style={[
                styles.dot,
                d.mark === 'trained' && styles.trained,
                d.mark === 'planned' && styles.planned,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    minHeight: sizes.touchTarget + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  dayLarge: { minHeight: sizes.touchTarget + spacing.xl },
  today: { borderColor: colors.accent },
  caps: { textTransform: 'uppercase', fontFamily: fonts.headingSemi },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trained: { backgroundColor: colors.accent },
  planned: { borderWidth: 1.5, borderColor: colors.accent },
});
