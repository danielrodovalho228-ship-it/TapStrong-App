import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

import type { CardLook } from './public';
import type { CardData, ShareTemplate } from './types';

/**
 * The links of shared cards (Phase 28, D): a short code per card, the card's
 * safe data (what the public page draws) and when it was made. Synced to
 * `share_links` with the account; the page at tapstrong.app/c/<code> shows
 * the card. Per profile; wiped with the account.
 */
export type ShareLink = {
  id: string;
  code: string;
  template: ShareTemplate;
  data: CardData;
  /** How the map looked: the profile's sex and body band (no age, no name). */
  look: CardLook;
  createdAt: string;
};

type State = {
  links: ShareLink[];
  add: (data: CardData, code: string, at: Date, look: CardLook) => ShareLink;
  reset: () => void;
};

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A short, unguessable code: 8 characters, no look-alikes (0/o, 1/l/i). */
export function shareCode(random: () => number = Math.random): string {
  let out = '';
  const id = uuid().replace(/-/g, '');
  for (let i = 0; i < 8; i++) {
    const n =
      (parseInt(id.slice(i * 2, i * 2 + 2), 16) + Math.floor(random() * 256)) % ALPHABET.length;
    out += ALPHABET[n];
  }
  return out;
}

/** "tapstrong.app/c/abcd2345": the host from EXPO_PUBLIC_SHARE_BASE_URL. */
export function shortLink(code: string): string {
  const base =
    process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/$/, '') || 'https://tapstrong.app';
  return `${base.replace(/^https?:\/\//, '')}/c/${code}`;
}

export const MAX_LINKS = 300;

export const useShareStore = create<State>()(
  persist(
    (set, get) => ({
      links: [],
      add: (data, code, at, look) => {
        const existing = get().links.find((l) => l.code === code);
        if (existing) return existing;
        const link: ShareLink = {
          id: uuid(),
          code,
          template: data.template,
          data,
          look,
          createdAt: at.toISOString(),
        };
        set({ links: [...get().links, link].slice(-MAX_LINKS) });
        return link;
      },
      reset: () => set({ links: [] }),
    }),
    {
      name: 'share-links',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ links }) => ({ links }),
    },
  ),
);
