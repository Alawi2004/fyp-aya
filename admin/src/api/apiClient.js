// Admin API Client
// Frontend-only by default while the UI is being designed.
// Set VITE_FRONTEND_ONLY=false later to reconnect to the backend.
import {
  MOCK_COMPLAINTS,
  MOCK_DASHBOARD_STATS,
  MOCK_FREEZE_LOG,
  MOCK_FUEL_LOG,
  MOCK_MAINTENANCE_LOG,
  MOCK_VEHICLE_DOCS,
  MOCK_WALLET_STATUS,
  MOCK_DRIVERS,
  MOCK_NOTIFICATIONS,
  MOCK_NOTIFICATION_TEMPLATES,
  MOCK_PERFORMANCE,
  MOCK_RATINGS,
  MOCK_RECONCILIATION,
  MOCK_RECURRING_SCHEDULES,
  MOCK_ROUTES,
  MOCK_SCHEDULES,
  MOCK_SCHEDULED_NOTIFICATIONS,
  MOCK_STAFF,
  MOCK_STAFF_TRANSACTIONS,
  MOCK_TICKETS,
  MOCK_TIMETABLE_TRIPS,
  MOCK_TRIPS,
  MOCK_USERS,
  MOCK_VEHICLES,
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const FRONTEND_ONLY = import.meta.env.VITE_FRONTEND_ONLY !== 'false';

// Conflict objects match the shape produced by detectConflicts(): { type, resource, a, b }
const MOCK_TRIP_CONFLICTS = [
  {
    type: "driver", resource: "Karim Moussa",
    a: { id: "TRP-041",  route: "Route 12A", driver: "Karim Moussa",   vehicle: "BUS-01", date: "2025-04-14", time: "08:00", status: "Ongoing"   },
    b: { id: "TRP-X01",  route: "Route 9E",  driver: "Karim Moussa",   vehicle: "BUS-06", date: "2025-04-14", time: "08:30", status: "Scheduled" },
  },
  {
    type: "vehicle", resource: "BUS-07",
    a: { id: "TRP-047",  route: "Route 3C",  driver: "Sara Khoury",    vehicle: "BUS-07", date: "2025-04-14", time: "09:15", status: "Delayed"   },
    b: { id: "TRP-X02",  route: "Route 5D",  driver: "Nadia Haddad",   vehicle: "BUS-07", date: "2025-04-14", time: "09:00", status: "Scheduled" },
  },
];

const mockAdminResponse = (method, endpoint, data = {}) => {
  if (endpoint.includes('/dashboard/stats')) return MOCK_DASHBOARD_STATS;
  if (endpoint.includes('/dashboard/overview')) {
    return {
      stats: MOCK_DASHBOARD_STATS,
      trips: MOCK_TRIPS.slice(0, 5),
      notifications: MOCK_NOTIFICATIONS.slice(0, 5),
    };
  }
  if (endpoint.startsWith('/trips/recurring'))  return MOCK_RECURRING_SCHEDULES;
  if (endpoint.startsWith('/trips/timetable'))  return MOCK_TIMETABLE_TRIPS;
  if (endpoint.startsWith('/trips/conflicts'))  return MOCK_TRIP_CONFLICTS;
  if (endpoint.startsWith('/trips')) return endpoint.includes('/load') ? { current_passengers: 24, capacity: 40 } : MOCK_TRIPS;
  if (endpoint.startsWith('/vehicles/docs'))        return MOCK_VEHICLE_DOCS;
  if (endpoint.startsWith('/vehicles/maintenance')) return MOCK_MAINTENANCE_LOG;
  if (endpoint.startsWith('/vehicles/fuel'))        return MOCK_FUEL_LOG;
  if (endpoint.startsWith('/vehicles')) return MOCK_VEHICLES;
  if (endpoint.startsWith('/drivers/performance')) return MOCK_PERFORMANCE;
  if (endpoint.startsWith('/drivers/schedules'))   return MOCK_SCHEDULES;
  if (endpoint.startsWith('/drivers')) return MOCK_DRIVERS;
  if (endpoint.startsWith('/staff/wallet/suspicious'))  return MOCK_STAFF_TRANSACTIONS.filter(t => t.flags.length > 0);
  if (endpoint.startsWith('/staff/wallet/all-history')) return MOCK_STAFF_TRANSACTIONS;
  if (endpoint.startsWith('/staff/reconciliation'))     return MOCK_RECONCILIATION;
  if (endpoint.startsWith('/staff/accounts'))           return MOCK_STAFF;
  if (endpoint.startsWith('/staff'))                    return MOCK_STAFF;
  if (endpoint.startsWith('/wallet/statuses'))   return MOCK_WALLET_STATUS;
  if (endpoint.startsWith('/wallet/freeze-log')) return MOCK_FREEZE_LOG;
  if (endpoint.startsWith('/complaints'))        return MOCK_COMPLAINTS;
  if (endpoint.match(/\/routes\/\d+\/waypoints$/))   return method === 'GET' ? [] : { message: "Waypoints saved", count: 0 };
  if (endpoint.match(/\/routes\/\d+\/fare-zones$/))  return method === 'GET' ? [] : { zone_id: Date.now(), ...data, stops: [] };
  if (endpoint.match(/\/routes\/\d+\/fare-zones\//)) return { message: "ok" };
  if (endpoint.match(/\/routes\/stops\/\d+\/position/)) return { message: "Position updated" };
  if (endpoint.match(/\/routes\/\d+\/overlap$/)) {
    const id = parseInt(endpoint.match(/\/routes\/(\d+)\//)?.[1]);
    return id === 1
      ? [{ route_id: 2, route_name: 'Route 7B', start_location: 'Beirut (Hamra)', end_location: 'Byblos', shared_stops: 3 }]
      : [];
  }
  if (endpoint.startsWith('/routes')) return MOCK_ROUTES;
  if (endpoint.match(/\/stops\/\d+\/amenities$/)) return method === 'GET'
    ? { has_shelter: true, has_seating: true, has_lighting: false, has_wheelchair: false, has_ticket_machine: false, has_wifi: false, nearby_landmark: null, nfc_tag_id: null }
    : { message: "Amenities updated" };
  if (endpoint.match(/\/stops\/\d+\/qr$/)) return { qr_code: null, data: `stop-${endpoint.match(/\d+/)?.[0]}` };
  if (endpoint.startsWith('/stops')) return [
    { stop_id: 11, stop_name: 'Chtaura', latitude: 33.81, longitude: 35.85 },
    { stop_id: 48, stop_name: 'Adliyeh Roundabout', latitude: 33.88, longitude: 35.51 },
    { stop_id: 71, stop_name: 'Hamra', latitude: 33.895, longitude: 35.482 },
  ];
  if (endpoint.startsWith('/tickets') || endpoint.startsWith('/bookings')) return MOCK_TICKETS;
  if (endpoint.startsWith('/ratings')) return MOCK_RATINGS;
  if (endpoint.startsWith('/users/passengers')) return [];  // PassengersPage uses its own mock
  if (endpoint.match(/\/users\/\d+\/suspend/))   return { message: "User suspended", new_status: "suspended" };
  if (endpoint.match(/\/users\/\d+\/restore/))   return { message: "User restored",  new_status: "active"    };
  if (endpoint.match(/\/users\/\d+\/suspension-logs/)) return [];
  if (endpoint.startsWith('/wallet/adjust'))      return { message: "Wallet adjusted", balance_after: 50 };
  if (endpoint.startsWith('/wallet/adjustments')) return [];
  if (endpoint.startsWith('/users')) return MOCK_USERS;
  if (endpoint.startsWith('/notifications/templates')) return MOCK_NOTIFICATION_TEMPLATES;
  if (endpoint.startsWith('/notifications/scheduled'))  return MOCK_SCHEDULED_NOTIFICATIONS;
  if (endpoint.startsWith('/notifications')) return MOCK_NOTIFICATIONS;
  if (endpoint.startsWith('/gps')) return [];
  if (endpoint.startsWith('/passenger-count')) return [];
  if (endpoint.startsWith('/wallet/recharges')) return [];
  if (endpoint.startsWith('/wallet')) return { balance: 35.5, transactions: [] };
  if (endpoint.startsWith('/settings'))          return method === 'GET' ? { flat: {}, categorised: {}, rows: [] } : { message: "Settings updated", count: 0 };
  if (endpoint.startsWith('/audit-logs'))        return { total: 20, page: 1, limit: 10, data: [] };
  if (endpoint.startsWith('/reports/scheduled') && !endpoint.includes('/send-now')) return method === 'GET' ? [] : { schedule_id: Date.now(), message: "ok" };
  if (endpoint.includes('/send-now'))             return { message: "Report sent" };
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
