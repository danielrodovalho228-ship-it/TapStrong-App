import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { colors } from '@/theme';

import type { Exercise } from '../../exercises/types';
import { needsCaution } from '../../generator/dosage';
import { useOnboardingStore } from '../../onboarding/store';

/**
 * Per-person safety cues in the player: "hold a chair" for people who train
 * with support (QA C-08), and "breathe, don't strain" with a doctor reminder
 * for a heart condition or high blood pressure (QA C-09).
 */
export function SafetyCues({ exercise }: { exercise: Exercise | undefined }) {
  const { t } = useTranslation();
  const position = useOnboardingStore((s) => s.position);
  const conditions = useOnboardingStore((s) => s.conditions);
  if (!exercise) return null;
  const standing =
    exercise.positions.includes('standing') || exercise.positions.includes('with_support');
  const support = position === 'with_support' && standing && exercise.pattern !== 'breathing';
  const caution = needsCaution(conditions) && exercise.pattern !== 'breathing';
  if (!support && !caution) return null;
  return (
    <>
      {support ? (
        <AppText variant="caption" color={colors.teal}>
          {t('workout.cues.support')}
        </AppText>
      ) : null}
      {caution ? (
        <AppText variant="caption" color={colors.teal}>
          {t('workout.cues.breathe')}
        </AppText>
      ) : null}
    </>
  );
}
