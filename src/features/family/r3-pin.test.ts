/**
 * QA round 3 (P2) — parent PIN storage: slow key derivation, Keychain /
 * Keystore storage, the old PIN carried over once, and the lockout mirrored
 * on the server.
 */
import * as SecureStore from 'expo-secure-store';

import { useAccountStore } from '@/features/account/store';
import { kvStorage } from '@/lib/storage';

import {
  checkParentPin,
  derivePin,
  lockMinutesLeft,
  PIN_ROUNDS,
  setParentPin,
  useParentPinStore,
} from './parentPin';
import { mergeLock, pullPinLock, reportPinCheck } from './pinLockout';

const NOW = new Date('2026-09-27T12:00:00Z');

function oldDigest(pin: string, salt: string): string {
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

beforeEach(() => {
  useParentPinStore.getState().reset();
  useAccountStore.getState().reset();
  useAccountStore.getState().update({ saved: true, email: 'dan@example.com' });
});

describe('PIN key derivation and storage', () => {
  it('keeps a 256-bit PBKDF2 key (100,000 rounds), never the PIN', () => {
    expect(PIN_ROUNDS).toBeGreaterThanOrEqual(100_000);
    setParentPin('2468');
    const { hash, salt, algo } = useParentPinStore.getState();
    expect(algo).toBe('pbkdf2');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(derivePin('2468', salt!));
    expect(derivePin('2468', 'another-salt')).not.toBe(hash);
  });

  it('lives in the secure store, not in plain app storage', () => {
    setParentPin('2468');
    expect(SecureStore.getItem('parent-pin-secure')).toContain(useParentPinStore.getState().hash);
    expect(kvStorage.getItem('parent-pin-secure')).toBeFalsy();
    expect(kvStorage.getItem('parent-pin')).toBeFalsy();
  });

  it('a PIN planted in plain storage is ignored and deleted (QA R4-05)', async () => {
    const salt = 'old-salt';
    kvStorage.setItem(
      'parent-pin',
      JSON.stringify({
        state: { hash: oldDigest('1357', salt), salt, failures: 0, lockedUntil: null },
      }),
    );
    await SecureStore.deleteItemAsync('parent-pin-secure');
    useParentPinStore.setState({ hash: null, salt: null });
    await useParentPinStore.persist.rehydrate();
    expect(kvStorage.getItem('parent-pin')).toBeFalsy();
    expect(useParentPinStore.getState().hash).toBeFalsy();
    expect(checkParentPin('1357', NOW)).toBe('no_pin');
  });
});

describe('server lockout mirror', () => {
  const client = (rpc: jest.Mock) => ({ rpc }) as never;

  it('a later lock from the server applies on the phone', () => {
    setParentPin('2468');
    const until = new Date(NOW.getTime() + 10 * 60000).toISOString();
    mergeLock(until);
    expect(checkParentPin('2468', NOW)).toBe('locked');
    expect(lockMinutesLeft(NOW)).toBe(10);
    // An earlier server lock never shortens the phone's.
    mergeLock(new Date(NOW.getTime() + 60000).toISOString());
    expect(lockMinutesLeft(NOW)).toBe(10);
  });

  it('pulls the lock when the gate opens', async () => {
    setParentPin('2468');
    const until = new Date(NOW.getTime() + 15 * 60000).toISOString();
    // Security round 1: one status call gives the PIN and the lock.
    const rpc = jest.fn(async () => ({
      data: [{ has_pin: true, locked_until: until }],
      error: null,
    }));
    await pullPinLock(client(rpc));
    expect(rpc).toHaveBeenCalledWith('parent_pin_status');
    expect(useParentPinStore.getState().serverHasPin).toBe(true);
    expect(checkParentPin('2468', NOW)).toBe('locked');
  });

  it('reports offline wrong tries; a right one is never "reported" (the server clears it)', async () => {
    setParentPin('2468');
    const until = new Date(NOW.getTime() + 15 * 60000).toISOString();
    const rpc = jest.fn(async (name: string) => ({
      data: name === 'parent_pin_failed' ? until : null,
      error: null,
    }));
    await reportPinCheck(client(rpc), 'wrong');
    expect(rpc).toHaveBeenCalledWith('parent_pin_failed');
    expect(lockMinutesLeft(NOW)).toBe(15);
    await reportPinCheck(client(rpc), 'ok');
    expect(rpc).not.toHaveBeenCalledWith('parent_pin_passed');
  });

  it('offline or signed out: nothing is sent and nothing breaks', async () => {
    const rpc = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(reportPinCheck(client(rpc), 'wrong')).resolves.toBeUndefined();
    useAccountStore.getState().update({ saved: false });
    const quiet = jest.fn();
    await pullPinLock(client(quiet));
    expect(quiet).not.toHaveBeenCalled();
  });
});
