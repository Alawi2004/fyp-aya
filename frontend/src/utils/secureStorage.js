/**
 * Secure Storage utility — Yalla Transit
 *
 * Wraps expo-secure-store (iOS Keychain / Android Keystore) for secrets,
 * with a transparent AsyncStorage fallback for:
 *   • Expo Go (SecureStore is unavailable in Expo Go for iOS simulator)
 *   • Edge cases where SecureStore fails (e.g., locked device on Android)
 *
 * Usage:
 *   import { secureGet, secureSave, secureDelete, secureMultiRemove } from '../utils/secureStorage';
 *
 * Sensitive keys (stored in SecureStore):
 *   authToken       — JWT bearer token (short-lived access token)
 *   refreshToken    — long-lived token used to silently mint new access tokens
 *   bio_userRole    — biometric-persistent role (survives logout)
 *   bio_userData    — biometric-persistent user object (survives logout)
 *
 * Non-sensitive keys remain in AsyncStorage (role, userData, bioEnabled, etc.).
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage    from '@react-native-async-storage/async-storage';

/** Keys that must be stored in SecureStore (contain credentials or tokens). */
const SECURE_KEYS = new Set([
  'authToken',
  'refreshToken',
  'bio_userRole',
  'bio_userData',
]);

function isSecure(key) { return SECURE_KEYS.has(key); }

// ── SecureStore operations ────────────────────────────────────────────────────

async function _secureGet(key) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key); // fallback: Expo Go or unavailable
  }
}

async function _secureSave(key, value) {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function _secureDelete(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
  // Also clean up any previous AsyncStorage entry (migration safety)
  await AsyncStorage.removeItem(key).catch(() => {});
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get an item.  Routes secure keys to SecureStore, others to AsyncStorage.
 */
export async function secureGet(key) {
  if (isSecure(key)) return _secureGet(key);
  return AsyncStorage.getItem(key);
}

/**
 * Save an item.  Routes secure keys to SecureStore, others to AsyncStorage.
 */
export async function secureSave(key, value) {
  if (value === null || value === undefined) return secureDelete(key);
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (isSecure(key)) return _secureSave(key, str);
  return AsyncStorage.setItem(key, str);
}

/**
 * Delete an item from whichever store it lives in.
 */
export async function secureDelete(key) {
  if (isSecure(key)) return _secureDelete(key);
  return AsyncStorage.removeItem(key);
}

/**
 * Remove multiple keys (mixed secure + async).
 */
export async function secureMultiRemove(keys) {
  await Promise.allSettled(keys.map(secureDelete));
}
