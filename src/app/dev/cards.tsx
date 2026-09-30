import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { BodyBand } from '@/features/profile/age';
import { devLibrary } from '@/features/exercises/library';
import type { MonthSummary } from '@/features/month/summary';
import {
  achievementCard,
  exerciseCard,
  funCard,
  monthCard,
  muscleCard,
  weekCard,
  workoutCard,
} from '@/features/share/data';
import { ShareCard } from '@/features/share/ShareCard';
import { shortLink } from '@/features/share/store';
import type {
  CardChrome,
  CardData,
  ShareBackground,
  ShareFormat,
  ShareTemplate,
} from '@/features/share/types';
import type { WorkoutRecord } from '@/features/workout/types';

/**
 * Development only: one share card drawn from the address, for the render
 * check (scripts/shoot-share-cards.mjs): every template × background ×
 * language × format, checked for cut text. Release builds go Home.
 */
export default function DevCards() {
  return __DEV__ ? <CardGallery /> : <Redirect href="/home" />;
}

const NOW = new Date('2026-09-30T18:00:00');

function sampleWorkout(date: string, moves: string[]): WorkoutRecord {
  const library = devLibrary();
  const pick = (pattern: string) => library.find((e) => e.pattern === pattern && e.loaded)!;
  const exercises = moves.map(pick);
  return {
    id: `w-${date}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:48:00`,
    status: 'done',
    session: {
      items: exercises.map((e, n) => ({
        id: `i${n}`,
        role: 'main' as const,
        part: 'main' as const,
        exerciseId: e.id,
        targetMuscle: e.muscles.find((m) => m.role === 'primary')!.muscleKey,
        goal: 'grow' as const,
        sets: 3,
        reps: [8, 12] as [number, number],
        restSeconds: 90,
        perSide: false,
        loadHint: null,
        estSeconds: 300,
      })),
      minutes: 48,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 48,
      notes: [],
    },
    logs: exercises.flatMap((e, n) =>
      [1, 2, 3].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: e.id,
        setNo,
        reps: 10,
        load: 60,
        unit: 'kg' as const,
        loggedAt: `${date}T09:${10 + n * 5 + setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [],
  };
}

function sampleCard(template: ShareTemplate): CardData | null {
  const library = devLibrary();
  const week = [
    sampleWorkout('2026-09-28', ['squat', 'horizontal_pull', 'hinge']),
    sampleWorkout('2026-09-29', ['vertical_pull', 'horizontal_push']),
    sampleWorkout('2026-09-30', ['horizontal_pull', 'vertical_pull', 'hinge']),
  ];
  const last = week[2];
  const month: MonthSummary = {
    blockNo: 2,
    weeks: 4,
    from: '2026-09-01',
    to: '2026-09-29',
    workouts: 13,
    trainedDays: [],
    minutes: 540,
    sets: { quads: 36, lats: 30, chest: 24, glutes: 28, hamstrings: 10 },
    prevSets: {},
    strength: [],
    records: [],
    strong: { muscle: 'lats', perWeek: 7.5, kind: 'most' },
    weak: { muscle: 'hamstrings' },
  };
  switch (template) {
    case 'workout':
    case 'sticker':
      return workoutCard(last, library, 12, NOW, template);
    case 'muscle':
      return muscleCard(last);
    case 'exercise':
      return exerciseCard(
        library.find((e) => e.pattern === 'hinge' && e.loaded)!,
        'f',
      );
    case 'achievement':
      return achievementCard({
        kind: 'milestone_workouts',
        params: { count: 25 },
        muscles: ['lats', 'quads'],
      });
    case 'week':
      return weekCard(week, library, NOW, 1);
    case 'month':
      return monthCard(month);
    case 'fun':
      return funCard(week, NOW, 1);
  }
}

function CardGallery() {
  const { i18n } = useTranslation();
  const p = useLocalSearchParams<{
    template?: ShareTemplate;
    bg?: ShareBackground;
    format?: ShareFormat;
    lang?: string;
    mode?: CardChrome['mode'];
    band?: BodyBand;
  }>();
  useEffect(() => {
    if (p.lang && i18n.language !== p.lang) void i18n.changeLanguage(p.lang);
  }, [p.lang, i18n]);
  const data = useMemo(() => sampleCard(p.template ?? 'workout'), [p.template]);
  if (!data) return null;
  const mode = p.mode ?? 'adult';
  return (
    <View testID="card-stage" style={{ alignSelf: 'flex-start' }}>
      <ShareCard
        data={data}
        chrome={{
          background: p.bg ?? 'light',
          format: p.format ?? 'story',
          mode,
          sex: 'f',
          band: p.band ?? (mode === 'senior' ? 'senior' : mode === 'teen' ? 'teen' : 'adult'),
          name: null,
          link: mode === 'teen' ? null : shortLink('abcd2345'),
        }}
      />
    </View>
  );
}
