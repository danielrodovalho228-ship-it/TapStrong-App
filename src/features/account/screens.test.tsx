import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/account';
import MilestoneScreen from '@/app/milestone';
import ReferralLink from '@/app/r/[code]';
import ShareScreen from '@/app/share';
import { useOnboardingStore } from '@/features/onboarding/store';
import { useWorkoutStore } from '@/features/workout/store';
import { setAnalyticsSink } from '@/lib/analytics';
import { clock } from '@/lib/clock';

import { useAccountStore } from './store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const mockAuth = {
  updateUser: jest.fn(async () => ({ error: null })),
  signInWithOtp: jest.fn(async () => ({ error: null })),
  verifyOtp: jest.fn(async () => ({ error: null })),
  signOut: jest.fn(async () => ({ error: null })),
};
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: mockAuth }),
  ensureSession: async () => true,
}));
jest.mock('@/features/account/cloud', () => ({
  afterAccountSaved: jest.fn(async () => undefined),
  syncNow: jest.fn(async () => ({ status: 'ok', synced: [], skipped: [] })),
  loadReferralCode: jest.fn(async () => 'AB3DEF7'),
  referralLink: (code: string) => `tapstrong://r/${code}`,
}));
const mockPermission = jest.fn(async () => true);
jest.mock('@/features/notifications/apply', () => ({
  requestPermission: () => mockPermission(),
  applyPlan: async () => undefined,
}));

const cloud = jest.requireMock('@/features/account/cloud') as Record<string, jest.Mock>;
const events: { event: string; props?: object }[] = [];
setAnalyticsSink((event, props) => events.push({ event, props }));

beforeAll(() => {
  clock.now = () => new Date('2026-09-26T12:00:00Z');
});

beforeEach(async () => {
  await act(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().update({
      birthMonth: 3,
      birthYear: 1983,
      sex: 'm',
      daysPerWeek: 3,
      onboardingComplete: true,
    });
    useAccountStore.getState().reset();
    useWorkoutStore.getState().reset();
  });
  mockParams = {};
  events.length = 0;
  Object.values(mockAuth).forEach((m) => m.mockClear());
  Object.values(cloud).forEach((m) => typeof m === 'function' && 'mockClear' in m && m.mockClear());
});

describe('Save progress (mockup 16)', () => {
  it('saves with an emailed code, upgrading the anonymous user', async () => {
    mockParams = { from: 'done' };
    await render(<AccountScreen />);
    expect(screen.getByText('First workout · done')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ email: 'me@example.com' });
    expect(screen.getByText(/We sent a code to me@example.com/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Save my progress' }));
    expect(useAccountStore.getState()).toMatchObject({ saved: true, email: 'me@example.com' });
    expect(events).toContainEqual({ event: 'account_created', props: { method: 'email' } });
    expect(cloud.afterAccountSaved).toHaveBeenCalled();
    expect(screen.getByText('Progress saved')).toBeTruthy();
  });

  it('shows a clear error for a wrong code', async () => {
    mockAuth.verifyOtp.mockImplementationOnce(
      async () => ({ error: { code: 'otp_expired' } }) as never,
    );
    await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '000000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save my progress' }));
    expect(screen.getByText(/That code didn't work/)).toBeTruthy();
    expect(useAccountStore.getState().saved).toBe(false);
  });

  it('"Not now" remembers the choice', async () => {
    await render(<AccountScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'Not now' }));
    expect(useAccountStore.getState().promptDismissed).toBe(true);
  });

  it('turning on reminders asks for permission and keeps them off if denied', async () => {
    await render(<AccountScreen />);
    expect(screen.getByText(/at 6:30/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Workout reminders' }));
    expect(useAccountStore.getState().notifications.reminders).toBe(true);
    mockPermission.mockImplementationOnce(async () => false);
    await fireEvent.press(screen.getByRole('switch', { name: 'Streak saver' }));
    expect(useAccountStore.getState().notifications.streakSaver).toBe(false);
    expect(screen.getByText(/Turn them on in your phone's settings/)).toBeTruthy();
  });

  it('child mode never shows the sign-up form', async () => {
    await act(() => useOnboardingStore.getState().update({ birthYear: 2015 }));
    await render(<AccountScreen />);
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByText(/A parent or guardian creates your profile/)).toBeTruthy();
  });
});

describe('Share card (mockup 15)', () => {
  it('shows the card; the invite link needs a saved account', async () => {
    await render(<ShareScreen />);
    expect(screen.getByText('My muscle map')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share my map' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send my invite link' })).toBeNull();
    expect(screen.getByText(/Save your account to get your own invite link/)).toBeTruthy();
  });

  it('offers the invite link once saved', async () => {
    await act(() => useAccountStore.getState().update({ saved: true, referralCode: 'AB3DEF7' }));
    await render(<ShareScreen />);
    expect(screen.getByRole('button', { name: 'Send my invite link' })).toBeTruthy();
  });

  it('is hidden in child mode (no social sharing under 13)', async () => {
    await act(() => useOnboardingStore.getState().update({ birthYear: 2015 }));
    await render(<ShareScreen />);
    expect(screen.getByText('redirect:/home')).toBeTruthy();
    expect(screen.queryByText('My muscle map')).toBeNull();
  });
});

describe('Milestone (mockup 24)', () => {
  it('celebrates the streak and lists badges', async () => {
    await act(() => {
      useWorkoutStore.setState({
        streak: { current: 7, best: 7, freezes: 1, lastActive: '2026-09-26', restDays: [] },
      });
      useAccountStore.getState().update({
        milestone: { streak: 7, workoutId: 'w', at: '2026-09-26T12:00:00Z' },
      });
    });
    await render(<MilestoneScreen />);
    expect(screen.getByRole('header', { name: '7-day streak' })).toBeTruthy();
    expect(screen.getByText(/You earned 1 streak freeze/)).toBeTruthy();
    expect(screen.getByText('First workout')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));
    expect(useAccountStore.getState().milestone).toBeNull();
  });

  it('hides "Share my streak" in child mode', async () => {
    await act(() => useOnboardingStore.getState().update({ birthYear: 2015 }));
    await render(<MilestoneScreen />);
    expect(screen.queryByRole('button', { name: 'Share my streak' })).toBeNull();
  });
});

describe('Referral link', () => {
  it('keeps a valid code until the account is saved', async () => {
    mockParams = { code: 'ab3def7' };
    await render(<ReferralLink />);
    expect(useAccountStore.getState().pendingReferral).toBe('AB3DEF7');
  });

  it('ignores a malformed code', async () => {
    mockParams = { code: 'x' };
    await render(<ReferralLink />);
    expect(useAccountStore.getState().pendingReferral).toBeUndefined();
  });
});
