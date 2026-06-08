import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSave, secureDelete, secureMultiRemove } from '../utils/secureStorage';
import axios from 'axios';

const AuthContext = createContext();

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.109:4000/api';
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

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const storedRole  = await AsyncStorage.getItem(K.userRole);
      const storedUser  = await AsyncStorage.getItem(K.userData);
      const storedToken = await secureGet('authToken');
      if (storedRole && storedUser) {
        setRole(storedRole);
        setUser(JSON.parse(storedUser));
        setToken(storedToken ?? null);
      }
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
    return res.data; // { user, access_token }
  };

  // ── login (email + password for any role) ────────────────────────────────
  const login = async (email, password, userRole) => {
    if (FRONTEND_ONLY) {
      const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
      await _saveSession(userRole, mockUser, 'mock-token');
      return mockUser;
    }
    const { user: rawUser, access_token } = await _apiLogin(email, password);
    const userData = normaliseUser(rawUser);
    await _saveSession(rawUser.role ?? userRole, userData, access_token);
    return userData;
  };

  // ── verifyCredentials — checks credentials without saving session ─────────
  // Used for the login-OTP flow: verify creds first, navigate to OTP, then finalizeLogin
  const verifyCredentials = async (email, password, userRole) => {
    if (FRONTEND_ONLY) {
      const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
      return { userData: mockUser, accessToken: 'mock-token', userRole };
    }
    const { user: rawUser, access_token } = await _apiLogin(email, password);
    const userData = normaliseUser(rawUser);
    return { userData, accessToken: access_token, userRole: rawUser.role ?? userRole };
  };

  // ── finalizeLogin — saves session after OTP verification ─────────────────
  const finalizeLogin = async (userRole, userData, accessToken) => {
    await _saveSession(userRole, userData, accessToken);
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
    const { user: rawUser, access_token } = await _apiLogin(phone, pin);
    const userData = normaliseUser(rawUser);
    await _saveSession(rawUser.role ?? userRole, userData, access_token);
    return userData;
  };

  const _saveSession = async (userRole, userData, accessToken) => {
    await AsyncStorage.setItem(K.userRole, userRole);
    await AsyncStorage.setItem(K.userData, JSON.stringify(userData));
    if (accessToken && accessToken !== 'mock-token') {
      await secureSave('authToken', accessToken);
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
      const { user: rawUser, access_token } = await _apiLogin(data.email, data.password);
      const userData = normaliseUser(rawUser);
      await _saveSession(rawUser.role ?? userRole ?? 'passenger', userData, access_token);
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
    await AsyncStorage.multiRemove([K.userRole, K.userData]);
    await secureDelete('authToken');
    setToken(null);
    setUser(null);
    setRole(null);
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
