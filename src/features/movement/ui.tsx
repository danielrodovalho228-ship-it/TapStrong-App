import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Chip } from '@/components/ui';
import { colors, makeStyles, spacing } from '@/theme';

import type { MovementKey } from './catalog';
import type { Light } from './progress';
import type { MovementPain } from './store';

type Key = 'movementPain.movements.shoulder.flexion.name';

export const movementName = (t: TFunction, key: MovementKey) => {
  const [joint, movement] = key.split('.');
  return t(`movementPain.movements.${joint}.${movement}.name` as Key);
};

export const movementExample = (t: TFunction, key: MovementKey) => {
  const [joint, movement] = key.split('.');
  return t(`movementPain.movements.${joint}.${movement}.example` as Key);
};

export const areaName = (t: TFunction, area: string) => t(`safety.painAreas.${area as 'shoulder'}`);

/** "Right shoulder" or "Lower back". */
export const reportTitle = (t: TFunction, r: Pick<MovementPain, 'area' | 'side'>) =>
  r.side
    ? t('restrictions.withSide', {
        side: t(`restrictions.sides.${r.side}`),
        area: areaName(t, r.area),
      })
    : areaName(t, r.area);

/** Traffic-light text color, read at render so it follows the theme. */
export const lightColor = (l: Light): string =>
  l === 'green' ? colors.teal : l === 'yellow' ? colors.mutedStrong : colors.accentText;

/** Pain 0–10 as a row of chips (large targets, one tap). */
export function ScoreChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('movementPain.scoreLabel')}
      >
        {Array.from({ length: 11 }, (_, n) => (
          <Chip
            key={n}
            label={String(n)}
            selected={value === n}
            accessibilityRole="radio"
            accessibilityLabel={`${t('movementPain.scoreLabel')} ${t('movementPain.scoreValue', { score: n })}`}
            accessibilityState={{ checked: value === n }}
            aria-checked={value === n}
            onPress={() => onChange(n)}
          />
        ))}
      </View>
      <View style={styles.ends}>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('movementPain.scoreLow')}
        </AppText>
        <AppText variant="caption" color={colors.mutedStrong}>
          {t('movementPain.scoreHigh')}
        </AppText>
      </View>
    </View>
  );
}

/** Pain at the report and each weekly retest, 0–10 (lower is better). */
export function PainBars({ points }: { points: number[] }) {
  const { t } = useTranslation();
  return (
    <View style={barStyles.bars}>
      {points.map((p, i) => (
        <View
          key={i}
          style={barStyles.barCol}
          accessible
          accessibilityLabel={`${t('movementPain.scoreLabel')} ${t('movementPain.scoreValue', { score: p })}`}
        >
          <AppText variant="caption">{String(p)}</AppText>
          <View style={[barStyles.bar, { height: 8 + p * 9 }]} />
        </View>
      ))}
    </View>
  );
}

const barStyles = makeStyles(() => ({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, minHeight: 110 },
  barCol: { alignItems: 'center', gap: spacing.xxs },
  bar: { width: 24, borderRadius: 4, backgroundColor: colors.ink },
}));

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
