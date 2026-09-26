import { Platform } from 'react-native';

import i18n from '@/i18n';

import type { PlannedNotification } from './plan';

type NotificationsModule = typeof import('expo-notifications');

function load(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Asks for permission when the user turns a notification on. */
export async function requestPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

let handlerSet = false;

/** Replaces every scheduled TapStrong notification with the plan. */
export async function applyPlan(plan: PlannedNotification[]): Promise<void> {
  const N = load();
  if (!N) return;
  if (!handlerSet) {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  }
  await N.cancelAllScheduledNotificationsAsync();
  if (!plan.length) return;
  const { granted } = await N.getPermissionsAsync();
  if (!granted) return;

  for (const p of plan) {
    if (p.kind === 'reminder') {
      await N.scheduleNotificationAsync({
        identifier: p.id,
        content: {
          title: i18n.t('notifications.reminder.title'),
          body: i18n.t('notifications.reminder.body'),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday: p.weekday,
          hour: p.hour,
          minute: p.minute,
        },
      });
    } else if (p.kind === 'trial') {
      const day = new Date(p.chargeOn).toLocaleDateString(i18n.language, {
        month: 'short',
        day: 'numeric',
      });
      await N.scheduleNotificationAsync({
        identifier: p.id,
        content: {
          title: i18n.t('notifications.trial.title'),
          body: i18n.t('notifications.trial.body', { date: day }),
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.date },
      });
    } else {
      await N.scheduleNotificationAsync({
        identifier: p.id,
        content: {
          title: i18n.t('notifications.streakSaver.title', { count: p.streak }),
          body: i18n.t('notifications.streakSaver.body'),
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: p.date },
      });
    }
  }
}
