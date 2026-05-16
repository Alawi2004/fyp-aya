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

// Pre-trip checklist submissions (trip_checklists + joins)
const MOCK_CHECKLISTS = [
  { checklist_id: 1, trip_id: 41, trip_ref: "TRP-041", driver: "Karim Moussa",   vehicle: "BUS-01", route: "Route 12A", fuel_ok: 1, lights_ok: 1, tires_ok: 1, submitted_at: "2026-05-16T05:45:00" },
  { checklist_id: 2, trip_id: 38, trip_ref: "TRP-038", driver: "Sara Khoury",    vehicle: "BUS-07", route: "Route 7B",  fuel_ok: 1, lights_ok: 0, tires_ok: 1, submitted_at: "2026-05-16T06:10:00" },
  { checklist_id: 3, trip_id: 29, trip_ref: "TRP-029", driver: "Joe Pharaon",    vehicle: "BUS-09", route: "Route 3C",  fuel_ok: 0, lights_ok: 1, tires_ok: 0, submitted_at: "2026-05-16T06:30:00" },
  { checklist_id: 4, trip_id: 33, trip_ref: "TRP-033", driver: "Maya Salameh",   vehicle: "BUS-02", route: "Route 5D",  fuel_ok: 1, lights_ok: 1, tires_ok: 1, submitted_at: "2026-05-15T06:20:00" },
  { checklist_id: 5, trip_id: 45, trip_ref: "TRP-045", driver: "Lara Abi Nader", vehicle: "BUS-05", route: "Route 9E",  fuel_ok: 1, lights_ok: 1, tires_ok: 1, submitted_at: "2026-05-15T07:00:00" },
  { checklist_id: 6, trip_id: 50, trip_ref: "TRP-050", driver: "Karim Moussa",   vehicle: "BUS-01", route: "Route 12A", fuel_ok: 1, lights_ok: 1, tires_ok: 0, submitted_at: "2026-05-14T05:50:00" },
];

// Per-trip stop arrival data (trip_stop_arrivals + stops)
const MOCK_STOP_ARRIVALS = [
  { id: 1, stop_id: 71, stop_name: "Hamra Station",          stop_order: 1, scheduled_arrival_at: "2026-05-15T08:00:00", actual_arrival_at: "2026-05-15T08:02:00", delay_seconds:  120, arrival_status: "on_time" },
  { id: 2, stop_id: 48, stop_name: "Adliyeh Roundabout",     stop_order: 2, scheduled_arrival_at: "2026-05-15T08:15:00", actual_arrival_at: "2026-05-15T08:19:00", delay_seconds:  240, arrival_status: "late"    },
  { id: 3, stop_id: 11, stop_name: "Chtaura Junction",       stop_order: 3, scheduled_arrival_at: "2026-05-15T08:35:00", actual_arrival_at: "2026-05-15T08:35:00", delay_seconds:    0, arrival_status: "on_time" },
  { id: 4, stop_id: 22, stop_name: "Airport Road Terminal",  stop_order: 4, scheduled_arrival_at: "2026-05-15T08:55:00", actual_arrival_at: null,                   delay_seconds: null, arrival_status: "pending" },
];

// Driver-reported issues (issues table, non-emergency)
const MOCK_ISSUES = [
  { issue_id: 1, driver_id: 2, driver_name: "Sara Khoury",    vehicle: "BUS-07", trip_ref: "TRP-038", description: "Brake pedal feels soft, needs inspection",      category: "Mechanical",         priority: "high",   status: "open",        created_at: "2026-05-16T09:15:00" },
  { issue_id: 2, driver_id: 3, driver_name: "Joe Pharaon",    vehicle: "BUS-09", trip_ref: "TRP-029", description: "AC not working, passengers complaining",         category: "Mechanical",         priority: "medium", status: "in_progress", created_at: "2026-05-16T10:30:00" },
  { issue_id: 3, driver_id: 1, driver_name: "Karim Moussa",   vehicle: "BUS-01", trip_ref: "TRP-041", description: "Passenger argument — intervention required",     category: "Passenger Incident", priority: "high",   status: "open",        created_at: "2026-05-15T14:00:00" },
  { issue_id: 4, driver_id: 4, driver_name: "Maya Salameh",   vehicle: "BUS-02", trip_ref: "TRP-033", description: "Road blockage — had to reroute via Highway 1",  category: "Road Obstruction",   priority: "low",    status: "resolved",    created_at: "2026-05-15T11:20:00" },
  { issue_id: 5, driver_id: 5, driver_name: "Lara Abi Nader", vehicle: "BUS-05", trip_ref: null,      description: "Windscreen wiper broken, cannot drive in rain",  category: "Mechanical",         priority: "high",   status: "open",        created_at: "2026-05-14T08:45:00" },
  { issue_id: 6, driver_id: 3, driver_name: "Joe Pharaon",    vehicle: "BUS-09", trip_ref: "TRP-029", description: "Suspicious package found under rear seat",      category: "Security",           priority: "high",   status: "resolved",    created_at: "2026-05-13T16:30:00" },
];

