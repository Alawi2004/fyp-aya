import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FRONTEND_ONLY = process.env.EXPO_PUBLIC_FRONTEND_ONLY !== 'false';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'mock://frontend-only';

const mockPassengerData = {
  buses: [
    { _id: '1', type: 'bus', name: 'Express 101', route: 'Route A', origin: 'Central Station', destination: 'Airport', departureTime: '08:00 AM', arrivalTime: '09:30 AM', duration: '1h 30m', price: '4.50', totalSeats: 40, bookedSeats: 32, status: 'active' },
    { _id: '2', type: 'van', name: 'QuickVan A1', route: 'Route E', origin: 'Tech Park', destination: 'City Center', departureTime: '07:30 AM', arrivalTime: '08:10 AM', duration: '40m', price: '3.50', totalSeats: 12, bookedSeats: 7, status: 'active' },
  ],
  wallet: { balance: 35.5 },
  transactions: [
    { id: 'tx-1', type: 'topup', amount: 20, title: 'Wallet top-up', created_at: new Date().toISOString() },
    { id: 'tx-2', type: 'payment', amount: -4.5, title: 'Express 101 ticket', created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
  locations: [
    { id: 1, name: 'Central Station', address: 'Downtown Beirut' },
    { id: 2, name: 'Hamra Kiosk', address: 'Hamra Main Street' },
  ],
  bookings: [],
  stops: [
    { stop_id: 11, stop_name: 'Chtaura', latitude: 33.81, longitude: 35.85 },
    { stop_id: 48, stop_name: 'Adliyeh Roundabout', latitude: 33.88, longitude: 35.51 },
    { stop_id: 71, stop_name: 'Hamra', latitude: 33.895, longitude: 35.482 },
    { stop_id: 88, stop_name: 'Beirut Souks', latitude: 33.899, longitude: 35.501 },
  ],
};

const mockMultiTrip = {
  route_type: 'multi_step',
  mode: 'fastest',
  total_price: 400000,
  total_duration_min: 52,
  total_transfers: 2,
  walking_time_min: 8,
  summary: 'ML1 -> B1 -> B2 -> Walk',
  segments: [
    { type: 'bus', line: 'ML1', route_name: 'Chtaura -> Adliyeh Roundabout', from: 'Chtaura', to: 'Adliyeh Roundabout', from_stop_id: 11, to_stop_id: 48, stops: 13, estimated_time_min: 20, price: 150000 },
    { type: 'bus', line: 'B1', route_name: 'Adliyeh -> Hamra', from: 'Adliyeh Roundabout', to: 'Hamra', from_stop_id: 48, to_stop_id: 71, stops: 8, estimated_time_min: 15, price: 125000, transfer_from_previous_min: 4 },
    { type: 'bus', line: 'B2', route_name: 'Hamra -> Beirut Souks', from: 'Hamra', to: 'Beirut Souks', from_stop_id: 71, to_stop_id: 88, stops: 5, estimated_time_min: 9, price: 125000, transfer_from_previous_min: 3 },
    { type: 'walk', from: 'Beirut Souks Stop', to: 'Final Destination', from_stop_id: 88, to_stop_id: 999, estimated_time_min: 8, distance_m: 550, directions_available: true },
  ],
  alternatives: [],
};

const mockResponse = (config) => {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    return { token: 'mock-token', user: { _id: 'mock-user', name: body.name || 'Demo User', email: body.email || 'demo@example.com', role: body.role || 'passenger' } };
  }
  if (url.includes('/auth/me')) return { user: { _id: 'mock-user', name: 'Demo User', email: 'demo@example.com' } };
  if (url.includes('/routes/multi-trip')) return mockMultiTrip;
  if (url.includes('/buses')) return { buses: mockPassengerData.buses };
  if (url.includes('/wallet/transactions')) return mockPassengerData.transactions;
  if (url.includes('/wallet/locations')) return mockPassengerData.locations;
  if (url.includes('/wallet')) return mockPassengerData.wallet;
  if (url.includes('/bookings') && method === 'post') return { booking: { _id: Date.now().toString(), ...body, status: 'upcoming' } };
  if (url.includes('/bookings')) return { bookings: mockPassengerData.bookings };
  if (url.includes('/stops')) return mockPassengerData.stops;
  if (url.includes('/driver/trips')) return { trips: [] };
  if (url.includes('/driver/earnings')) return { total: 0, trips: 0, history: [] };
  return { ok: true };
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT) || 15000,
  headers: { 'Content-Type': 'application/json' },
  adapter: FRONTEND_ONLY
    ? async (config) => ({
        data: mockResponse(config),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: null,
      })
    : undefined,
});

// Attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
