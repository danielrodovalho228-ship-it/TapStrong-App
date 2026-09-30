import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText, Header, Icon, Notice, Screen } from '@/components/ui';
import { useMonthStore } from '@/features/month/store';
import { makeStyles, radius, spacing, colors as tokens, useColors } from '@/theme';

/** Progress > Months (Phase 26, G): every closed month, newest first. */
export default function MonthsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const history = useMonthStore((s) => s.history);
  const date = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  const lastDay = (to: string) => {
    const d = new Date(`${to}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  return (
    <Screen
      header={
        <Header
          title={t('month.monthsTitle')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))}
        />
      }
    >
      {history.length ? (
        <View style={styles.list}>
          {history.map((h) => {
            const label = t('month.monthsRow', {
              from: date(h.from),
              to: date(lastDay(h.to)),
              count: h.summary.workouts,
            });
            return (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => router.push({ pathname: '/month', params: { id: h.id } })}
                style={styles.row}
              >
                <AppText variant="bodyStrong" style={styles.flex}>
                  {label}
                </AppText>
                <Icon name="chevron-right" color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Notice tone="neutral">{t('month.monthsEmpty')}</Notice>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.line,
  },
  flex: { flex: 1 },
}));
