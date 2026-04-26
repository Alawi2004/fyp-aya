// Admin API Client
// Frontend-only by default while the UI is being designed.
// Set VITE_FRONTEND_ONLY=false later to reconnect to the backend.
import {
  MOCK_DASHBOARD_STATS,
  MOCK_DRIVERS,
  MOCK_NOTIFICATIONS,
  MOCK_RATINGS,
  MOCK_ROUTES,
  MOCK_TICKETS,
  MOCK_TRIPS,
  MOCK_USERS,
  MOCK_VEHICLES,
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const FRONTEND_ONLY = import.meta.env.VITE_FRONTEND_ONLY !== 'false';

const mockAdminResponse = (method, endpoint, data = {}) => {
  if (endpoint.includes('/dashboard/stats')) return MOCK_DASHBOARD_STATS;
  if (endpoint.includes('/dashboard/overview')) {
    return {
      stats: MOCK_DASHBOARD_STATS,
      trips: MOCK_TRIPS.slice(0, 5),
      notifications: MOCK_NOTIFICATIONS.slice(0, 5),
    };
  }
  if (endpoint.startsWith('/trips')) return endpoint.includes('/load') ? { current_passengers: 24, capacity: 40 } : MOCK_TRIPS;
  if (endpoint.startsWith('/vehicles')) return MOCK_VEHICLES;
  if (endpoint.startsWith('/drivers')) return MOCK_DRIVERS;
  if (endpoint.startsWith('/routes')) return MOCK_ROUTES;
  if (endpoint.startsWith('/stops')) return [
    { stop_id: 11, stop_name: 'Chtaura', latitude: 33.81, longitude: 35.85 },
    { stop_id: 48, stop_name: 'Adliyeh Roundabout', latitude: 33.88, longitude: 35.51 },
    { stop_id: 71, stop_name: 'Hamra', latitude: 33.895, longitude: 35.482 },
  ];
  if (endpoint.startsWith('/tickets') || endpoint.startsWith('/bookings')) return MOCK_TICKETS;
  if (endpoint.startsWith('/ratings')) return MOCK_RATINGS;
  if (endpoint.startsWith('/users')) return MOCK_USERS;
  if (endpoint.startsWith('/notifications')) return MOCK_NOTIFICATIONS;
  if (endpoint.startsWith('/gps')) return [];
  if (endpoint.startsWith('/passenger-count')) return [];
  if (endpoint.startsWith('/wallet/recharges')) return [];
  if (endpoint.startsWith('/wallet')) return { balance: 35.5, transactions: [] };
  if (endpoint.startsWith('/auth/register')) return { user: { id: Date.now(), ...data }, token: 'mock-admin-token' };
  return method === 'GET' ? [] : { ok: true, id: Date.now(), ...data };
};

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error ${response.status}: ${error}`);
    }
    return response.json();
  }

  async get(endpoint) {
    if (FRONTEND_ONLY) return mockAdminResponse('GET', endpoint);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    if (FRONTEND_ONLY) return mockAdminResponse('POST', endpoint, data);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async put(endpoint, data) {
    if (FRONTEND_ONLY) return mockAdminResponse('PUT', endpoint, data);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    if (FRONTEND_ONLY) return { ok: true };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });
    return this.handleResponse(response);
  }

  getToken() {
    return localStorage.getItem('authToken') || '';
  }

  setToken(token) {
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    localStorage.removeItem('authToken');
  }
}

export default new ApiClient(API_BASE_URL);
