import { createContext, useContext, useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const FRONTEND_ONLY = import.meta.env.VITE_FRONTEND_ONLY !== "false";

const USER_KEY = "admin_user";

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
      persist(data.user);
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
      persist(data.user);
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
    apiPost("/auth/logout", {}).catch(() => {});
  }, []);

  const getLoginAudit = useCallback(async (limit = 50) => {
    if (FRONTEND_ONLY) return MOCK_AUDIT;
    return apiGet(`/auth/login-audit?limit=${limit}`);
  }, []);

  const getSessions = useCallback(async () => {
    if (FRONTEND_ONLY) return MOCK_SESSIONS;
    return apiGet("/auth/sessions");
  }, []);

  const revokeSession = useCallback(async (sessionId) => {
    if (FRONTEND_ONLY) return { message: "Session revoked (demo)" };
    return apiDeleteAuth(`/auth/sessions/${sessionId}`);
  }, []);

  const revokeAllOtherSessions = useCallback(async () => {
    if (FRONTEND_ONLY) return { revoked: 2 };
    return apiDeleteAuth("/auth/sessions/others");
  }, []);

  const get2faStatus = useCallback(async () => {
    if (FRONTEND_ONLY) return { enabled: false };
    return apiGet("/auth/2fa/status");
  }, []);

  const setup2fa = useCallback(async () => {
    if (FRONTEND_ONLY) return { secret: "JBSWY3DPEHPK3PXP", qr_code: null };
    return apiPostAuth("/auth/2fa/setup", {});
  }, []);

  const confirm2fa = useCallback(async (totpCode) => {
    if (FRONTEND_ONLY) return { message: "2FA enabled (demo)" };
    return apiPostAuth("/auth/2fa/confirm", { totp_code: totpCode });
  }, []);

  const disable2fa = useCallback(async () => {
    if (FRONTEND_ONLY) return { message: "2FA disabled (demo)" };
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

const MOCK_SESSIONS = [
  { session_id: 1, device_name: "Windows (Chrome)", device_fingerprint: "a3f2b1c0", ip_address: "192.168.1.109", last_active_at: new Date().toISOString(),                       created_at: new Date(Date.now() - 30 * 60000).toISOString(), is_current: true  },
  { session_id: 2, device_name: "iPhone",           device_fingerprint: "deadbeef", ip_address: "192.168.1.105", last_active_at: new Date(Date.now() - 3 * 3600000).toISOString(), created_at: new Date(Date.now() - 4 * 3600000).toISOString(), is_current: false },
  { session_id: 3, device_name: "Mac (Safari)",     device_fingerprint: "c0ffee01", ip_address: "10.0.0.5",      last_active_at: new Date(Date.now() - 2 * 86400000).toISOString(), created_at: new Date(Date.now() - 3 * 86400000).toISOString(), is_current: false },
];

const MOCK_AUDIT = [
  { log_id: 1, email_attempted: "admin@example.com", ip_address: "192.168.1.10", user_agent: "Mozilla/5.0 (Windows NT 10.0)", device_fingerprint: "a3f2b1c0", success: true,  failure_reason: null,            logged_at: new Date(Date.now() - 2 * 60000).toISOString(),           full_name: "Admin", role: "admin" },
  { log_id: 2, email_attempted: "admin@example.com", ip_address: "192.168.1.10", user_agent: "Mozilla/5.0 (Windows NT 10.0)", device_fingerprint: "a3f2b1c0", success: false, failure_reason: "wrong_password", logged_at: new Date(Date.now() - 15 * 60000).toISOString(),          full_name: "Admin", role: "admin" },
  { log_id: 3, email_attempted: "unknown@evil.com",   ip_address: "203.0.113.42", user_agent: "curl/7.68.0",                  device_fingerprint: "deadbeef", success: false, failure_reason: "user_not_found", logged_at: new Date(Date.now() - 60 * 60000).toISOString(),          full_name: null,    role: null   },
];
