/**
 * Daniel, Phase 20: exercise videos follow the profile's sex. A man always
 * sees the man's clip, a woman the woman's; a missing clip shows the "coming
 * soon" frame, never the other sex; with no sex set the app asks once.
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useFamilyStore } from '@/features/family/store';
import { ensureSelfProfile, switchProfile } from '@/features/family/switch';
import { useOnboardingStore } from '@/features/onboarding/store';
import { ExerciseDemo } from '@/features/workout/components/ExerciseDemo';
import { ExerciseThumb } from '@/features/workout/components/Media';

import { demoPoster, demoSexFor, demoVideo } from './videos';

jest.mock('../../../assets/prototype/videos.js', () => ({
  __label: 'Prototype exercise videos',
  push_up: { f: 101, m: 202, poster: { f: 111, m: 222 } },
  // A stray man's poster with no man's clip must never show.
  goblet_squat: { f: 303, poster: { f: 333, m: 999 } },
  single_leg_rdl: { f: 404, m: 505 },
}));
jest.mock('@/features/workout/components/DemoVideo', () => ({
  DemoVideo: ({
    source,
    poster,
    mirrored,
  }: {
    source: number;
    poster?: number | null;
    mirrored?: boolean;
  }) => {
    const { Text } = jest.requireActual('react-native');
    return (
      <Text>{`clip:${source}${mirrored ? ':mirrored' : ''}${poster ? `:poster:${poster}` : ''}`}</Text>
    );
  },
}));

async function as(patch: Parameters<ReturnType<typeof useOnboardingStore.getState>['update']>[0]) {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1990, ...patch });
  });
}

describe('demoVideo', () => {
  it('f gets .f, m gets .m, never the other', () => {
    expect(demoVideo('push_up', 'f')).toBe(101);
    expect(demoVideo('push_up', 'm')).toBe(202);
    expect(demoVideo('goblet_squat', 'm')).toBeNull();
    expect(demoVideo('goblet_squat', null)).toBeNull();
    expect(demoVideo('__label', 'f')).toBeNull();
  });

  it('the poster follows the same sex rule, and only next to a clip', () => {
    expect(demoPoster('push_up', 'f')).toBe(111);
    expect(demoPoster('push_up', 'm')).toBe(222);
    expect(demoPoster('goblet_squat', 'm')).toBeNull();
    expect(demoPoster('single_leg_rdl', 'f')).toBeNull();
    expect(demoPoster('push_up', null)).toBeNull();
  });

  it('the profile sex first, then the body model; never guessed', () => {
    expect(demoSexFor({ sex: 'm', bodyModel: { sex: 'f' } })).toBe('m');
    expect(demoSexFor({ sex: null, bodyModel: { sex: 'f' } })).toBe('f');
    expect(demoSexFor({ sex: undefined, bodyModel: {} })).toBeNull();
  });
});

describe('ExerciseDemo', () => {
  it('a man sees the man, a woman the woman', async () => {
    await as({ sex: 'm' });
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.getByText('clip:202:poster:222')).toBeTruthy();
    await as({ sex: 'f' });
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.getByText('clip:101:poster:111')).toBeTruthy();
  });

  it('a missing .m shows the coming-soon frame, not the .f clip', async () => {
    await as({ sex: 'm' });
    await render(<ExerciseDemo slug="goblet_squat" chips={[]} />);
    expect(screen.queryByText(/^clip:/)).toBeNull();
    expect(
      screen.getByText('The demo video arrives with the licensed exercise library.'),
    ).toBeTruthy();
  });

  it('no sex set: asks once, stores the answer, then shows that clip', async () => {
    await as({ sex: undefined, bodyModel: {} });
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.getByText('Show exercise demos with:')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Man' }));
    expect(useOnboardingStore.getState().bodyModel.sex).toBe('m');
    expect(screen.getByText('clip:202:poster:222')).toBeTruthy();
    // Asked once: the next screen shows the clip straight away.
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.queryByText('Show exercise demos with:')).toBeNull();
  });

  it('switching profiles switches the clip', async () => {
    await act(() => {
      useFamilyStore.getState().reset();
      useOnboardingStore.getState().reset();
    });
    await act(() => ensureSelfProfile());
    await act(() =>
      useOnboardingStore.getState().update({ birthMonth: 3, birthYear: 1985, sex: 'f' }),
    );
    await act(() => {
      useFamilyStore.getState().add({ id: 'dad', kind: 'parent', name: 'Dad' });
    });
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.getByText('clip:101:poster:111')).toBeTruthy();
    await act(() => switchProfile('dad', { birthMonth: 1, birthYear: 1955, sex: 'm' }));
    expect(screen.getByText('clip:202:poster:222')).toBeTruthy();
  });

  it('a one-sided move keeps the mirror for the other side', async () => {
    await as({ sex: 'f' });
    await render(<ExerciseDemo slug="single_leg_rdl" unilateral chips={[]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Other side' }));
    expect(screen.getByText('clip:404:mirrored')).toBeTruthy();
  });
});

describe('ExerciseThumb', () => {
  // The thumb is decorative (aria-hidden).
  const HIDDEN = { includeHiddenElements: true };

  it("shows the profile's own-sex poster in the exercise card", async () => {
    await as({ sex: 'm' });
    await render(<ExerciseThumb slug="push_up" />);
    expect(screen.getByTestId('exercise-thumb-poster', HIDDEN)).toBeTruthy();
  });

  it('no clip for this sex: the neutral frame, never the other sex', async () => {
    await as({ sex: 'm' });
    await render(<ExerciseThumb slug="goblet_squat" />);
    expect(screen.queryByTestId('exercise-thumb-poster', HIDDEN)).toBeNull();
    await render(<ExerciseThumb />);
    expect(screen.queryByTestId('exercise-thumb-poster', HIDDEN)).toBeNull();
  });
});
