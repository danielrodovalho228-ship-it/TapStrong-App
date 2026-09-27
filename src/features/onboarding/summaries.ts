import type { TFunction } from 'i18next';

import { muscleByKey } from '../muscles';
import { cmToFeetInches, kgToLb } from '../profile/units';

import { derive } from './derived';
import type { InterviewStep, MuscleGoalEntry } from './options';
import type { OnboardingData } from './store';
import { sexLabelKey } from './visible';

export function muscleLabel(t: TFunction, key: string): string {
  const muscle = muscleByKey(key);
  return muscle ? t(muscle.labelKey as 'muscles.chest') : key;
}

export function musclePairs(
  t: TFunction,
  entries: MuscleGoalEntry[],
  key: 'chat.musclePair' | 'profile.goalPair',
) {
  return entries
    .map((m) => t(key, { muscle: muscleLabel(t, m.muscleKey), goal: t(`muscleGoals.${m.goal}`) }))
    .join(key === 'chat.musclePair' ? ', ' : ' · ');
}

export function measurementText(t: TFunction, s: OnboardingData): string | null {
  const parts: string[] = [];
  if (s.heightCm) {
    if (s.units === 'imperial') {
      const { feet, inches } = cmToFeetInches(s.heightCm);
      parts.push(`${feet} ${t('chat.units.ft')} ${inches} ${t('chat.units.in')}`);
    } else parts.push(`${Math.round(s.heightCm)} ${t('chat.units.cm')}`);
  }
  if (s.weightKg) {
    parts.push(
      s.units === 'imperial'
        ? `${kgToLb(s.weightKg)} ${t('chat.units.lb')}`
        : `${Math.round(s.weightKg)} ${t('chat.units.kg')}`,
    );
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Text of the user's bubble when they answered with chips instead of typing. */
export function answerSummary(t: TFunction, step: InterviewStep, s: OnboardingData): string {
  switch (step) {
    case 'goals':
      return s.mainGoals.map((g) => t(`mainGoals.${g}`)).join(', ');
    case 'schedule':
      return t('chat.summary.schedule', {
        place: s.location ? t(`locations.${s.location}`) : '',
        minutes: s.minutes,
        days: s.daysPerWeek,
      });
    case 'focus':
      return s.focusDeferred
        ? t('chat.focusLater')
        : s.muscleGoals.map((m) => muscleLabel(t, m.muscleKey)).join(', ');
    case 'body': {
      const sex = t(sexLabelKey(s.sex, derive(s)?.mode ?? 'adult'));
      const measures = measurementText(t, s);
      return measures ? `${sex} · ${measures}` : sex;
    }
  }
}

/** Coach line after a finished step. */
export function coachAck(t: TFunction, step: InterviewStep, s: OnboardingData): string | null {
  if (step === 'focus') {
    return s.focusDeferred || !s.muscleGoals.length
      ? t('chat.focusDeferred')
      : t('chat.focusMarked', { list: musclePairs(t, s.muscleGoals, 'chat.musclePair') });
  }
  return s.chat[step]?.reply ?? null;
}