// Delay reports (trip_delays table joined with trip/route/driver/vehicle)
const MOCK_TRIP_DELAYS = [
  { delay_id: 1, trip_id: 41, trip_ref: "TRP-041", route: "Route 12A", driver: "Karim Moussa",   vehicle: "BUS-01", reason: "Traffic",            delay_minutes: 15, notes: "Heavy traffic near downtown intersection",          reported_at: "2026-05-15T08:22:00", affected_passengers: 24 },
  { delay_id: 2, trip_id: 38, trip_ref: "TRP-038", route: "Route 7B",  driver: "Sara Khoury",    vehicle: "BUS-07", reason: "Road Block",          delay_minutes: 30, notes: "Police checkpoint at Jounieh highway",              reported_at: "2026-05-15T09:45:00", affected_passengers: 18 },
  { delay_id: 3, trip_id: 29, trip_ref: "TRP-029", route: "Route 3C",  driver: "Joe Pharaon",    vehicle: "BUS-09", reason: "Mechanical",          delay_minutes: 45, notes: "Engine warning light — waiting for inspection",     reported_at: "2026-05-15T10:10:00", affected_passengers: 30 },
  { delay_id: 4, trip_id: 33, trip_ref: "TRP-033", route: "Route 5D",  driver: "Maya Salameh",   vehicle: "BUS-02", reason: "Passenger Incident",  delay_minutes: 10, notes: "Medical situation onboard, waiting for paramedics", reported_at: "2026-05-14T14:30:00", affected_passengers: 11 },
  { delay_id: 5, trip_id: 45, trip_ref: "TRP-045", route: "Route 9E",  driver: "Lara Abi Nader", vehicle: "BUS-05", reason: "Traffic",             delay_minutes: 20, notes: null,                                               reported_at: "2026-05-14T16:55:00", affected_passengers: 22 },
];

// Emergency alerts (issues table filtered by EMERGENCY: prefix)
const MOCK_EMERGENCY_ALERTS = [
  { id: 1, driver_id: 1, driver_name: "Karim Moussa",   vehicle: "BUS-01", trip_ref: "TRP-041", message: "Passenger collapse on board",           latitude: 33.8938, longitude: 35.5018, status: "active",   created_at: "2026-05-15T13:58:00" },
  { id: 2, driver_id: 3, driver_name: "Joe Pharaon",    vehicle: "BUS-09", trip_ref: "TRP-029", message: "Vehicle collision — minor fender bender",latitude: 33.9800, longitude: 35.5500, status: "resolved", created_at: "2026-05-14T09:30:00" },
  { id: 3, driver_id: 4, driver_name: "Maya Salameh",   vehicle: "BUS-02", trip_ref: null,      message: "Engine overheating warning",             latitude: 33.8700, longitude: 35.5100, status: "active",   created_at: "2026-05-15T11:22:00" },
];

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
  if (endpoint.startsWith('/trips/delays'))      return MOCK_TRIP_DELAYS;
  if (endpoint.startsWith('/trips/checklists')) return MOCK_CHECKLISTS;
  if (endpoint.match(/\/trips\/\w+\/arrivals/)) return MOCK_STOP_ARRIVALS;
  if (endpoint.startsWith('/trips')) return endpoint.includes('/load') ? { current_passengers: 24, capacity: 40 } : MOCK_TRIPS;
  if (endpoint.startsWith('/dashboard/emergency-alerts')) return MOCK_EMERGENCY_ALERTS;
  if (endpoint.startsWith('/dashboard/issues'))           return MOCK_ISSUES;
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
  if (endpoint.startsWith('/gps/geofence-alerts')) return [
    { event_id: 1, trip_ref: 'TRP-047', vehicle: 'BUS-07', route: 'Route 3C', lat: 33.9100, lng: 35.6200, distance_m: 820, status: 'active',   detected_at: new Date(Date.now() - 3 * 60000).toISOString(), resolved_at: null },
    { event_id: 2, trip_ref: 'TRP-033', vehicle: 'BUS-02', route: 'Route 5D', lat: 33.8500, lng: 35.4700, distance_m: 620, status: 'resolved', detected_at: new Date(Date.now() - 30 * 60000).toISOString(), resolved_at: new Date(Date.now() - 20 * 60000).toISOString() },
  ];
  if (endpoint.startsWith('/gps/live')) {
    // Slowly-drifting mock positions so the demo map animates on 5s polls
    const t = Date.now() / 10000;
    return [
      { trip_ref: 'TRP-041', lat: 33.9280 + Math.sin(t)       * 0.0015, lng: 35.5340 + Math.cos(t)       * 0.001  },
      { trip_ref: 'TRP-029', lat: 33.8700 + Math.sin(t + 1)   * 0.001,  lng: 35.6200 + Math.cos(t + 1)   * 0.0015 },
      { trip_ref: 'TRP-045', lat: 34.1208 + Math.sin(t + 2)   * 0.0015, lng: 35.6484 + Math.cos(t + 2)   * 0.001  },
    ];
  }
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    if (FRONTEND_ONLY) return mockAdminResponse('POST', endpoint, data);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async put(endpoint, data) {
    if (FRONTEND_ONLY) return mockAdminResponse('PUT', endpoint, data);

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    if (FRONTEND_ONLY) return { ok: true };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return this.handleResponse(response);
  }
}

export default new ApiClient(API_BASE_URL);
