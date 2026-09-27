import type { AppMode } from '../profile/age';

import {
  DAYS_RANGE,
  MINUTES_RANGE,
  type InterviewAnswer,
  type Location,
} from '../../../supabase/functions/_shared/interview';

import type { InterviewStep, MainGoal, MuscleGoalEntry, Sex } from './options';

export type StepState = {
  mainGoals: MainGoal[];
  location?: Location;
  minutes?: number;
  daysPerWeek?: number;
  muscleGoals: MuscleGoalEntry[];
  focusDeferred: boolean;
  /** undefined = not chosen yet; null = neutral body. */
  sex?: Sex | null;
};

export function isStepComplete(step: InterviewStep, s: StepState): boolean {
  switch (step) {
    case 'goals':
      return s.mainGoals.length > 0;
    case 'schedule':
      return !!s.location && !!s.minutes && !!s.daysPerWeek;
    case 'focus':
      return s.muscleGoals.length > 0 || s.focusDeferred;
    case 'body':
      return s.sex !== undefined;
  }
}

/** Free text is not offered in child mode (SPEC §2.3: guided choices only). */
export function allowsFreeText(mode: AppMode): boolean {
  return mode !== 'child';
}

/**
 * Children and teens never enter measurements (SPEC §2.3; QA round 3: the
 * teen notice promises no measurements, so height and weight aren't asked).
 */
export function allowsMeasurements(mode: AppMode): boolean {
  return mode === 'adult' || mode === 'senior';
}

// ---------------------------------------------------------------------------
// Offline parser for the schedule answer ("Gym, about 40 minutes, 3 days a
// week"), used when the coach service is not configured or unreachable.
// ---------------------------------------------------------------------------

const LOCATION_WORDS: Record<Location, RegExp> = {
  gym: /\b(gym|gimnasio|academia)\b/i,
  home: /\b(home|house|casa|hogar)\b/i,
  outdoors: /\b(outdoors?|outside|park|parque|al aire libre|ao ar livre|rua)\b/i,
};

export function parseScheduleLocally(text: string): InterviewAnswer {
  const answer: InterviewAnswer = {};
  for (const [location, pattern] of Object.entries(LOCATION_WORDS) as [Location, RegExp][]) {
    if (pattern.test(text)) {
      answer.location = location;
      break;
    }
  }

  const minutes = /(\d{1,3})\s*(?:-\s*\d{1,3}\s*)?(?:min|minutes|minutos|mins)\b/i.exec(text);
  const hours = /(\d(?:[.,]5)?)\s*(?:h|hr|hrs|hours?|horas?)\b/i.exec(text);
  if (minutes) answer.minutes = Number(minutes[1]);
  else if (hours) answer.minutes = Math.round(Number(hours[1].replace(',', '.')) * 60);
  if (
    answer.minutes !== undefined &&
    (answer.minutes < MINUTES_RANGE[0] || answer.minutes > MINUTES_RANGE[1])
  ) {
    delete answer.minutes;
  }

  const days = /(\d)\s*(?:x|times|days?|d[ií]as?|vezes|veces)\b/i.exec(text);
  if (days) {
    const n = Number(days[1]);
    if (n >= DAYS_RANGE[0] && n <= DAYS_RANGE[1]) answer.daysPerWeek = n;
  }
  return answer;
}
