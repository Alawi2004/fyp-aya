// import React, { createContext, useState, useContext, useEffect } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { loginApi, registerApi, logoutApi, getProfileApi } from '../api/authApi';

// const AuthContext = createContext();

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [role, setRole] = useState(null); // 'passenger' | 'driver'

//   useEffect(() => {
//     loadStoredAuth();
//   }, []);

//   const loadStoredAuth = async () => {
//     try {
//       const storedToken = await AsyncStorage.getItem('authToken');
//       const storedRole = await AsyncStorage.getItem('userRole');
//       if (storedToken) {
//         setToken(storedToken);
//         setRole(storedRole);
//         const res = await getProfileApi();
//         setUser(res.data.user);
//       }
//     } catch (e) {
//       console.log('Auth load error:', e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email, password, userRole) => {
//     const res = await loginApi({ email, password, role: userRole });
//     const { token: t, user: u } = res.data;
//     await AsyncStorage.setItem('authToken', t);
//     await AsyncStorage.setItem('userRole', userRole);
//     setToken(t);
//     setUser(u);
//     setRole(userRole);
//     return u;
//   };

//   const register = async (data, userRole) => {
//     const res = await registerApi({ ...data, role: userRole });
//     const { token: t, user: u } = res.data;
//     await AsyncStorage.setItem('authToken', t);
//     await AsyncStorage.setItem('userRole', userRole);
//     setToken(t);
//     setUser(u);
//     setRole(userRole);
//     return u;
//   };

//   const logout = async () => {
//     try { await logoutApi(); } catch (e) {}
//     await AsyncStorage.multiRemove(['authToken', 'userRole']);
//     setToken(null);
//     setUser(null);
//     setRole(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, token, role, loading, login, register, logout, setUser }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

const MOCK_PASSENGER = { _id: '1', name: 'Alex Morgan', email: 'alex@email.com', phone: '+1 234 567 8900' };
const MOCK_DRIVER = { _id: '2', name: 'James Carter', email: 'driver@email.com', phone: '+1 987 654 3210' };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedRole && storedUser) {
        setRole(storedRole);
        setUser(JSON.parse(storedUser));
        setToken('mock-token');
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const login = async (email, password, userRole) => {
    const mockUser = userRole === 'driver' ? MOCK_DRIVER : MOCK_PASSENGER;
    await AsyncStorage.setItem('userRole', userRole);
    await AsyncStorage.setItem('userData', JSON.stringify(mockUser));
    setToken('mock-token');
    setUser(mockUser);
    setRole(userRole);
    return mockUser;
  };

  const register = async (data, userRole) => {
    const mockUser = { _id: Date.now().toString(), name: data.name, email: data.email, phone: data.phone };
    await AsyncStorage.setItem('userRole', userRole);
    await AsyncStorage.setItem('userData', JSON.stringify(mockUser));
    setToken('mock-token');
    setUser(mockUser);
    setRole(userRole);
    return mockUser;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['userRole', 'userData']);
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, role, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);