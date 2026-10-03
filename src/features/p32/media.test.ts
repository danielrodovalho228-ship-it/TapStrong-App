/**
 * Phase 32: released exercises stream their Flow clip and poster from the
 * public exercise-media bucket, cached on the phone, always of the
 * profile's sex; drafts and other providers get nothing from Storage.
 */
import type { ExerciseRow } from '../exercises/library';
import { useReleasedLibraryStore } from '../exercises/released';
import { demoPoster, demoVideo, mediaBase } from '../exercises/videos';

jest.mock('@/lib/env', () => ({
  publicEnv: { supabaseUrl: 'https://demo.supabase.co/', supabaseAnonKey: 'anon' },
}));

const row = (slug: string, status: string, provider: string) =>
  ({ slug, status, media_provider: provider }) as unknown as ExerciseRow;
// A slug with no bundled dev clip, so only Storage can answer.
const SLUG = 'zz_launch_only';

beforeEach(() => {
  useReleasedLibraryStore.getState().set([], '2026-10-03');
});

it('builds the bucket URL from the project URL', () => {
  expect(mediaBase()).toBe('https://demo.supabase.co/storage/v1/object/public/exercise-media');
});

it('a released exercise: its own sex, cached', () => {
  useReleasedLibraryStore.getState().set([row(SLUG, 'released', 'google_flow')], '2026-10-03');
  expect(demoVideo(SLUG, 'f')).toEqual({
    uri: `${mediaBase()}/${SLUG}.f.mp4`,
    useCaching: true,
  });
  expect(demoVideo(SLUG, 'm')).toEqual({
    uri: `${mediaBase()}/${SLUG}.m.mp4`,
    useCaching: true,
  });
  expect(demoPoster(SLUG, 'f')).toEqual({ uri: `${mediaBase()}/posters/${SLUG}.f.webp` });
  // No sex chosen yet: no clip, never a guess.
  expect(demoVideo(SLUG, null)).toBeNull();
});

it('drafts and other media providers get nothing from Storage', () => {
  useReleasedLibraryStore
    .getState()
    .set([row(SLUG, 'draft', 'google_flow'), row('zz_other', 'released', 'gym_animations')], 'x');
  expect(demoVideo(SLUG, 'f')).toBeNull();
  expect(demoVideo('zz_other', 'f')).toBeNull();
  expect(demoPoster('zz_other', 'f')).toBeNull();
});
