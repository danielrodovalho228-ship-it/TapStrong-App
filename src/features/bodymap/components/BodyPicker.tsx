import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/ui';
import { derive } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import { spacing } from '@/theme';

import { muscleFamily } from '../../muscles';

import type { BodySex, BodyView } from '../images';
import { displayBand } from '../selection';

import { BodyMapCanvas } from './BodyMapCanvas';

/**
 * "Muscles worked" dots (QA R4-06): main muscles filled, secondary as a
 * light halo. Parent keys ("chest") light their child dots.
 */
export function workedDots(primary: string[], secondary: string[]) {
  const main = [...new Set(primary.flatMap(muscleFamily))];
  const halo = [...new Set(secondary.flatMap(muscleFamily))].filter((k) => !main.includes(k));
  return { main, halo };
}

/**
 * The body map with its dots, a Front/Back switch and a sideways swipe that
 * turns the body 180° (improvements v1, B1). Used by the Library, Single
 * workout and Create exercise; the same `BodyMapCanvas` as everywhere else.
 */
export function BodyPicker({
  selected,
  onToggle,
  outlined = [],
  readOnly = false,
  maxHeight = 420,
  accessibilityLabel,
}: {
  selected: string[];
  onToggle?: (muscleKey: string) => void;
  /** Read-only "muscles worked": secondary muscles, drawn lighter. */
  outlined?: string[];
  readOnly?: boolean;
  maxHeight?: number;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  const s = useOnboardingStore();
  const derived = derive(s);
  const [view, setView] = useState<BodyView>('front');
  const band = displayBand(s.bodyModel.band, derived?.band ?? 'adult', derived?.mode ?? 'adult');
  const sex: BodySex = s.bodyModel.sex ?? (s.sex === 'f' ? 'f' : 'm');
  const [turn] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60) setView((v) => (v === 'front' ? 'back' : 'front'));
      },
    }),
  );
  const { main, halo } = workedDots(selected, outlined);
  const recovery = Object.fromEntries(halo.map((k) => [k, 'rgba(194,62,23,0.35)']));

  return (
    <View style={styles.wrap}>
      <View {...turn.panHandlers}>
        <BodyMapCanvas
          band={band}
          sex={sex}
          view={view}
          selected={readOnly ? main : selected}
          recovery={recovery}
          onToggle={onToggle}
          readOnly={readOnly}
          accessibilityLabel={accessibilityLabel}
          maxHeight={maxHeight}
        />
      </View>
      <SegmentedControl
        accessibilityLabel={t('bodyMap.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: t('bodyMap.front'), accessibilityLabel: t('bodyMap.frontView') },
          { value: 'back', label: t('bodyMap.back'), accessibilityLabel: t('bodyMap.backView') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.sm } });
