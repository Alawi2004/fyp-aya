import { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../api/apiClient";

const AuthContext = createContext(null);

const USER_KEY = "staff_user";

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      // ── Demo mode: accept any email/password without a backend ──
      const DEMO_TOKEN = "demo-staff-token";
      const profile = {
        user_id:   1,
        full_name: "Staff Member",
        email,
        role:      "staff",
      };
      apiClient.setToken(DEMO_TOKEN);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      setUser(profile);
      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    apiClient.clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const isAuthenticated = !!user && !!apiClient.getToken();

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
