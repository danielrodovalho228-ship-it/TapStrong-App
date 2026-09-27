import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

import { kvStorage } from './storage';

/**
 * Keychain / Keystore storage for small secrets (QA round 3: the parent PIN
 * hash and its lockout must not be readable or editable in plain app
 * storage). Web has no secure store and falls back to the normal storage.
 */
export const secureStorage: StateStorage =
  Platform.OS === 'web'
    ? kvStorage
    : {
        getItem: (key) => SecureStore.getItem(key),
        setItem: (key, value) => SecureStore.setItem(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      };
