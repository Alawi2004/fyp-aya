import { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../api/apiClient";

const AuthContext  = createContext(null);
const USER_KEY     = "staff_user";
const REFRESH_KEY  = "staff_refresh_token";

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(USER_KEY));
      // Reject any cached session that isn't a staff account
      if (stored && stored.role !== "staff") {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem("staff_access_token");
        return null;
      }
      return stored || null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Restore token into the apiClient singleton on mount so previously-stored
  // sessions are authenticated immediately (apiClient already reads it in its
  // constructor, but re-setting here is harmless and makes the init explicit).
  useEffect(() => {
    const stored = localStorage.getItem("staff_access_token");
    if (stored) apiClient.setToken(stored);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post("/auth/login", { email, password });

      // Enforce staff-only access before storing anything
      if (data.user?.role !== "staff") {
        const role = data.user?.role ?? "unknown";
        throw new Error(
          `Access denied. This portal is for staff accounts only (your role: ${role}). Contact your administrator.`
        );
      }

      // data = { user, access_token, refresh_token }
      if (data.access_token) apiClient.setToken(data.access_token);
      if (data.refresh_token) {
        try { localStorage.setItem(REFRESH_KEY, data.refresh_token); } catch {}
      }

      const profile = data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      setUser(profile);
      return profile;
    } catch (err) {
      // Make sure nothing is persisted if login failed
      apiClient.clearToken();
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    // Clear local state immediately for instant UI response
    apiClient.clearToken();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUser(null);
    // Revoke the server-side session in the background
    if (refreshToken) {
      apiClient.post("/auth/logout", { refresh_token: refreshToken }).catch(() => {});
    }
  };

  const isAuthenticated = !!user;

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
