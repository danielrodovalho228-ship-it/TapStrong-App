import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { clock } from '@/lib/clock';
import { secureStorage } from '@/lib/secureStorage';
import { kvStorage } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

/**
 * Parent PIN (QA R2-05): set by the account owner on their own profile, asked
 * by the parent gate on a child or teen profile. After 5 wrong tries the gate
 * locks for 15 minutes.
 *
 * Storage (QA round 3): only a salted PBKDF2-SHA256 key (100,000 rounds) is
 * kept, in the Keychain / Keystore, together with the lockout, so neither can
 * be read or edited in plain app storage. The lockout is also mirrored on the
 * server when online (pinLockout.ts).
 */
export const PIN_LENGTH = 4;
export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;
export const PIN_ROUNDS = 100_000;
/**
 * Wrong PINs the offline fallback accepts in total before it needs the
 * server (security round 2, P3): the 15-minute lock uses the device clock,
 * which airplane mode plus a clock set forward can skip.
 */
export const MAX_OFFLINE_WRONG = 10;

type Algo = 'pbkdf2' | 'fnv';

type State = {
  hash: string | null;
  salt: string | null;
  /** 'fnv' only for a PIN carried over from the old storage; rehashed on the next right PIN. */
  algo: Algo;
  failures: number;
  lockedUntil: string | null;
  /** The account has a PIN on the server (security round 1, S1-03). */
  serverHasPin: boolean;
  /**
   * A PIN set offline on the phone, not yet on the server (native only, in
   * the Keychain / Keystore); sent on the next status check, then removed.
   */
  pendingPin: string | null;
  /** The server PIN's version this phone's copy was made from (round 2, S2-P2-3). */
  pinVersion: string | null;
  /** Wrong offline tries; only goes up, and only a server "ok" resets it (round 2, P3). */
  offlineWrong: number;
  reset: () => void;
};

const EMPTY = {
  hash: null,
  salt: null,
  algo: 'pbkdf2' as Algo,
  failures: 0,
  lockedUntil: null,
  serverHasPin: false,
  pendingPin: null,
  pinVersion: null,
  offlineWrong: 0,
};

export const useParentPinStore = create<State>()(
  persist(
    (set) => ({
      ...EMPTY,
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'parent-pin-secure',
      version: 1,
      storage: createJSONStorage(() => secureStorage),
      partialize: ({
        hash,
        salt,
        algo,
        failures,
        lockedUntil,
        serverHasPin,
        pendingPin,
        pinVersion,
        offlineWrong,
      }) => ({
        hash,
        salt,
        algo,
        failures,
        lockedUntil,
        serverHasPin,
        pendingPin,
        pinVersion,
        offlineWrong,
      }),
      // A plain-storage PIN is never imported: anyone with file access could
      // plant one before the owner set theirs (QA R4-05). The stale copy from
      // dev builds before round 3 is just deleted.
      onRehydrateStorage: () => () => {
        try {
          kvStorage.removeItem('parent-pin');
        } catch {
          // Nothing to clean up.
        }
      },
    },
  ),
);

/** Slow key derivation: guessing all 10,000 PINs takes real time, not a second. */
export function derivePin(pin: string, salt: string): string {
  return bytesToHex(
    pbkdf2(sha256, utf8ToBytes(pin), utf8ToBytes(salt), { c: PIN_ROUNDS, dkLen: 32 }),
  );
}

/** The old FNV-1a digest, only to accept a PIN set before round 3 once. */
function legacyDigest(pin: string, salt: string): string {
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

/** Constant-time compare of two hex strings. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** A PIN on this phone or on the account (a new phone learns it from the server). */
export const hasParentPin = () => {
  const s = useParentPinStore.getState();
  return !!s.hash || s.serverHasPin;
};

export function setParentPin(pin: string): boolean {
  if (!isValidPin(pin)) return false;
  const salt = uuid();
  useParentPinStore.setState({
    salt,
    hash: derivePin(pin, salt),
    algo: 'pbkdf2',
    failures: 0,
    lockedUntil: null,
  });
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
  const right =
    s.algo === 'fnv'
      ? sameHex(legacyDigest(pin, s.salt), s.hash)
      : sameHex(derivePin(pin, s.salt), s.hash);
  if (right) {
    if (s.algo === 'fnv') setParentPin(pin);
    else useParentPinStore.setState({ failures: 0, lockedUntil: null });
    return 'ok';
  }
  return countWrongTry(now);
}

/** One wrong try on this phone (offline fallback): 5 in a row lock the PIN for 15 minutes. */
export function countWrongTry(now: Date = clock.now()): 'wrong' | 'locked' {
  const s = useParentPinStore.getState();
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
