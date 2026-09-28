import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, Header, Notice, Screen, ToggleRow } from '@/components/ui';
import { useAccountStore } from '@/features/account/store';
import { requestPermission } from '@/features/notifications/apply';
import { parseTime, trainingWeekdays } from '@/features/notifications/plan';
import { useTrainingDaysPerWeek } from '@/features/program/useTrainingDays';
import { clock } from '@/lib/clock';
import { deviceWeekStart } from '@/lib/dates';
import { colors, spacing } from '@/theme';

const TIMES = ['07:00', '12:00', '17:30', '19:00', '20:30'];
const WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Settings → Reminders (improvements v1, D4): on/off, time, days, streak saver. */
export default function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const { notifications, setNotifications } = useAccountStore();
  const daysPerWeek = useTrainingDaysPerWeek();
  const [denied, setDenied] = useState(false);
  const planDays = trainingWeekdays(daysPerWeek, deviceWeekStart());
  const days = notifications.reminderDays?.length ? notifications.reminderDays : planDays;

  const toggle = async (key: 'reminders' | 'streakSaver', value: boolean) => {
    if (value && !(await requestPermission())) {
      setDenied(true);
      return;
    }
    setDenied(false);
    setNotifications({ [key]: value });
  };
  const timeText = (hhmm: string) => {
    const { hour, minute } = parseTime(hhmm);
    const d = clock.now();
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  };
  const dayName = (day: number) =>
    new Date(2026, 8, 20 + day, 12).toLocaleDateString(i18n.language, { weekday: 'short' }); // Sep 20 2026 is a Sunday
  const flipDay = (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
    // Keep at least one day; an empty list falls back to the plan's days.
    if (next.length) setNotifications({ reminderDays: next });
  };

  return (
    <Screen header={<Header onBack={() => router.back()} title={t('reminders.title')} />}>
      {denied ? <Notice>{t('account.permissionDenied')}</Notice> : null}
      <Card style={styles.card}>
        <ToggleRow
          label={t('account.reminders')}
          detail={t('account.remindersDetail', {
            days: days.map(dayName).join(', '),
            time: timeText(notifications.reminderTime),
          })}
          value={notifications.reminders}
          onChange={(v) => void toggle('reminders', v)}
        />
        {notifications.reminders ? (
          <>
            <AppText variant="h3">{t('reminders.time')}</AppText>
            <View style={styles.chips}>
              {TIMES.map((time) => (
                <Chip
                  key={time}
                  label={timeText(time)}
                  selected={notifications.reminderTime === time}
                  onPress={() => setNotifications({ reminderTime: time })}
                />
              ))}
            </View>
            <AppText variant="h3">{t('reminders.days')}</AppText>
            <View style={styles.chips}>
              {WEEK.map((day) => (
                <Chip
                  key={day}
                  label={dayName(day)}
                  accessibilityLabel={t('reminders.dayLabel', { day: dayName(day) })}
                  selected={days.includes(day)}
                  onPress={() => flipDay(day)}
                />
              ))}
              <Chip
                label={t('reminders.daysAuto')}
                selected={!notifications.reminderDays?.length}
                onPress={() => setNotifications({ reminderDays: undefined })}
              />
            </View>
          </>
        ) : null}
      </Card>
      <Card style={styles.card}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('reminders.motivation')}
        </AppText>
        <ToggleRow
          label={t('account.streakSaver')}
          detail={t('account.streakSaverDetail', {
            time: timeText(notifications.streakSaverTime),
          })}
          value={notifications.streakSaver}
          onChange={(v) => void toggle('streakSaver', v)}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
