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

const _now = new Date();
const mockMultiTrip = {
  route_type: 'multi_step',
  mode: 'fastest',
  total_price: 400000,
  total_duration_min: 44,
  traffic_adjusted_duration_min: 58,
  traffic_multiplier: 1.45,
  traffic_condition: { label: 'Heavy', color: '#F97316', severity: 'heavy' },
  delay_description: 'moderate delays expected',
  departure_time: _now.toISOString(),
  best_departure_windows: [],
  total_transfers: 2,
  walking_time_min: 8,
  summary: 'ML1 -> B1 -> B2 -> Walk',
  segments: [
    { type: 'bus', line: 'ML1', route_name: 'Chtaura -> Adliyeh Roundabout', from: 'Chtaura', to: 'Adliyeh Roundabout', from_stop_id: 11, to_stop_id: 48, stops: 13, estimated_time_min: 18, traffic_adjusted_min: 26, osrm_distance_m: 42000, data_source: 'osrm', price: 150000 },
    { type: 'bus', line: 'B1', route_name: 'Adliyeh -> Hamra', from: 'Adliyeh Roundabout', to: 'Hamra', from_stop_id: 48, to_stop_id: 71, stops: 8, estimated_time_min: 12, traffic_adjusted_min: 17, osrm_distance_m: 7200, data_source: 'osrm', price: 125000, transfer_from_previous_min: 4 },
    { type: 'bus', line: 'B2', route_name: 'Hamra -> Beirut Souks', from: 'Hamra', to: 'Beirut Souks', from_stop_id: 71, to_stop_id: 88, stops: 5, estimated_time_min: 6, traffic_adjusted_min: 9, osrm_distance_m: 3100, data_source: 'osrm', price: 125000, transfer_from_previous_min: 3 },
    { type: 'walk', from: 'Beirut Souks Stop', to: 'Final Destination', from_stop_id: 88, to_stop_id: 999, estimated_time_min: 8, traffic_adjusted_min: 8, distance_m: 550, directions_available: true },
  ],
  alternatives: [],
};

const mockEtaPredictions = {
  trip_id: 1,
  route_id: 1,
  route_name: 'Express 101',
  trip_status: 'ongoing',
  current_position: { latitude: 33.8938, longitude: 35.5018 },
  last_gps_update: _now.toISOString(),
  gps_age_seconds: 4,
  current_stop_index: 1,
  traffic: { multiplier: 1.45, label: 'Heavy', color: '#F97316', severity: 'heavy', delay_description: 'moderate delays expected' },
  stops: [
    { stop_id: 2, stop_name: 'City Mall', stop_order: 2, status: 'next',     eta_min: 8.5,  eta_min_base: 5.9,  eta_time: new Date(_now.getTime() + 8.5 * 60000).toTimeString().slice(0,5),  distance_m: 2200 },
    { stop_id: 3, stop_name: 'Airport',   stop_order: 3, status: 'upcoming', eta_min: 22.4, eta_min_base: 15.4, eta_time: new Date(_now.getTime() + 22.4 * 60000).toTimeString().slice(0,5), distance_m: 6800 },
  ],
  confidence: 0.92,
  historical_samples: 0,
  best_departure_windows: [],
  generated_at: _now.toISOString(),
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
  if (url.includes('/eta-predictions')) return mockEtaPredictions;
  if (url.includes('/traffic-forecast')) return { traffic_multiplier: 1.0, condition: { label: 'Moderate', color: '#84CC16' }, day_forecast: [], best_departure_windows: [] };
  if (url.includes('/buses')) return { buses: mockPassengerData.buses };
  if (url.includes('/wallet/transactions')) return mockPassengerData.transactions;
  if (url.includes('/wallet/locations')) return mockPassengerData.locations;
  if (url.includes('/wallet')) return mockPassengerData.wallet;
  if (url.includes('/bookings') && method === 'post') return { booking: { _id: Date.now().toString(), ...body, status: 'upcoming' } };
  if (url.includes('/bookings')) return { bookings: mockPassengerData.bookings };
  if (url.includes('/stops')) return mockPassengerData.stops;
  if (url.includes('/gps/bus/'))  return { latitude: 33.8938 + (Date.now() % 5000) * 0.0000002, longitude: 35.5018 + (Date.now() % 5000) * 0.0000003, updatedAt: new Date().toISOString() };
  if (url.includes('/notifications/user/')) return [
    { notification_id: 1, title: 'Route Delay Alert',    body: 'Trip TRP-041 delayed 15 min — heavy traffic on Jounieh Highway.', type: 'delay',   is_read: false, created_at: new Date(Date.now() - 5 * 60000).toISOString()    },
    { notification_id: 2, title: 'Schedule Update',      body: 'Your shift tomorrow starts at 07:00 instead of 06:30.',            type: 'info',    is_read: false, created_at: new Date(Date.now() - 30 * 60000).toISOString()   },
    { notification_id: 3, title: 'Passenger Feedback',   body: 'A passenger commented on trip TRP-033. Rating: 4 ★',               type: 'warning', is_read: true,  created_at: new Date(Date.now() - 2 * 3600000).toISOString()  },
    { notification_id: 4, title: 'Route 7B Update',      body: 'Route 7B has been updated with two new stops.',                    type: 'info',    is_read: true,  created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  ];
  if (url.match(/\/routes\/\d+\/waypoints/) && method === 'get') return [
    { waypoint_id: 1, latitude: 33.8938, longitude: 35.5018, wp_order: 1 },
    { waypoint_id: 2, latitude: 33.9100, longitude: 35.5150, wp_order: 2 },
    { waypoint_id: 3, latitude: 33.9280, longitude: 35.5340, wp_order: 3 },
    { waypoint_id: 4, latitude: 33.9566, longitude: 35.5901, wp_order: 4 },
    { waypoint_id: 5, latitude: 33.9806, longitude: 35.6178, wp_order: 5 },
  ];
  if (url.includes('/auth/push-token')) return { ok: true };
  if (url.includes('/driver/trips')) return { trips: [] };
  if (url.includes('/driver/earnings')) return { total: 0, trips: 0, history: [] };
  // Share ticket endpoints
  if (url.includes('/share/ticket/token') && method === 'post') {
    const bid   = body.bookingId ?? 'b1';
    const seat  = body.seatId ?? 'B3';
    const exp   = Math.floor(Date.now() / 1000) + 604800;
    const token = `bW9ja3BheWxvYWQ.${bid}${seat}${exp}`.replace(/[^a-zA-Z0-9._-]/g, 'x');
    const base  = (BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
    return {
      token,
      shareUrl: `${base}/api/share/ticket?t=${token}`,
      deepLink: `yallatransit://ticket/share?t=${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }
  if (url.includes('/share/ticket/verify') && method === 'post') {
    return { valid: true, bookingId: 'b1', seatId: 'B3', reason: null };
  }
  if (url.includes('/share/ticket') && method === 'get') {
    return { valid: true, bookingId: 'b1', seatId: 'B3', expiresAt: new Date(Date.now() + 604800000).toISOString() };
  }
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

// ── Named API helpers ─────────────────────────────────────────────────────────

export const fetchBusGps = (vehicleId) =>
  apiClient.get(`/gps/bus/${encodeURIComponent(vehicleId)}`).then((r) => r.data);

export const registerPushToken = (pushToken) =>
  apiClient.put('/auth/push-token', { token: pushToken }).then((r) => r.data);

export default apiClient;
