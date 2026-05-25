import axios from 'axios';
import { secureGet, secureDelete } from '../utils/secureStorage';

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

// Handle 401 + 503 globally
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await secureDelete('authToken');
    }
    if (
      error.response?.status === 503 &&
      error.response?.data?.code === 'MAINTENANCE_MODE'
    ) {
      const { triggerMaintenance } = await import('../utils/maintenanceState.js');
      triggerMaintenance(error.response.data);
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

// NFC card management
export const getNfcStatus   = ()    => apiClient.get('/nfc/status').then((r) => r.data);
export const linkNfcCard    = (uid) => apiClient.post('/nfc/link', { uid }).then((r) => r.data);
export const unlinkNfcCard  = ()    => apiClient.delete('/nfc/unlink').then((r) => r.data);

// Favorite routes
export const getFavoriteRoutes   = ()               => apiClient.get('/users/me/favorites').then((r) => r.data);
export const addFavoriteRoute    = (routeId, nick)  => apiClient.post('/users/me/favorites', { route_id: routeId, nickname: nick ?? null }).then((r) => r.data);
export const removeFavoriteRoute = (routeId)        => apiClient.delete(`/users/me/favorites/${routeId}`).then((r) => r.data);

// Account deletion
export const requestAccountDeletion = () => apiClient.delete('/users/me').then((r) => r.data);

// Ratings
export const submitRating = (payload) => apiClient.post('/ratings', payload).then((r) => r.data);

export default apiClient;
