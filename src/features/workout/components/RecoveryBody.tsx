import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, SegmentedControl } from '@/components/ui';
import { BodyMapCanvas } from '@/features/bodymap/components/BodyMapCanvas';
import type { BodySex, BodyView } from '@/features/bodymap/images';
import type { BodyBand } from '@/features/profile/age';
import { dotColors, recoveryColors, spacing } from '@/theme';

import type { RecoveryState } from '../recovery';

export const STATE_COLOR: Record<Exclude<RecoveryState, 'neutral'>, string> = {
  fresh: recoveryColors.fresh,
  recovering: recoveryColors.recovering,
  almost: recoveryColors.almost,
  neglected: recoveryColors.neglected,
};

/** Recovery colors per muscle; neutral (ready) muscles stay small white dots. */
export function recoveryFills(states: Record<string, RecoveryState>) {
  return Object.fromEntries(
    Object.entries(states).map(([k, v]) => [k, v === 'neutral' ? undefined : STATE_COLOR[v]]),
  );
}

/**
 * Read-only body with recovery colors (mockups 07, 14, 15). It is the body
 * map itself (QA O-1b): same image, same hotspot positions and the same dot,
 * sized in proportion to the body. A trained muscle's dot is filled with its
 * recovery color plus a soft halo; ready muscles stay white. The body takes
 * the full width it is given. `views="toggle"` adds a front/back switch;
 * `views="both"` shows the two side by side (share card).
 */
export function RecoveryBody({
  band,
  sex,
  states,
  maxHeight = 640,
  views = 'toggle',
}: {
  band: BodyBand;
  sex: BodySex;
  states: Record<string, RecoveryState>;
  maxHeight?: number;
  views?: 'toggle' | 'both';
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<BodyView>('front');
  const recovery = recoveryFills(states);
  const canvas = (v: BodyView) => (
    <BodyMapCanvas
      readOnly
      band={band}
      sex={sex}
      view={v}
      selected={[]}
      recovery={recovery}
      maxHeight={maxHeight}
      accessibilityLabel={`${t('workout.bodyNow')}, ${t(`bodyMap.${v}`)}`}
      dotTestID={(key) => `recovery-${key}-${states[key] ?? 'neutral'}`}
    />
  );
  if (views === 'both') {
    return (
      <View style={styles.both}>
        {(['front', 'back'] as const).map((v) => (
          <View key={v} style={styles.half}>
            {canvas(v)}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {canvas(view)}
      <SegmentedControl
        accessibilityLabel={t('bodyMap.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: t('bodyMap.front') },
          { value: 'back', label: t('bodyMap.back') },
        ]}
      />
    </View>
  );
}

/** Legend entry drawn like a map dot; no color = a ready (white) dot. */
export function LegendRow({ color, label }: { color?: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.swatch,
          color
            ? { backgroundColor: color, borderColor: dotColors.untrained }
            : { backgroundColor: dotColors.untrained, borderColor: dotColors.ring },
        ]}
      />
      <AppText style={styles.legendText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  both: { flexDirection: 'row', gap: spacing.xs },
  half: { flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  legendText: { flex: 1 },
});
