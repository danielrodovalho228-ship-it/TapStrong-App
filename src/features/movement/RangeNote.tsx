import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { useColors } from '@/theme';

import type { Exercise } from '../exercises/types';

import { limitFrom } from './progress';
import { movementVerdict } from './rules';
import { activeReports, useMovementPainStore } from './store';

/**
 * "Shorter range" or "gentle hold" under an exercise when a movement that
 * hurts affects it (SPEC §8). Worked out from the live reports, so a swapped
 * exercise gets the right note too.
 */
export function RangeNote({ exercise }: { exercise: Exercise | undefined }) {
  const colors = useColors();
  const { t } = useTranslation();
  const reports = useMovementPainStore((s) => s.reports);
  const limits = activeReports(reports).map(limitFrom);
  if (!exercise || !limits.length) return null;
  const verdict = movementVerdict(exercise, limits, { allowReducedRange: true });
  if (verdict !== 'reduced' && verdict !== 'isometric') return null;
  return (
    <AppText variant="caption" color={colors.teal}>
      {t(`workout.range.${verdict}`)}
    </AppText>
  );
}
