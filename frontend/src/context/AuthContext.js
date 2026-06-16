import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSave, secureDelete, secureMultiRemove } from '../utils/secureStorage';
import { setSessionExpiredHandler } from '../api/apiClient';
import axios from 'axios';

const AuthContext = createContext();

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.14:4000/api';
const FRONTEND_ONLY = process.env.EXPO_PUBLIC_FRONTEND_ONLY !== 'false';

const MOCK_PASSENGER = {
  user_id: 1, _id: '1', name: 'Alex Morgan', full_name: 'Alex Morgan',
  email: 'passenger@example.com', phone: '+1 234 567 8900', role: 'passenger',
};
const MOCK_DRIVER = {
  user_id: 12, _id: '12', name: 'Evan Driver', full_name: 'Evan Driver',
  email: 'driver@example.com', phone: '+1 987 654 3210', role: 'driver', driver_id: 4,
};

const K = {
  userRole:    'userRole',
  userData:    'userData',
  bioEnabled:  'biometricEnabled',
  bioUserRole: 'bio_userRole',
  bioUserData: 'bio_userData',
  bioPrefType: 'bio_pref_type',
};

function normaliseUser(raw) {
  return {
    ...raw,
    // Expose both _id and user_id for compatibility
    _id:      String(raw.user_id ?? raw._id ?? ''),
    user_id:  raw.user_id ?? null,
    name:     raw.full_name ?? raw.name ?? '',
    driver_id: raw.driver_id ?? null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState(null);

  // ── Storage-only cleanup — no server call, safe to call from apiClient ──────
  const _localLogout = useCallback(async () => {
    await AsyncStorage.multiRemove([K.userRole, K.userData]);
    await secureDelete('authToken');
    await secureDelete('refreshToken');
    setToken(null);
    setUser(null);
    setRole(null);
  }, []);

  useEffect(() => {
    loadStoredAuth();
    // Tell apiClient to call _localLogout if both tokens are exhausted mid-session
    // so the UI resets to the login screen automatically without needing manual logout.
    setSessionExpiredHandler(_localLogout);
    return () => setSessionExpiredHandler(null);
  }, [_localLogout]);

  const loadStoredAuth = async () => {
    try {
      const storedRole  = await AsyncStorage.getItem(K.userRole);
      const storedUser  = await AsyncStorage.getItem(K.userData);
      const storedToken = await secureGet('authToken');

      // A 'mock-token' session can only have been created while running in
      // FRONTEND_ONLY mode. If the app is now wired to the real backend, that
      // session is stale (wrong user_id, no valid JWT) — drop it.
      if (!FRONTEND_ONLY && storedToken === 'mock-token') {
        await AsyncStorage.multiRemove([K.userRole, K.userData]);
        await secureDelete('authToken');
        return;
      }

      // Require a token — if tokens were cleared (e.g. expired refresh) but
      // role/userData were left behind, treat it as a logged-out state so the
      // user is sent to the login screen rather than seeing a broken UI.
      if (!storedToken || !storedRole || !storedUser) {
        if (storedRole || storedUser) {
          await AsyncStorage.multiRemove([K.userRole, K.userData]);
        }
        return;
      }

      setRole(storedRole);
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const _persistBioCredentials = async (userRole, userData) => {
    await AsyncStorage.setItem(K.bioUserRole, userRole);
    await AsyncStorage.setItem(K.bioUserData, JSON.stringify(userData));
  };

  // ── Real API login (email + password) ─────────────────────────────────────
  const _apiLogin = async (email, password) => {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password }, { timeout: 15000 });
    return res.data; // { user, access_token, refresh_token }
  };

  // ── login (email + password for any role) ────────────────────────────────
  const login = async (email, password, userRole) => {
    if (FRONTEND_ONLY) {
      const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
      await _saveSession(userRole, mockUser, 'mock-token');
      return mockUser;
    }
    const { user: rawUser, access_token, refresh_token } = await _apiLogin(email, password);
    const userData = normaliseUser(rawUser);
    await _saveSession(rawUser.role ?? userRole, userData, access_token, refresh_token);
    return userData;
  };

  // ── verifyCredentials — checks credentials without saving session ─────────
  // Used for the login-OTP flow: verify creds first, navigate to OTP, then finalizeLogin
  const verifyCredentials = async (email, password, userRole) => {
    if (FRONTEND_ONLY) {
      const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
      return { userData: mockUser, accessToken: 'mock-token', refreshToken: null, userRole };
    }
    const { user: rawUser, access_token, refresh_token } = await _apiLogin(email, password);
    const userData = normaliseUser(rawUser);
    return { userData, accessToken: access_token, refreshToken: refresh_token, userRole: rawUser.role ?? userRole };
  };

  // ── finalizeLogin — saves session after OTP verification ─────────────────
  const finalizeLogin = async (userRole, userData, accessToken, refreshToken) => {
    await _saveSession(userRole, userData, accessToken, refreshToken);
    return userData;
  };

  // ── loginWithPhone — kept for backwards compatibility ─────────────────────
  const loginWithPhone = async (phone, pin, userRole, extraData = {}) => {
    if (FRONTEND_ONLY) {
      const mockUser = {
        ...MOCK_PASSENGER,
        _id:   extraData._id    || MOCK_PASSENGER._id,
        name:  extraData.name   || MOCK_PASSENGER.name,
        phone: phone            || MOCK_PASSENGER.phone,
        email: extraData.email  || MOCK_PASSENGER.email,
      };
      await _saveSession(userRole, mockUser, 'mock-token');
      return mockUser;
    }
    const { user: rawUser, access_token, refresh_token } = await _apiLogin(phone, pin);
    const userData = normaliseUser(rawUser);
    await _saveSession(rawUser.role ?? userRole, userData, access_token, refresh_token);
    return userData;
  };

  const _saveSession = async (userRole, userData, accessToken, refreshToken) => {
    await AsyncStorage.setItem(K.userRole, userRole);
    await AsyncStorage.setItem(K.userData, JSON.stringify(userData));
    if (accessToken && accessToken !== 'mock-token') {
      await secureSave('authToken', accessToken);
      if (refreshToken) await secureSave('refreshToken', refreshToken);
    } else {
      await secureSave('authToken', 'mock-token');
    }
    const bioEnabled = await AsyncStorage.getItem(K.bioEnabled);
    if (bioEnabled === 'true') await _persistBioCredentials(userRole, userData);
    setToken(accessToken);
    setUser(userData);
    setRole(userRole);
  };

  const biometricLogin = async () => {
    const storedRole = await secureGet(K.bioUserRole);
    const storedUser = await secureGet(K.bioUserData);
    if (!storedRole || !storedUser) throw new Error('No stored biometric credentials');
    const parsedUser = JSON.parse(storedUser);
    await AsyncStorage.setItem(K.userRole, storedRole);
    await AsyncStorage.setItem(K.userData, storedUser);
    const existingToken = await secureGet('authToken');
    await secureSave('authToken', existingToken ?? 'mock-token');
    setToken(existingToken ?? 'mock-token');
    setUser(parsedUser);
    setRole(storedRole);
    return parsedUser;
  };

  const setBiometricEnabled = async (enabled) => {
    await AsyncStorage.setItem(K.bioEnabled, enabled ? 'true' : 'false');
    if (enabled) {
      const currentRole = await AsyncStorage.getItem(K.userRole);
      const currentUser = await AsyncStorage.getItem(K.userData);
      if (currentRole && currentUser) {
        await secureSave(K.bioUserRole, currentRole);
        await secureSave(K.bioUserData, currentUser);
      }
    } else {
      await secureMultiRemove([K.bioUserRole, K.bioUserData]);
      await AsyncStorage.removeItem(K.bioPrefType);
    }
  };

  const isBiometricEnabled     = async () => (await AsyncStorage.getItem(K.bioEnabled)) === 'true';
  const getBiometricPreferredType = async () => AsyncStorage.getItem(K.bioPrefType);
  const setBiometricPreferredType = async (type) => {
    if (type) await AsyncStorage.setItem(K.bioPrefType, type);
    else await AsyncStorage.removeItem(K.bioPrefType);
  };

  const register = async (data, userRole) => {
    if (!FRONTEND_ONLY) {
      await axios.post(`${BASE_URL}/auth/register`, {
        full_name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone ?? null,
        birth_date: data.birth_date ?? null,
      }, { timeout: 15000 });
      // After registration, log in to get tokens
      const { user: rawUser, access_token, refresh_token } = await _apiLogin(data.email, data.password);
      const userData = normaliseUser(rawUser);
      await _saveSession(rawUser.role ?? userRole ?? 'passenger', userData, access_token, refresh_token);
      return userData;
    }
    const mockUser = normaliseUser({
      user_id: Date.now(), full_name: data.name,
      email: data.email, phone: data.phone, role: userRole ?? 'passenger',
    });
    await _saveSession(userRole ?? 'passenger', mockUser, 'mock-token');
    return mockUser;
  };

  const logout = async () => {
    if (!FRONTEND_ONLY) {
      const refreshToken = await secureGet('refreshToken');
      if (refreshToken) {
        // Best-effort server-side revocation — don't block logout if it fails
        await axios.post(`${BASE_URL}/auth/logout`, { refresh_token: refreshToken }, { timeout: 8000 }).catch(() => {});
      }
    }
    await _localLogout();
  };

  return (
    <AuthContext.Provider value={{
      user, token, role, loading,
      login, loginWithPhone, verifyCredentials, finalizeLogin, biometricLogin,
      setBiometricEnabled, isBiometricEnabled,
      getBiometricPreferredType, setBiometricPreferredType,
      register, logout, setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
