import axios from 'axios';
import { secureGet, secureSave, secureDelete } from '../utils/secureStorage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT) || 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request — read from SecureStore (falls back to AsyncStorage)
apiClient.interceptors.request.use(async (config) => {
  const token = await secureGet('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const clearSession = async () => {
  await secureDelete('authToken');
  await secureDelete('refreshToken');
};

// Silently exchanges the stored refresh token for a new access token.
// Shared across concurrent 401s so only one refresh request is ever in flight —
// callers await the same promise and retry once it resolves.
let refreshInFlight = null;
const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await secureGet('refreshToken');
      if (!refreshToken) throw new Error('No refresh token available');
      // Plain axios call — bypasses apiClient's interceptors to avoid recursion
      const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 15000 });
      const { access_token, refresh_token: newRefreshToken } = res.data;
      await secureSave('authToken', access_token);
      if (newRefreshToken) await secureSave('refreshToken', newRefreshToken);
      return access_token;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
};

// Handle 401 (silent token refresh + retry) and 503 (maintenance mode) globally
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;

    if (response?.status === 401 && config && !config._retried && !config.url?.endsWith('/auth/refresh')) {
      config._retried = true;
      try {
        const newAccessToken = await refreshAccessToken();
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(config);
      } catch {
        await clearSession();
        return Promise.reject(error);
      }
    }

    if (
      response?.status === 503 &&
      response?.data?.code === 'MAINTENANCE_MODE'
    ) {
      const { triggerMaintenance } = await import('../utils/maintenanceState.js');
      triggerMaintenance(response.data);
    }
    return Promise.reject(error);
  }
);

// ── Named API helpers ─────────────────────────────────────────────────────────

export const fetchBusGps = (vehicleId) => {
  const id = String(vehicleId ?? '');
  const url = /^\d+$/.test(id) ? `/gps/${id}/latest` : `/gps/bus/${encodeURIComponent(id)}`;
  return apiClient.get(url).then((r) => r.data);
};

export const registerPushToken = (pushToken) =>
  apiClient.put('/auth/push-token', { token: pushToken }).then((r) => r.data);

export const registerFcmToken = (fcmToken) =>
  apiClient.put('/auth/fcm-token', { token: fcmToken }).then((r) => r.data);

// Favorite routes
export const getFavoriteRoutes   = ()               => apiClient.get('/users/me/favorites').then((r) => r.data);
export const addFavoriteRoute    = (routeId, nick)  => apiClient.post('/users/me/favorites', { route_id: routeId, nickname: nick ?? null }).then((r) => r.data);
export const removeFavoriteRoute = (routeId)        => apiClient.delete(`/users/me/favorites/${routeId}`).then((r) => r.data);

// Account deletion
export const requestAccountDeletion = () => apiClient.delete('/users/me').then((r) => r.data);

// Ratings
export const submitRating = (payload) => apiClient.post('/ratings', payload).then((r) => r.data);

export default apiClient;
