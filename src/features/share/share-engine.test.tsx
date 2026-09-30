/**
 * Phase 28, A — the card engine: every card is built from safe data only
 * (never weight, measurements, BMI, photos, place, exact time, pain,
 * restrictions or a minor's name), the footer carries the brand and the
 * short link (the name only when turned on, never a minor's), both formats
 * and the three backgrounds render, and the share targets do what they say.
 */
import '@/i18n';

import { render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Media from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import RNShare from 'react-native-share';
import { captureRef } from 'react-native-view-shot';

import type { Exercise } from '@/features/exercises/types';
import type { MonthSummary } from '@/features/month/summary';
import type { WorkoutRecord } from '@/features/workout/types';

import { devLibrary } from '../exercises/library';

import { shareCard, targetsFor } from './actions';
import {
  achievementCard,
  allowedCard,
  exerciseCard,
  funCard,
  monthCard,
  muscleCard,
  rangeMonthCard,
  templatesFor,
  weekCard,
  workoutCard,
} from './data';
import { funComparison, THINGS } from './fun';
import { ShareCard } from './ShareCard';
import { shareCode, shortLink } from './store';
import type { CardChrome, CardData } from './types';

const LIBRARY = devLibrary();
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.loaded && e.parts.includes('main'))!;
const row = LIBRARY.find((e) => e.pattern === 'horizontal_pull' && e.parts.includes('main'))!;
const NOW = new Date('2026-09-30T18:00:00');

