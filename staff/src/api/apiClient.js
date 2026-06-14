const API_BASE  = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "staff_access_token";
const USER_KEY  = "staff_user";
const REFRESH_KEY = "staff_refresh_token";

// Called when the server says the session is invalid so we wipe everything and
// redirect to login without requiring the React tree to be involved.
function forceLogout() {
  try { localStorage.removeItem(TOKEN_KEY);  } catch {}
  try { localStorage.removeItem(USER_KEY);   } catch {}
  try { localStorage.removeItem(REFRESH_KEY);} catch {}
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

class StaffApiClient {
  constructor(base) {
    this.base   = base;
    this._token = null;
    try { this._token = localStorage.getItem(TOKEN_KEY) || null; } catch {}
  }

  setToken(token) {
    this._token = token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  }

  clearToken() {
    this._token = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }

  headers() {
    const h = { "Content-Type": "application/json" };
    if (this._token) h["Authorization"] = `Bearer ${this._token}`;
    return h;
  }

  async handle(res) {
    // Expired / invalid token → wipe session and go back to login
    if (res.status === 401) {
      forceLogout();
      throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const b = await res.json(); msg = b.error || b.message || msg; } catch {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async _fetch(method, path, body) {
    try {
      const opts = { method, credentials: "include", headers: this.headers() };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(`${this.base}${path}`, opts);
      return this.handle(res);
    } catch (err) {
      if (err.status) throw err; // already handled above
      if (err.name === "TypeError") {
        throw new Error("Cannot reach the server. Make sure the backend is running.");
      }
      throw err;
    }
  }

  get(path)        { return this._fetch("GET",    path); }
  post(path, body) { return this._fetch("POST",   path, body); }
  put(path, body)  { return this._fetch("PUT",    path, body); }
  del(path)        { return this._fetch("DELETE", path); }
}

export default new StaffApiClient(API_BASE);
