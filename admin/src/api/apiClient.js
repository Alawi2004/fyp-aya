// Admin API Client — always calls the real backend at VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Token stored in sessionStorage by AuthContext after login
function getToken() {
  try { return sessionStorage.getItem('admin_token') || null; } catch { return null; }
}
function setToken(t) {
  try { if (t) sessionStorage.setItem('admin_token', t); else sessionStorage.removeItem('admin_token'); } catch {}
}

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this._refreshing = null;
  }

  _authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async handleResponse(response) {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message;
      try {
        const data = JSON.parse(text);
        message = data.error || data.message || response.statusText;
      } catch {
        message = text || response.statusText;
      }
      throw new Error(message || `Request failed (${response.status})`);
    }
    return response.json();
  }

  async _tryRefresh() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(async r => {
      this._refreshing = null;
      if (r.ok) {
        try {
          const body = await r.clone().json();
          if (body.access_token) setToken(body.access_token);
        } catch {}
      }
      return r.ok;
    }).catch(() => {
      this._refreshing = null;
      return false;
    });
    return this._refreshing;
  }

  async _fetch(method, endpoint, data) {
    const buildOpts = () => ({
      method,
      // No credentials:'include' here — cookies would override the admin Bearer token.
      // The refresh call below uses its own fetch with credentials:'include'.
      headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });

    let response = await fetch(`${this.baseURL}${endpoint}`, buildOpts());

    if (response.status === 401 && !endpoint.startsWith('/auth/')) {
      const refreshed = await this._tryRefresh();
      if (refreshed) {
        response = await fetch(`${this.baseURL}${endpoint}`, buildOpts());
      } else {
        localStorage.removeItem('admin_user');
        sessionStorage.removeItem('admin_token');
        window.location.href = '/';
        throw new Error('Session expired. Please log in again.');
      }
    }

    return this.handleResponse(response);
  }

  async get(endpoint) {
    return this._fetch('GET', endpoint);
  }

  async post(endpoint, data) {
    return this._fetch('POST', endpoint, data);
  }

  async put(endpoint, data) {
    return this._fetch('PUT', endpoint, data);
  }

  async patch(endpoint, data) {
    return this._fetch('PATCH', endpoint, data);
  }

  async delete(endpoint) {
    return this._fetch('DELETE', endpoint);
  }
}

export default new ApiClient(API_BASE_URL);
