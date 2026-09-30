/**
 * Phase 28, C — the smart screenshot: the bar shows only on the five
 * screens, once per app session, for 5 s, stops after 3 closes in a row,
 * never for minors or with "Never show share offers", and never blocks
 * screenshots (no FLAG_SECURE anywhere).
 */
import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Capture from 'expo-screen-capture';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import ExerciseScreen from '@/app/exercise/[id]';
import { useFamilyStore } from '@/features/family/store';
import { useOwnerIdentityStore } from '@/features/family/ownerIdentity';
import { useOnboardingStore } from '@/features/onboarding/store';
import { usePrefsStore } from '@/features/settings/store';

import { devLibrary } from '../exercises/library';

import { MAX_DECLINES, OFFER_SECONDS, useScreenshotOfferStore } from './screenshot';
import { ScreenshotOfferBar } from './ScreenshotOfferBar';

const params: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => params,
}));

const takeScreenshot = (Capture as unknown as { __takeScreenshot: () => void }).__takeScreenshot;
const squat = devLibrary().find((e) => e.pattern === 'squat' && e.parts.includes('main'))!;

async function as(who: 'adult' | 'teen' | 'senior', managed?: { shareAllowed: boolean }) {
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
        ? [{ id: 't1', kind: 'child', createdAt: '2026-01-01', ...managed }]
        : [{ id: 'me', kind: 'self', createdAt: '2026-01-01' }],
      activeId: managed ? 't1' : 'me',
    });
    useOwnerIdentityStore.setState({
      ownerId: 'me',
      activeId: managed ? 't1' : 'me',
      minors: managed ? { t1: 'teen' } : {},
    });
  });
}

async function openExercise() {
  params.id = squat.id;
  await render(
    <>
      <ExerciseScreen />
      <ScreenshotOfferBar />
    </>,
  );
}

async function shoot() {
  await act(async () => takeScreenshot());
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  usePrefsStore.getState().reset();
  useScreenshotOfferStore.getState().resetSession();
});
afterEach(() => jest.useRealTimers());

describe('C the bar after a screenshot', () => {
  it('offers the card of that screen; "Create card" opens it from the screenshot', async () => {
    await as('adult');
    await openExercise();
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
    await shoot();
    expect(screen.getByText('Want a nicer version to post?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/share',
      params: { template: 'exercise', exercise: squat.id, source: 'screenshot' },
    });
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
  });

  it(`goes away by itself after ${OFFER_SECONDS} s, and only once per session`, async () => {
    await as('senior');
    await openExercise();
    await shoot();
    expect(screen.getByTestId('screenshot-offer')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(OFFER_SECONDS * 1000));
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
    // Letting it go is not a "no".
    expect(usePrefsStore.getState().shareOfferDeclines).toBe(0);
    await shoot();
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
  });

  it(`[x] counts; after ${MAX_DECLINES} in a row it stops offering`, async () => {
    await as('adult');
    for (let n = 1; n <= MAX_DECLINES; n++) {
      useScreenshotOfferStore.getState().resetSession(); // a new app session
      await openExercise();
      await shoot();
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(usePrefsStore.getState().shareOfferDeclines).toBe(n);
    }
    useScreenshotOfferStore.getState().resetSession();
    (Capture.addScreenshotListener as jest.Mock).mockClear();
    await openExercise();
    expect(Capture.addScreenshotListener).not.toHaveBeenCalled();
    await shoot();
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
  });

  it('never with "Never show share offers"', async () => {
    await as('adult');
    usePrefsStore.getState().set({ shareOffers: false });
    await openExercise();
    expect(Capture.addScreenshotListener).not.toHaveBeenCalled();
  });

  it('never for minors, even with sharing on', async () => {
    await as('teen', { shareAllowed: true });
    await openExercise();
    expect(Capture.addScreenshotListener).not.toHaveBeenCalled();
    await shoot();
    expect(screen.queryByTestId('screenshot-offer')).toBeNull();
  });
});

describe('C only five screens, and screenshots are welcome', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });
  const root = join(__dirname, '../..');

  it('the offer is on the end screen, the exercise page, the body map, the milestone and the month', () => {
    const using = files(join(root, 'app'))
      .filter((f) => readFileSync(f, 'utf8').includes('useScreenshotOffer('))
      .map((f) => f.slice(join(root, 'app').length + 1))
      .sort();
    expect(using).toEqual([
      '(tabs)/body.tsx',
      'exercise/[id].tsx',
      'milestone.tsx',
      'month.tsx',
      'workout/[id]/done.tsx',
    ]);
  });

  it('nothing blocks screenshots (no FLAG_SECURE)', () => {
    const blocking = files(root).filter(
      (f) =>
        !f.endsWith('.test.tsx') &&
        /preventScreenCapture|usePreventScreenCapture|FLAG_SECURE/.test(readFileSync(f, 'utf8')),
    );
    expect(blocking).toEqual([]);
  });
});
