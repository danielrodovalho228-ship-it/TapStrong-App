/**
 * Phase 28, D — the link of a shared card: what goes to the server (adults
 * and 60+ only, the card's safe data plus how the map looked), what the
 * public page accepts back (rebuilt from known values only), the page at
 * /c/<code> (card, "Train with TapStrong", noindex, the invite kept like
 * /r/<code>) and the deep link that opens the exercise.
 */
import '@/i18n';

import { act, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import SharedCardPage from '@/app/c/[code]';
import { buildSyncPlan, type SyncInput } from '@/features/account/sync';
import { useAccountStore } from '@/features/account/store';
import { initialOnboarding } from '@/features/onboarding/store';
import { track } from '@/lib/analytics';
import { uuid } from '@/lib/uuid';

import { parseShareCode } from '../../../supabase/functions/_shared/shareLink';
import { devLibrary } from '../exercises/library';

import { achievementCard, exerciseCard, funCard, muscleCard, weekCard, workoutCard } from './data';
import { linkData, sanitizeCard, sanitizeInvite, sanitizeLook } from './public';
import type { ShareLink } from './store';
import type { CardData } from './types';

const params: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
}));
jest.mock('expo-router/head', () => ({
  __esModule: true,
  // The page's <head> tags, as text, so the test can read them.
  default: ({ children }: { children: React.ReactNode }) => {
    const { Children } = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    const tags = Children.toArray(children).map(
      (c: { type: string; props: object }) => `${c.type}:${JSON.stringify(c.props)}`,
    );
    return <Text testID="head">{tags.join('\n')}</Text>;
  },
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: mockInvoke } }),
  ensureSession: async () => true,
}));

const LIBRARY = devLibrary();
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;
const NOW = new Date('2026-09-30T18:00:00');

