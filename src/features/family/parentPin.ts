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

type Algo = 'pbkdf2' | 'fnv';

type State = {
  hash: string | null;
  salt: string | null;
  /** 'fnv' only for a PIN carried over from the old storage; rehashed on the next right PIN. */
  algo: Algo;
  failures: number;
  lockedUntil: string | null;
  reset: () => void;
};

const EMPTY = { hash: null, salt: null, algo: 'pbkdf2' as Algo, failures: 0, lockedUntil: null };

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
      partialize: ({ hash, salt, algo, failures, lockedUntil }) => ({
        hash,
        salt,
        algo,
        failures,
        lockedUntil,
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

export const hasParentPin = () => !!useParentPinStore.getState().hash;

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

/**
 * One wrong try, for the PIN and for the email code alike (QA R9 P2): 5 in
 * a row lock both for 15 minutes.
 */
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
