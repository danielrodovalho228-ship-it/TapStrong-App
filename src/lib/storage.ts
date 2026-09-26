import type { StateStorage } from 'zustand/middleware';

/**
 * Local key-value storage for persisted stores (SPEC §3: MMKV for local cache).
 *
 * MMKV is a native module that Expo Go does not include. In Expo Go (and in
 * tests) we fall back to memory, so the app still runs; data then lasts only
 * for the session. Development and store builds use MMKV.
 */

type KeyValue = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
};

function memoryStore(): KeyValue {
  const map = new Map<string, string>();
  return {
    getString: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    remove: (key) => map.delete(key),
  };
}

function createStore(): { store: KeyValue; persistent: boolean } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id: 'tapstrong' });
    // Touch the native object once so a missing module fails here, not later.
    mmkv.getString('__probe__');
    return { store: mmkv, persistent: true };
  } catch {
    return { store: memoryStore(), persistent: false };
  }
}

const { store, persistent } = createStore();

/** True when data survives an app restart (MMKV available). */
export const isPersistentStorage = persistent;

export const kvStorage: StateStorage = {
  getItem: (name) => store.getString(name) ?? null,
  setItem: (name, value) => store.set(name, value),
  removeItem: (name) => void store.remove(name),
};
