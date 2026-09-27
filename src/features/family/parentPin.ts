import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { kvStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

/**
 * Parent PIN (QA R2-05): set by the account owner on their own profile, asked
 * by the parent gate on a child or teen profile. After 5 wrong tries the gate
 * locks for 15 minutes. Only a salted hash is kept on the phone; the lockout
 * is what stops guessing.
 */
export const PIN_LENGTH = 4;
export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;

type State = {
  hash: string | null;
  salt: string | null;
  failures: number;
  lockedUntil: string | null;
  reset: () => void;
};

export const useParentPinStore = create<State>()(
  persist(
    (set) => ({
      hash: null,
      salt: null,
      failures: 0,
      lockedUntil: null,
      reset: () => set({ hash: null, salt: null, failures: 0, lockedUntil: null }),
    }),
    {
      name: 'parent-pin',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ hash, salt, failures, lockedUntil }) => ({
        hash,
        salt,
        failures,
        lockedUntil,
      }),
    },
  ),
);

/** FNV-1a, iterated with a salt: keeps the PIN itself out of storage. */
function digest(pin: string, salt: string): string {
  let h = 0x811c9dc5;
  let text = `${salt}:${pin}`;
  for (let round = 0; round < 1000; round++) {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    text = `${h.toString(16)}:${salt}`;
  }
  return h.toString(16).padStart(8, '0');
}

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export const hasParentPin = () => !!useParentPinStore.getState().hash;

export function setParentPin(pin: string): boolean {
  if (!isValidPin(pin)) return false;
  const salt = uuid();
  useParentPinStore.setState({ salt, hash: digest(pin, salt), failures: 0, lockedUntil: null });
  return true;
}

export type PinCheck = 'ok' | 'wrong' | 'locked' | 'no_pin';

/** Minutes left on the lockout, or 0. */
export function lockMinutesLeft(now: Date = clock.now()): number {
  const until = useParentPinStore.getState().lockedUntil;
  if (!until) return 0;
  return Math.max(0, Math.ceil((Date.parse(until) - now.getTime()) / 60000));
}

export function checkParentPin(pin: string, now: Date = clock.now()): PinCheck {
  const s = useParentPinStore.getState();
  if (!s.hash || !s.salt) return 'no_pin';
  if (lockMinutesLeft(now) > 0) return 'locked';
  if (digest(pin, s.salt) === s.hash) {
    useParentPinStore.setState({ failures: 0, lockedUntil: null });
    return 'ok';
  }
  const failures = (s.lockedUntil ? 0 : s.failures) + 1;
  if (failures >= MAX_TRIES) {
    useParentPinStore.setState({
      failures: 0,
      lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString(),
    });
    return 'locked';
  }
  useParentPinStore.setState({ failures, lockedUntil: null });
  return 'wrong';
}
