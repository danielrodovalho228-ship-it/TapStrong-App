import { localDate, weekStart, type WeekStartDay } from '@/lib/dates';

import { derive } from '../onboarding/derived';
import type { OnboardingData } from '../onboarding/store';
import type { AppMode } from '../profile/age';
import { streakToday, type StreakState } from '../workout/streak';
import type { WorkoutRecord } from '../workout/types';

import type { LocalProfile } from './store';

const KEY = (id: string) => `profile-snapshot:${id}`;

export type ProfileSummary = { profile: LocalProfile; mode: AppMode | null; age: number | null };

/** Age mode of a stored profile, from its onboarding answers. */
export function summarize(
  profile: LocalProfile,
  activeId: string | null,
  live: OnboardingData,
  read: (key: string) => string | null,
): ProfileSummary {
  let data: Partial<OnboardingData> | undefined;
  if (profile.id === activeId) data = live;
  else {
    const raw = read(KEY(profile.id));
    data = raw
      ? (JSON.parse(raw) as { onboarding: Partial<OnboardingData> }).onboarding
      : undefined;
  }
  const d = data ? derive({ birthMonth: data.birthMonth, birthYear: data.birthYear }) : null;
  return { profile, mode: d?.mode ?? null, age: d?.age ?? null };
}

export type ActivitySummary = {
  workoutsThisWeek: number;
  lastWorkoutAt: string | null;
  streak: number;
  minutesThisWeek: number;
};

type SnapshotActivity = { workouts: WorkoutRecord[]; streak: StreakState };

/**
 * What the Family plan owner sees for a member (mockup 23: "Alex can see it
 * too on the Family plan"): this week's workouts and minutes, last workout
 * and streak. Never health answers, pain reports or photos.
 */
export function activitySummary(
  profile: LocalProfile,
  read: (key: string) => string | null,
  now: Date,
  startsOn: WeekStartDay,
): ActivitySummary | null {
  const raw = read(KEY(profile.id));
  if (!raw) return null;
  const snap = JSON.parse(raw) as SnapshotActivity;
  const week = weekStart(localDate(now), startsOn);
  const finished = (snap.workouts ?? []).filter(
    (w) => (w.status === 'done' || w.status === 'partial') && w.logs.length > 0,
  );
  const thisWeek = finished.filter(
    (w) => weekStart(localDate(new Date(w.endedAt ?? w.createdAt)), startsOn) === week,
  );
  const last =
    finished
      .map((w) => w.endedAt ?? w.createdAt)
      .sort()
      .pop() ?? null;
  return {
    workoutsThisWeek: thisWeek.length,
    minutesThisWeek: thisWeek.reduce(
      (n, w) =>
        n +
        Math.max(
          1,
          Math.round(
            (Date.parse(w.endedAt ?? w.createdAt) - Date.parse(w.startedAt ?? w.createdAt)) / 60000,
          ),
        ),
      0,
    ),
    lastWorkoutAt: last,
    streak: snap.streak ? streakToday(snap.streak, localDate(now), startsOn) : 0,
  };
}

/**
 * The account owner's age (their own profile), wherever it is stored: live
 * when active, otherwise in its snapshot. Null until they set a birth date.
 */
export function ownerAge(
  profiles: LocalProfile[],
  activeId: string | null,
  live: OnboardingData,
  read: (key: string) => string | null,
): number | null {
  const self = profiles.find((p) => p.kind === 'self');
  if (!self) return derive({ birthMonth: live.birthMonth, birthYear: live.birthYear })?.age ?? null;
  return summarize(self, activeId ?? self.id, live, read).age;
}

/** The account owner's own onboarding answers: live when active, else its snapshot. */
export function ownerOnboarding(
  profiles: LocalProfile[],
  activeId: string | null,
  live: OnboardingData,
  read: (key: string) => string | null,
): Partial<OnboardingData> | null {
  const self = profiles.find((p) => p.kind === 'self');
  if (!self || self.id === (activeId ?? self.id)) return live;
  const raw = read(KEY(self.id));
  return raw ? (JSON.parse(raw) as { onboarding: Partial<OnboardingData> }).onboarding : null;
}