/** A workout full of things that must never reach a card. */
function richWorkout(): WorkoutRecord {
  return {
    id: 'w1',
    kind: 'regular',
    createdAt: '2026-09-30T07:13:00',
    startedAt: '2026-09-30T07:13:00',
    endedAt: '2026-09-30T07:55:00',
    status: 'done',
    session: {
      items: [squat, row].map((e, n) => ({
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
      minutes: 42,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 42,
      notes: [],
    },
    logs: [squat, row].flatMap((e, n) =>
      [1, 2, 3].map((setNo) => ({
        itemId: `i${n}`,
        exerciseId: e.id,
        setNo,
        reps: 10,
        load: 83.4,
        unit: 'kg' as const,
        loggedAt: `2026-09-30T07:2${setNo}:00`,
      })),
    ),
    skipped: [],
    swaps: [],
    pains: [
      {
        itemId: 'i0',
        exerciseId: squat.id,
        area: 'knee',
        side: 'left',
        type: 'dull',
        action: 'continued',
        reportedAt: '2026-09-30T07:30:00Z',
      },
    ],
  };
}

const SUMMARY: MonthSummary = {
  blockNo: 2,
  weeks: 4,
  from: '2026-09-01',
  to: '2026-09-29',
  workouts: 9,
  trainedDays: ['2026-09-01', '2026-09-04'],
  minutes: 380,
  sets: { quads: 30, lats: 12, chest: 20 },
  prevSets: {},
  strength: [
    {
      exerciseId: squat.id,
      kind: 'load',
      first: { value: 60, unit: 'kg', reps: 10 },
      last: { value: 83.4, unit: 'kg', reps: 10 },
    } as never,
  ],
  records: [{ exerciseId: squat.id, kind: 'heaviest', value: 83.4, unit: 'kg' }],
  strong: { muscle: 'quads', perWeek: 7.5, kind: 'most' },
  weak: { muscle: 'hamstrings' },
};

function allCards(): CardData[] {
  const w = richWorkout();
  return [
    workoutCard(w, LIBRARY, 12, NOW),
    workoutCard(w, LIBRARY, 12, NOW, 'sticker'),
    muscleCard(w)!,
    exerciseCard(squat as Exercise, 'f'),
    achievementCard({ kind: 'coach_pain', params: { area: 'knee' }, muscles: [] }),
    achievementCard({ kind: 'milestone_workouts', params: { count: 25 }, muscles: ['quads'] }),
    weekCard([w], LIBRARY, NOW, 1),
    monthCard(SUMMARY),
    rangeMonthCard([w], LIBRARY, NOW),
    funCard([w], NOW, 1)!,
  ];
}

describe('A3 nothing sensitive ever gets into a card', () => {
  const FORBIDDEN_KEYS =
    /weight|height|measure|bmi|whtr|photo|image|location|place|lat$|lng|gps|time|at$|date|pain|area|side|restriction|condition|name|email|load|record|strength/i;
  const FORBIDDEN_VALUES = [/83\.4/, /\bknee\b/, /07:1\d/, /T\d\d:\d\d/, /@/];

  const walk = (value: unknown, path: string, out: string[]) => {
    if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) {
        // Muscle keys are data, not field names ("lit": { quads: "main" }).
        const isMuscleMap = path.endsWith('.lit');
        if (!isMuscleMap && FORBIDDEN_KEYS.test(k)) out.push(`${path}.${k}`);
        walk(v, `${path}.${k}`, out);
      }
    else if (typeof value === 'string' || typeof value === 'number')
      for (const re of FORBIDDEN_VALUES) if (re.test(String(value))) out.push(`${path}=${value}`);
  };

  it.each(allCards().map((c) => [c.template, c] as const))('%s', (_, card) => {
    const found: string[] = [];
    walk(card, card.template, found);
    // "monthOf" is the month's day for its name only (never a time).
    expect(found.filter((f) => !f.endsWith('.monthOf'))).toEqual([]);
  });

  it('a pain Moment keeps no pain area', () => {
    const card = achievementCard({ kind: 'coach_pain', params: { area: 'knee' }, muscles: [] });
    expect(JSON.stringify(card)).not.toContain('knee');
  });
});

describe('A1/A2 the card', () => {
  const chrome = (patch: Partial<CardChrome> = {}): CardChrome => ({
    background: 'light',
    format: 'story',
    mode: 'adult',
    sex: 'f',
    band: 'adult',
    link: shortLink('abcd2345'),
    ...patch,
  });

  it.each(['light', 'dark', 'transparent'] as const)('%s background, both formats', async (bg) => {
    for (const format of ['story', 'feed'] as const) {
      await render(<ShareCard data={allCards()[0]} chrome={chrome({ background: bg, format })} />);
      const card = screen.getByTestId('share-card-workout');
      const style = [card.props.style].flat(3).reduce((a, b) => ({ ...a, ...b }), {});
      expect(style.width).toBe(360);
      expect(style.height).toBe(format === 'story' ? 640 : 450);
      if (bg === 'transparent') expect(style.backgroundColor).toBe('transparent');
      else expect(style.backgroundColor).not.toBe('transparent');
    }
  });

  it('the footer: the brand and the short link; the name only when given', async () => {
    await render(<ShareCard data={allCards()[0]} chrome={chrome()} />);
    expect(screen.getByTestId('card-link')).toHaveTextContent('tapstrong.app/c/abcd2345');
    expect(screen.queryByText('Ana')).toBeNull();
    await render(<ShareCard data={allCards()[0]} chrome={chrome({ name: 'Ana' })} />);
    expect(screen.getByText('Ana')).toBeTruthy();
  });

  it('short codes: 8 characters, no look-alikes', () => {
    for (let i = 0; i < 200; i++) expect(shareCode()).toMatch(/^[a-hjkmnp-z2-9]{8}$/);
    expect(shortLink('abcd2345')).toBe('tapstrong.app/c/abcd2345');
  });
});

describe('B6 fun comparisons', () => {
  it('rounded to a half, the biggest thing that fits, none under a panda', () => {
    expect(funComparison(50)).toBeNull();
    expect(funComparison(1_020)).toEqual({ thing: 'car', count: 1 });
    expect(funComparison(1_300)).toEqual({ thing: 'car', count: 1.5 });
    expect(funComparison(4_985)).toEqual({ thing: 'car', count: 5 });
    expect(funComparison(13_000)).toEqual({ thing: 'bus', count: 1 });
    // The table is sorted and every weight is a round, typical value.
    const kgs = THINGS.map((t) => t.kg);
    expect([...kgs].sort((a, b) => a - b)).toEqual(kgs);
  });
});

describe('E ages: which cards', () => {
  it('minors: muscle of the day, workout and habit achievements only', () => {
    expect(templatesFor('teen').sort()).toEqual(['achievement', 'muscle', 'sticker', 'workout']);
    const habit = achievementCard({ kind: 'first_back', params: {}, muscles: [] });
    const reps = achievementCard({ kind: 'milestone_reps', params: { count: 1000 }, muscles: [] });
    expect(allowedCard(habit, 'teen')).toBe(true);
    expect(allowedCard(reps, 'teen')).toBe(false);
    expect(allowedCard(monthCard(SUMMARY), 'teen')).toBe(false);
    expect(allowedCard(funCard([richWorkout()], NOW, 1)!, 'teen')).toBe(false);
    expect(allowedCard(funCard([richWorkout()], NOW, 1)!, 'senior')).toBe(true);
  });

  it('60+: WhatsApp first; the sticker adds "Copy sticker"', () => {
    expect(targetsFor('senior', 'light')[0]).toBe('whatsapp');
    expect(targetsFor('adult', 'light')[0]).toBe('instagram');
    expect(targetsFor('adult', 'transparent')).toContain('copy');
    expect(targetsFor('adult', 'light')).not.toContain('copy');
  });
});

describe('A4 share targets', () => {
  const ref = { current: {} as never };
  const base = {
    ref,
    format: 'story' as const,
    background: 'light' as const,
    template: 'workout' as const,
    message: 'https://tapstrong.app/c/abcd2345',
  };
  const env = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  afterEach(() => {
    process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = env;
    jest.clearAllMocks();
  });

  it('captures a 1080 × 1920 PNG', async () => {
    await shareCard({ ...base, target: 'more' });
    expect(captureRef).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ format: 'png', width: 1080, height: 1920 }),
    );
  });

  it('Instagram Stories with the App ID; a sticker goes as the sticker layer', async () => {
    process.env.EXPO_PUBLIC_FACEBOOK_APP_ID = '1234';
    await shareCard({ ...base, target: 'instagram', background: 'transparent' });
    expect(RNShare.shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({ appId: '1234', stickerImage: 'file:///tmp/card.png' }),
    );
  });

  it('without the App ID, Instagram falls back to the system sheet', async () => {
    delete process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    expect(await shareCard({ ...base, target: 'instagram' })).toBe('fallback');
    expect(RNShare.shareSingle).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it('WhatsApp, the gallery and the sticker copy', async () => {
    await shareCard({ ...base, target: 'whatsapp' });
    expect(RNShare.shareSingle).toHaveBeenCalledWith(
      expect.objectContaining({ social: 'whatsapp', type: 'image/png' }),
    );
    await shareCard({ ...base, target: 'save' });
    expect(Media.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(Media.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/card.png');
    await shareCard({ ...base, target: 'copy', background: 'transparent' });
    expect(Clipboard.setImageAsync).toHaveBeenCalledWith('iVBORw0KGgo=');
  });
});
