/**
 * Phase 28, E — ages, family and privacy. A minor without the parent's
 * switch sees no share button anywhere; with it, only the minor cards, with
 * no name and no link. Adults choose "Show my name" (off by default) and
 * "Never show share offers"; 60+ get WhatsApp first.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ExerciseScreen from '@/app/exercise/[id]';
import WorkoutPrefsScreen from '@/app/settings/workout';
import ShareScreen from '@/app/share';
import { useFamilyStore } from '@/features/family/store';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { MomentCard } from '@/features/moments/MomentCard';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';
import { useWorkoutStore } from '@/features/workout/store';
import { clock } from '@/lib/clock';

import { devLibrary } from '../exercises/library';

import { MAX_DECLINES } from './screenshot';

const params: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/features/family/OwnerOnly', () => ({ useOwnerAccess: () => 'owner' }));
jest.setTimeout(20_000);

const NOW = new Date('2026-09-30T18:00:00');
const realNow = clock.now;
const LIBRARY = devLibrary();
const squat = LIBRARY.find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;

function workout(date: string) {
  return {
    id: `w-${date}`,
    kind: 'regular',
    createdAt: `${date}T09:00:00`,
    startedAt: `${date}T09:00:00`,
    endedAt: `${date}T09:40:00`,
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
          sets: 2,
          reps: [8, 12],
          restSeconds: 60,
          perSide: false,
          loadHint: null,
          estSeconds: 200,
        },
      ],
      minutes: 40,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      estimatedMinutes: 40,
      notes: [],
    },
    logs: [1, 2].map((setNo) => ({
      itemId: 'i0',
      exerciseId: squat.id,
      setNo,
      reps: 10,
      load: 40,
      unit: 'kg',
      loggedAt: `${date}T09:1${setNo}:00`,
    })),
    skipped: [],
    swaps: [],
    pains: [],
  } as never;
}

async function as(
  who: 'adult' | 'teen' | 'senior',
  managed?: { shareAllowed: boolean },
  name = 'Ana',
) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: who === 'adult' ? 1985 : who === 'senior' ? 1955 : 2011,
      sex: 'f',
      onboardingComplete: true,
    });
    useFamilyStore.setState({
      profiles: managed
        ? [{ id: 't1', kind: 'child', name, createdAt: '2026-01-01', ...managed }]
        : [{ id: 'me', kind: 'self', name, createdAt: '2026-01-01' }],
      activeId: managed ? 't1' : 'me',
    });
    useOwnerIdentityStore.setState({
      ownerId: 'me',
      activeId: managed ? 't1' : 'me',
      minors: managed ? { t1: 'teen' } : {},
    });
    useWorkoutStore.getState().reset();
    useWorkoutStore.setState({ workouts: [workout('2026-09-29'), workout('2026-09-30')] });
  });
}

beforeAll(() => {
  clock.now = () => NOW;
});
afterAll(() => {
  clock.now = realNow;
});
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(params)) delete params[k];
  usePrefsStore.getState().reset();
});

describe("E a minor without the parent's switch: nothing to share, anywhere", () => {
  it('no "Save card", no Moment share, and the composer sends them home', async () => {
    await as('teen', { shareAllowed: false });
    params.id = squat.id;
    await render(<ExerciseScreen />);
    expect(screen.queryByRole('button', { name: 'Save card' })).toBeNull();
    await render(
      <MomentCard
        moment={{ id: 'm', kind: 'first_back', params: {}, muscles: ['lats'] }}
        band="teen"
        sex="f"
        canShare={false}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Share' })).toBeNull();
    await render(<ShareScreen />);
    expect(screen.getByText('redirect:/home')).toBeTruthy();
  });
});

describe('E a teen with the switch on', () => {
  it('only the minor cards, no name, no link, no invite', async () => {
    await as('teen', { shareAllowed: true }, 'Bia');
    usePrefsStore.getState().set({ showNameOnCards: true });
    await render(<ShareScreen />);
    expect(screen.getByRole('button', { name: 'Muscle' })).toBeTruthy();
    for (const adultOnly of ['Week', 'Month', 'Fun', 'Exercise'])
      expect(screen.queryByRole('button', { name: adultOnly })).toBeNull();
    expect(screen.queryByText('Bia')).toBeNull();
    expect(screen.queryByTestId('card-link')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Send my invite link' })).toBeNull();
  });
});

describe('E adults and 60+', () => {
  it('the name shows only once turned on', async () => {
    await as('adult');
    await render(<ShareScreen />);
    expect(screen.queryByText('Ana')).toBeNull();
    await act(() => usePrefsStore.getState().set({ showNameOnCards: true }));
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
  });

  it('60+: WhatsApp is the first, main button', async () => {
    await as('senior');
    await render(<ShareScreen />);
    const whatsapp = screen.getByRole('button', { name: 'WhatsApp' });
    const instagram = screen.getByRole('button', { name: 'Instagram Stories' });
    const all = screen.getAllByRole('button');
    expect(all.indexOf(whatsapp)).toBeLessThan(all.indexOf(instagram));
  });
});

describe('E Settings', () => {
  it('"Show my name" and "Never show share offers"; the offers come back after 3 closes', async () => {
    await as('adult');
    await render(<WorkoutPrefsScreen />);
    const name = screen.getByRole('switch', { name: 'Show my name on cards' });
    expect(name).not.toBeChecked();
    await fireEvent.press(name);
    expect(usePrefsStore.getState().showNameOnCards).toBe(true);

    await act(() => usePrefsStore.getState().set({ shareOfferDeclines: MAX_DECLINES }));
    const never = screen.getByRole('switch', { name: 'Never show share offers' });
    expect(never).toBeChecked();
    await fireEvent.press(never);
    expect(usePrefsStore.getState()).toMatchObject({ shareOffers: true, shareOfferDeclines: 0 });
  });

  it('a teen sees neither switch', async () => {
    await as('teen', { shareAllowed: true });
    await render(<WorkoutPrefsScreen />);
    expect(screen.queryByRole('switch', { name: /Show my name on cards/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Never show share offers/ })).toBeNull();
  });
});
