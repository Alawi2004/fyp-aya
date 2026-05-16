import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureGet, secureSave, secureDelete, secureMultiRemove } from '../utils/secureStorage';

const AuthContext = createContext();

const MOCK_PASSENGER = {
  _id: '1', name: 'Alex Morgan', email: 'alex@email.com',
  phone: '+1 234 567 8900', category: 'regular',
};
const MOCK_DRIVER = {
  _id: '2', name: 'James Carter', email: 'driver@email.com',
  phone: '+1 987 654 3210',
};

// Storage keys — bio_* keys intentionally survive logout
const K = {
  userRole:    'userRole',
  userData:    'userData',
  bioEnabled:  'biometricEnabled',
  bioUserRole: 'bio_userRole',   // persists across logout
  bioUserData: 'bio_userData',   // persists across logout
  bioPrefType: 'bio_pref_type',  // 'face' | 'fingerprint'
};

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
      // authToken stored in SecureStore; read it back to restore the session
      const storedToken = await secureGet('authToken');
      if (storedRole && storedUser) {
        setRole(storedRole);
        setUser(JSON.parse(storedUser));
        setToken(storedToken ?? 'mock-token');
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  // ── helpers ──────────────────────────────────────────────────────────────
  const _persistBioCredentials = async (userRole, userData) => {
    await AsyncStorage.setItem(K.bioUserRole, userRole);
    await AsyncStorage.setItem(K.bioUserData, JSON.stringify(userData));
  };

  // ── auth actions ─────────────────────────────────────────────────────────
  const login = async (email, password, userRole) => {
    const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
    await AsyncStorage.setItem(K.userRole, userRole);
    await AsyncStorage.setItem(K.userData, JSON.stringify(mockUser));
    await secureSave('authToken', 'mock-token');   // store JWT securely
    // Keep bio credentials in sync if biometric is already enabled
    const bioEnabled = await AsyncStorage.getItem(K.bioEnabled);
    if (bioEnabled === 'true') await _persistBioCredentials(userRole, mockUser);
    setToken('mock-token');
    setUser(mockUser);
    setRole(userRole);
    return mockUser;
  };

  const loginWithPhone = async (phone, pin, userRole, extraData = {}) => {
    const mockUser = {
      _id:      extraData._id      || MOCK_PASSENGER._id,
      name:     extraData.name     || MOCK_PASSENGER.name,
      phone:    phone              || MOCK_PASSENGER.phone,
      email:    extraData.email    || MOCK_PASSENGER.email,
      category: extraData.category || 'regular',
    };
    await AsyncStorage.setItem(K.userRole, userRole);
    await AsyncStorage.setItem(K.userData, JSON.stringify(mockUser));
    const bioEnabled = await AsyncStorage.getItem(K.bioEnabled);
    if (bioEnabled === 'true') await _persistBioCredentials(userRole, mockUser);
    setToken('mock-token');
    setUser(mockUser);
    setRole(userRole);
    return mockUser;
  };

  const biometricLogin = async () => {
    // bio_* keys live in SecureStore — survive logout, encrypted at rest
    const storedRole = await secureGet(K.bioUserRole);
    const storedUser = await secureGet(K.bioUserData);
    if (!storedRole || !storedUser) throw new Error('No stored biometric credentials');
    const parsedUser = JSON.parse(storedUser);
    // Restore the main session
    await AsyncStorage.setItem(K.userRole, storedRole);
    await AsyncStorage.setItem(K.userData, storedUser);
    await secureSave('authToken', 'mock-token');
    setToken('mock-token');
    setUser(parsedUser);
    setRole(storedRole);
    return parsedUser;
  };

  const setBiometricEnabled = async (enabled) => {
    await AsyncStorage.setItem(K.bioEnabled, enabled ? 'true' : 'false');
    if (enabled) {
      // Snapshot current session into SecureStore so it survives logout
      const currentRole = await AsyncStorage.getItem(K.userRole);
      const currentUser = await AsyncStorage.getItem(K.userData);
      if (currentRole && currentUser) {
        await secureSave(K.bioUserRole, currentRole);
        await secureSave(K.bioUserData, currentUser);
      }
    } else {
      // Wipe persistent bio credentials from SecureStore + pref from AsyncStorage
      await secureMultiRemove([K.bioUserRole, K.bioUserData]);
      await AsyncStorage.removeItem(K.bioPrefType);
    }
  };

  const isBiometricEnabled = async () => {
    const val = await AsyncStorage.getItem(K.bioEnabled);
    return val === 'true';
  };

  const getBiometricPreferredType = async () =>
    AsyncStorage.getItem(K.bioPrefType); // 'face' | 'fingerprint' | null

  const setBiometricPreferredType = async (type) => {
    if (type) await AsyncStorage.setItem(K.bioPrefType, type);
    else await AsyncStorage.removeItem(K.bioPrefType);
  };

  const register = async (data, userRole) => {
    const mockUser = {
      _id: Date.now().toString(), name: data.name,
      email: data.email, phone: data.phone,
    };
    await AsyncStorage.setItem(K.userRole, userRole);
    await AsyncStorage.setItem(K.userData, JSON.stringify(mockUser));
    await secureSave('authToken', 'mock-token');
    setToken('mock-token');
    setUser(mockUser);
    setRole(userRole);
    return mockUser;
  };

  const logout = async () => {
    // Remove active session — bio_* in SecureStore intentionally survive for re-auth
    await AsyncStorage.multiRemove([K.userRole, K.userData]);
    await secureDelete('authToken');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user, token, role, loading,
      login, loginWithPhone, biometricLogin,
      setBiometricEnabled, isBiometricEnabled,
      getBiometricPreferredType, setBiometricPreferredType,
      register, logout, setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
