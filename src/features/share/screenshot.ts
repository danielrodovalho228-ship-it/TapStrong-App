import * as Router from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { activeProfile, useFamilyStore } from '@/features/family/store';
import { modeOf } from '@/features/onboarding/derived';
import { useOnboardingStore } from '@/features/onboarding/store';
import type { AppMode } from '@/features/profile/age';
import { usePrefsStore } from '@/features/settings/store';
import { track } from '@/lib/analytics';

import { shareAllowed, type ShareParams } from './open';

/**
 * The smart screenshot (Phase 28, C). On five screens only (the end of a
 * workout, the exercise page, the body map, the milestone and the month
 * summary) a screenshot brings up a small bar for 5 s: "Want a nicer
 * version to post?" [Create card] [x]. At most once per app session; after
 * 3 closes in a row it stops (Settings turns it back on). Never for minors,
 * never where the profile may not share, never with "Never show share
 * offers". The system tells the app only that a screenshot happened, never
 * the picture; nothing blocks screenshots (no secure-window flag). Android shows
 * this from 14 on (DETECT_SCREEN_CAPTURE); older Android and the web never.
 */
export const OFFER_SECONDS = 5;
export const MAX_DECLINES = 3;

type OfferState = {
  offer: ShareParams | null;
  /** One bar per app session: kept in memory only. */
  shownThisSession: boolean;
  show: (offer: ShareParams) => void;
  hide: () => void;
  resetSession: () => void;
};

export const useScreenshotOfferStore = create<OfferState>()((set, get) => ({
  offer: null,
  shownThisSession: false,
  show: (offer) => {
    if (get().shownThisSession) return;
    set({ offer, shownThisSession: true });
    track('share_offer_shown', { template: offer.template });
  },
  hide: () => set({ offer: null }),
  resetSession: () => set({ offer: null, shownThisSession: false }),
}));

export function offerAllowed({
  mode,
  member,
  template,
  shareOffers,
  declines,
  shownThisSession,
}: {
  mode: AppMode;
  member: Parameters<typeof shareAllowed>[0];
  template: ShareParams['template'];
  shareOffers: boolean;
  declines: number;
  shownThisSession: boolean;
}): boolean {
  if (mode === 'child' || mode === 'teen') return false;
  if (!shareOffers || declines >= MAX_DECLINES || shownThisSession) return false;
  return shareAllowed(member, mode, template);
}

// Tabs stay mounted: listen only while the screen is in front. Screens
// rendered outside a navigator (tests) fall back to mount/unmount.
const useFocusEffect = (Router as Partial<typeof Router>).useFocusEffect;
function useWhileFocused(effect: () => (() => void) | undefined) {
  if (useFocusEffect) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFocusEffect(effect);
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(effect, [effect]);
  }
}

/** Offers this screen's card when the person takes a screenshot here. */
export function useScreenshotOffer(card: ShareParams | null) {
  const mode = useOnboardingStore(modeOf);
  const member = useFamilyStore(activeProfile);
  const shareOffers = usePrefsStore((s) => s.shareOffers);
  const declines = usePrefsStore((s) => s.shareOfferDeclines);
  const shownThisSession = useScreenshotOfferStore((s) => s.shownThisSession);
  const allowed =
    Platform.OS !== 'web' &&
    !!card &&
    offerAllowed({
      mode,
      member,
      template: card.template,
      shareOffers,
      declines,
      shownThisSession,
    });
  const key = card ? JSON.stringify(card) : '';

  const effect = useCallback(() => {
    if (!allowed || !key) return undefined;
    /* eslint-disable @typescript-eslint/no-require-imports */
    const Capture = require('expo-screen-capture') as typeof import('expo-screen-capture');
    /* eslint-enable @typescript-eslint/no-require-imports */
    const sub = Capture.addScreenshotListener(() =>
      useScreenshotOfferStore.getState().show(JSON.parse(key) as ShareParams),
    );
    return () => sub.remove();
  }, [allowed, key]);
  useWhileFocused(effect);
}
