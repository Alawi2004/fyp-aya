import { createContext, useContext, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const USER_KEY  = "admin_user";
const TOKEN_KEY = "admin_token";

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY) || null;
}

function storeToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else        sessionStorage.removeItem(TOKEN_KEY);
}

function loadStored() {
  try {
    return { user: JSON.parse(localStorage.getItem(USER_KEY) || "null") };
  } catch {
    return { user: null };
  }
}

const FETCH_OPTS = { credentials: "include" };

async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Make sure the backend is running on port 4000.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiGet(path) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...FETCH_OPTS });
  } catch {
    throw new Error("Cannot reach the server.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiDeleteAuth(path) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...FETCH_OPTS, method: "DELETE" });
  } catch {
    throw new Error("Cannot reach the server.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiPostAuth(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = loadStored();
  const [user,    setUser]    = useState(stored.user);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const persist = useCallback((u) => {
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  // Auth operations always hit the real backend — never mocked
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      try {
        res = await fetch(`${API_BASE}/auth/login`, {
          ...FETCH_OPTS,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new Error("Cannot reach the server. Make sure the backend is running on port 4000.");
      }

      const data = await res.json();

      if (res.status === 429) {
        // Account locked — attach retry info to the error
        const err = new Error(data.error || "Account temporarily locked.");
        err.retry_after_seconds = data.retry_after_seconds;
        err.locked_until        = data.locked_until;
        throw err;
      }
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      if (data.requires_2fa) {
        return { ok: false, requires_2fa: true, temp_token: data.temp_token };
      }
      if (data.user?.role !== "admin") {
        throw new Error("Access denied. This portal is for administrators only.");
      }
      persist(data.user);
      storeToken(data.access_token);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const verify2fa = useCallback(async (tempToken, totpCode) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost("/auth/verify-2fa", { temp_token: tempToken, totp_code: totpCode });
      if (data.user?.role !== "admin") {
        throw new Error("Access denied. This portal is for administrators only.");
      }
      persist(data.user);
      storeToken(data.access_token);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const forgotPassword = useCallback(async (email) => {
    return apiPost("/auth/forgot-password", { email });
  }, []);

  const resetPassword = useCallback(async (resetToken, password) => {
    return apiPost("/auth/reset-password", { token: resetToken, password });
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    storeToken(null);
    apiPost("/auth/logout", {}).catch(() => {});
  }, []);

  const getLoginAudit = useCallback(async (limit = 50) => {
    return apiGet(`/auth/login-audit?limit=${limit}`);
  }, []);

  const getSessions = useCallback(async () => {
    return apiGet("/auth/sessions");
  }, []);

  const revokeSession = useCallback(async (sessionId) => {
    return apiDeleteAuth(`/auth/sessions/${sessionId}`);
  }, []);

  const revokeAllOtherSessions = useCallback(async () => {
    return apiDeleteAuth("/auth/sessions/others");
  }, []);

  const get2faStatus = useCallback(async () => {
    return apiGet("/auth/2fa/status");
  }, []);

  const setup2fa = useCallback(async () => {
    return apiPostAuth("/auth/2fa/setup", {});
  }, []);

  const confirm2fa = useCallback(async (totpCode) => {
    return apiPostAuth("/auth/2fa/confirm", { totp_code: totpCode });
  }, []);

  const disable2fa = useCallback(async () => {
    return apiPostAuth("/auth/2fa/disable", {});
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      isAuthenticated: !!user,
      login, verify2fa, forgotPassword, resetPassword,
      logout, getLoginAudit,
      get2faStatus, setup2fa, confirm2fa, disable2fa,
      getSessions, revokeSession, revokeAllOtherSessions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
