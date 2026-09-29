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

import { demoSexFor, demoVideo } from './videos';

jest.mock('../../../assets/prototype/videos.js', () => ({
  __label: 'Prototype exercise videos',
  push_up: { f: 101, m: 202 },
  goblet_squat: { f: 303 },
  single_leg_rdl: { f: 404, m: 505 },
}));
jest.mock('@/features/workout/components/DemoVideo', () => ({
  DemoVideo: ({ source, mirrored }: { source: number; mirrored?: boolean }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`clip:${source}${mirrored ? ':mirrored' : ''}`}</Text>;
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
    expect(screen.getByText('clip:202')).toBeTruthy();
    await as({ sex: 'f' });
    await render(<ExerciseDemo slug="push_up" chips={[]} />);
    expect(screen.getByText('clip:101')).toBeTruthy();
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
    expect(screen.getByText('clip:202')).toBeTruthy();
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
    expect(screen.getByText('clip:101')).toBeTruthy();
    await act(() => switchProfile('dad', { birthMonth: 1, birthYear: 1955, sex: 'm' }));
    expect(screen.getByText('clip:202')).toBeTruthy();
  });

  it('a one-sided move keeps the mirror for the other side', async () => {
    await as({ sex: 'f' });
    await render(<ExerciseDemo slug="single_leg_rdl" unilateral chips={[]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Other side' }));
    expect(screen.getByText('clip:404:mirrored')).toBeTruthy();
  });
});
