import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Notice, TextLink } from '@/components/ui';
import { track } from '@/lib/analytics';
import { clock } from '@/lib/clock';
import { spacing } from '@/theme';

import { stillBefore } from '../cycle';
import { useMonthStore } from '../store';

/**
 * After an automatic choice (a workout started without choosing, Phase 26
 * decision 3): "Renewed N exercises · Undo". Undo is there for 7 days and
 * brings back last month's plan exactly.
 */
export function MonthAutoNotice({ onUndone }: { onUndone?: () => void }) {
  const { t } = useTranslation();
  const { autoNotice, undo, dismissAutoNotice } = useMonthStore();
  const now = clock.now();
  if (!autoNotice || !stillBefore(autoNotice.until, now)) return null;
  return (
    <Notice>
      <View style={{ gap: spacing.xs }} testID="month-auto-notice">
        <AppText>
          {autoNotice.count
            ? t('month.autoNotice', { count: autoNotice.count })
            : t('month.autoNoticeNone')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TextLink
            label={t('month.undo')}
            onPress={() => {
              if (undo(clock.now())) {
                track('month_undone');
                onUndone?.();
              }
            }}
          />
          <TextLink label={t('month.dismiss')} onPress={dismissAutoNotice} />
        </View>
      </View>
    </Notice>
  );
}