function sampleCards(): CardData[] {
  const w = {
    id: 'w1',
    kind: 'regular',
    createdAt: '2026-09-30T07:13:00',
    startedAt: '2026-09-30T07:13:00',
    endedAt: '2026-09-30T07:55:00',
    status: 'done',
    session: {
      items: [
        {
          id: 'i0',
          role: 'main',
          part: 'main',
          exerciseId: squat.id,
          targetMuscle: squat.muscles.find((m) => m.role === 'primary')!.muscleKey,
          goal: 'grow',
          sets: 3,
          reps: [8, 12],
          restSeconds: 90,
          perSide: false,
          loadHint: null,
          estSeconds: 300,
        },
      ],
      minutes: 42,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 42,
      notes: [],
    },
    logs: [1, 2, 3].map((setNo) => ({
      itemId: 'i0',
      exerciseId: squat.id,
      setNo,
      reps: 10,
      load: 60,
      unit: 'kg',
      loggedAt: `2026-09-30T07:2${setNo}:00`,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  } as never;
  return [
    workoutCard(w, LIBRARY, 12, NOW),
    workoutCard(w, LIBRARY, 12, NOW, 'sticker'),
    muscleCard(w)!,
    exerciseCard(squat, 'f'),
    achievementCard({ kind: 'milestone_workouts', params: { count: 25 }, muscles: ['quads'] }),
    achievementCard({ kind: 'fact', params: { fact: 'f01' }, muscles: ['glutes'] }),
    weekCard([w], LIBRARY, NOW, 1),
    funCard([w, w, w, w, w, w], NOW, 1)!,
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(params)) delete params[k];
});

describe('D what the public page accepts', () => {
  it.each(sampleCards().map((c) => [c.template, c] as const))(
    '%s comes back exactly as shared',
    (_, card) => {
      const row = linkData({ data: card }, { sex: 'm', band: 'senior' });
      expect(sanitizeCard(card.template, JSON.parse(JSON.stringify(row)))).toEqual(card);
      expect(sanitizeLook(row)).toEqual({ sex: 'm', band: 'senior' });
    },
  );

  it('a hand-made link cannot put its own words on the page', () => {
    const phishing = 'Your account is locked: log in at evil.example';
    expect(sanitizeCard('muscle', { template: 'muscle', muscle: phishing })).toBeNull();
    expect(
      sanitizeCard('achievement', {
        template: 'achievement',
        kind: 'milestone_workouts',
        params: { count: 3, muscle: phishing },
        lit: {},
      }),
    ).toBeNull();
    expect(
      sanitizeCard('achievement', {
        template: 'achievement',
        kind: 'milestone_workouts',
        params: { count: phishing },
        lit: {},
      }),
    ).toBeNull();
    // A pain Moment never becomes a public card, whatever the row says.
    expect(
      sanitizeCard('achievement', {
        template: 'achievement',
        kind: 'coach_pain',
        params: {},
        lit: {},
      }),
    ).toBeNull();
    expect(
      sanitizeCard('exercise', {
        template: 'exercise',
        exerciseId: phishing,
        primary: [],
        secondary: [],
      }),
    ).toBeNull();
    expect(sanitizeCard('fun', { template: 'fun', thing: phishing, count: 2 })).toBeNull();
    expect(sanitizeCard('muscle', { template: 'week', muscle: 'glutes' })).toBeNull();
    expect(sanitizeCard('body_photo', { template: 'body_photo' })).toBeNull();
    // A minor's look is never drawn: the adult body instead.
    expect(sanitizeLook({ look: { sex: 'f', band: 'teen' } }).band).toBe('adult');
    expect(sanitizeInvite('<b>hi</b>')).toBeNull();
    expect(sanitizeInvite('OWNER28')).toBe('OWNER28');
  });

  it('the function takes only a well-formed code', () => {
    expect(parseShareCode({ code: 'ABCD2345' })).toBe('abcd2345');
    expect(parseShareCode({ code: 'abcd1234' })).toBeNull(); // 1 is a look-alike
    expect(parseShareCode({ code: "abcd2345' or 1=1" })).toBeNull();
    expect(parseShareCode(null)).toBeNull();
  });
});

describe('D what goes to the server', () => {
  const link = (): ShareLink => ({
    id: uuid(),
    code: 'abcd2345',
    template: 'muscle',
    data: { template: 'muscle', muscle: 'glutes' },
    look: { sex: 'f', band: 'adult' },
    createdAt: '2026-09-30T18:00:00.000Z',
  });
  const input = (birthYear: number): SyncInput => ({
    userId: uuid(),
    profileId: uuid(),
    onboarding: {
      ...initialOnboarding(),
      birthMonth: 3,
      birthYear,
      sex: 'f',
      onboardingComplete: true,
    },
    restrictions: [],
    workouts: [],
    streak: { current: 0, best: 0, lastActive: null, freezes: 0, freezesUsed: [] } as never,
    activity: {},
    badges: [],
    exerciseIds: new Map(),
    library: LIBRARY,
    shareLinks: [link()],
  });

  it('adults and 60+: code, template, the card and the look; nothing else', () => {
    for (const year of [1985, 1955]) {
      const plan = buildSyncPlan(input(year));
      if (typeof plan === 'string') throw new Error(plan);
      expect(plan.shareLinks).toHaveLength(1);
      expect(Object.keys(plan.shareLinks[0]).sort()).toEqual(
        ['code', 'created_at', 'data', 'id', 'profile_id', 'template'].sort(),
      );
      expect(plan.shareLinks[0].data).toEqual({
        template: 'muscle',
        muscle: 'glutes',
        look: { sex: 'f', band: 'adult' },
      });
    }
  });

  it('a teen never sends a link', () => {
    const plan = buildSyncPlan(input(2011));
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.shareLinks).toEqual([]);
  });
});

describe('D the page at /c/<code>', () => {
  const card = { template: 'muscle', muscle: 'glutes', look: { sex: 'f', band: 'adult' } };

  it('draws the card, invites to train, is never indexed, and keeps the invite', async () => {
    useAccountStore.getState().reset();
    mockInvoke.mockResolvedValue({
      data: { status: 'ok', template: 'muscle', data: card, invite: 'OWNER28' },
      error: null,
    });
    params.code = 'abcd2345';
    await render(<SharedCardPage />);
    await waitFor(() => expect(screen.getByTestId('shared-card')).toBeTruthy());
    expect(mockInvoke).toHaveBeenCalledWith('share-link', { body: { code: 'abcd2345' } });
    expect(screen.getByText('Train with TapStrong')).toBeTruthy();
    expect(screen.getByTestId('share-card-muscle')).toBeTruthy();
    expect(screen.getByTestId('head')).toHaveTextContent(/robots.*noindex, nofollow/);
    expect(track).toHaveBeenCalledWith('share_link_opened', { template: 'muscle' });
    expect(useAccountStore.getState().pendingReferral).toBe('OWNER28');
    // No counter anywhere on the page.
    expect(screen.queryByText(/\d+\s*(opens?|views?|visits?)\b/i)).toBeNull();
  });

  it('an unknown code: a friendly page, no card', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { status: 404 } });
    params.code = 'zzzz2345';
    await render(<SharedCardPage />);
    await waitFor(() => expect(screen.getByText('This card is no longer here.')).toBeTruthy());
    expect(screen.queryByTestId('shared-card')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('in the app, an exercise sheet opens that exercise', async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    mockInvoke.mockResolvedValue({
      data: {
        status: 'ok',
        template: 'exercise',
        data: {
          ...exerciseCard(squat, 'f'),
          look: { sex: 'f', band: 'adult' },
        },
        invite: null,
      },
      error: null,
    });
    params.code = 'abcd2345';
    await render(<SharedCardPage />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/exercise/[id]',
        params: { id: squat.id },
      }),
    );
    await act(async () => undefined);
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });
});
