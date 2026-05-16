import apiClient from './apiClient';

// Dashboard
export const getDashboardStats = () => apiClient.get('/dashboard/stats');
export const getDashboardOverview = () => apiClient.get('/dashboard/overview');

// Trips
export const getTrips              = ()         => apiClient.get('/trips');
export const getTripById           = (id)       => apiClient.get(`/trips/${id}`);
export const createTrip            = (data)     => apiClient.post('/trips', data);
export const updateTripStatus      = (id, status) => apiClient.put(`/trips/${id}/status`, { status });
export const getTripsByVehicleType = (type)     => apiClient.get(`/trips/vehicle/${type}`);
export const getPassengerLoad      = (id)       => apiClient.get(`/trips/${id}/load`);
export const getTripGpsLogs        = (id, date) => apiClient.get(`/gps/trip/${id}${date ? `?date=${date}` : ''}`);
export const getTripPassengerCounts = (id)      => apiClient.get(`/passenger-count/trip/${id}`);
export const getTripEtaPredictions  = (id)      => apiClient.get(`/trips/${id}/eta-predictions`);
export const getTimetableTrips      = (date)    => apiClient.get(`/trips/timetable?date=${date}`);
export const getRecurringSchedules  = ()        => apiClient.get('/trips/recurring');
export const createRecurringSchedule = (data)   => apiClient.post('/trips/recurring', data);
export const updateRecurringSchedule = (id, d)  => apiClient.put(`/trips/recurring/${id}`, d);
export const deleteRecurringSchedule = (id)     => apiClient.delete(`/trips/recurring/${id}`);

// Vehicles
export const getVehicles         = ()         => apiClient.get('/vehicles');
export const getVehicleById      = (id)       => apiClient.get(`/vehicles/${id}`);
export const createVehicle       = (data)     => apiClient.post('/vehicles', data);
export const updateVehicle       = (id, data) => apiClient.put(`/vehicles/${id}`, data);
export const getVehicleDocs      = ()         => apiClient.get('/vehicles/docs');
export const updateVehicleDocs   = (plate, d) => apiClient.put(`/vehicles/docs/${plate}`, d);
export const getMaintenanceLog       = ()         => apiClient.get('/vehicles/maintenance');
export const addMaintenanceRecord    = (data)     => apiClient.post('/vehicles/maintenance', data);
export const updateMaintenanceRecord = (id, d)    => apiClient.put(`/vehicles/maintenance/${id}`, d);
export const getFuelLog              = ()         => apiClient.get('/vehicles/fuel');
export const addFuelRecord           = (data)     => apiClient.post('/vehicles/fuel', data);
export const getVehicleFuelLog       = (id)       => apiClient.get(`/vehicles/${id}/fuel`);
export const getVehiclePhotos        = (id)       => apiClient.get(`/vehicles/${id}/photos`);
export const uploadVehiclePhoto      = (id, formData) => apiClient.post(`/vehicles/${id}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteVehiclePhotoApi   = (id, filename) => apiClient.delete(`/vehicles/${id}/photos/${filename}`);

// Drivers
export const getDrivers = () => apiClient.get('/drivers');
export const getDriverById = (id) => apiClient.get(`/drivers/${id}`);
export const createDriver = (data) => apiClient.post('/drivers', data);
export const updateDriver = (id, data) => apiClient.put(`/drivers/${id}`, data);
export const getDriverPerformance = () => apiClient.get('/drivers/performance');
export const getDriverSchedules = () => apiClient.get('/drivers/schedules');
export const updateDriverSchedule = (driverId, data) => apiClient.put(`/drivers/${driverId}/schedule`, data);

// Routes
export const getRoutes = () => apiClient.get('/routes');
export const getRouteById = (id) => apiClient.get(`/routes/${id}`);
export const createRoute = (data) => apiClient.post('/routes', data);
export const updateRoute = (id, data) => apiClient.put(`/routes/${id}`, data);

// Stops
export const getStops           = ()              => apiClient.get('/stops');
export const getRouteStops      = (routeId)       => apiClient.get(`/routes/${routeId}/stops`);
export const getStopAmenities   = (stopId)        => apiClient.get(`/stops/${stopId}/amenities`);
export const updateStopAmenities= (stopId, data)  => apiClient.put(`/stops/${stopId}/amenities`, data);
export const getStopQR          = (stopId)        => apiClient.get(`/stops/${stopId}/qr`);
export const checkRouteOverlap  = (routeId)       => apiClient.get(`/routes/${routeId}/overlap`);
export const updateStopPosition = (stopId, data) => apiClient.put(`/routes/stops/${stopId}/position`, data);

// Waypoints
export const getWaypoints     = (routeId)     => apiClient.get(`/routes/${routeId}/waypoints`);
export const saveWaypoints    = (routeId, wps) => apiClient.post(`/routes/${routeId}/waypoints`, { waypoints: wps });

// Fare zones
export const getFareZones     = (routeId)              => apiClient.get(`/routes/${routeId}/fare-zones`);
export const createFareZone   = (routeId, data)        => apiClient.post(`/routes/${routeId}/fare-zones`, data);
export const updateFareZone   = (routeId, zoneId, data) => apiClient.put(`/routes/${routeId}/fare-zones/${zoneId}`, data);
export const deleteFareZone   = (routeId, zoneId)      => apiClient.delete(`/routes/${routeId}/fare-zones/${zoneId}`);
export const assignStopToZone = (routeId, zoneId, stopId) => apiClient.post(`/routes/${routeId}/fare-zones/${zoneId}/stops`, { stop_id: stopId });
export const removeStopFromZone = (routeId, zoneId, stopId) => apiClient.delete(`/routes/${routeId}/fare-zones/${zoneId}/stops/${stopId}`);

// Tickets
export const getTickets = () => apiClient.get('/tickets');
export const getTicketsByTrip = (tripId) => apiClient.get(`/tickets/trip/${tripId}`);
export const bookTicket = (data) => apiClient.post('/tickets', data);

// Ratings
export const getRatings = () => apiClient.get('/ratings');
export const getRatingsByTrip = (tripId) => apiClient.get(`/ratings/trip/${tripId}`);
export const createRating = (data) => apiClient.post('/ratings', data);


// Users
export const getUsers = () => apiClient.get('/users');
export const getUserById = (id) => apiClient.get(`/users/${id}`);
export const getUserTickets = (id) => apiClient.get(`/users/${id}/tickets`);
export const getUserNotifications = (id) => apiClient.get(`/users/${id}/notifications`);

// Passengers
export const getPassengers       = ()           => apiClient.get('/users/passengers/list');
export const suspendUser         = (id, data)   => apiClient.post(`/users/${id}/suspend`, data);
export const restoreUser         = (id, data)   => apiClient.post(`/users/${id}/restore`, data);
export const getSuspensionLogs   = (id)         => apiClient.get(`/users/${id}/suspension-logs`);

// System settings
export const getSystemSettings    = (cat)    => apiClient.get(cat ? `/settings?category=${cat}` : "/settings");
export const updateSystemSettings = (data)   => apiClient.put("/settings", data);
export const getSystemSetting     = (key)    => apiClient.get(`/settings/${key}`);

// Analytics reports
export const getRevenueReport          = (from, to) => apiClient.get(`/reports/revenue${from ? `?from=${from}&to=${to}` : ''}`);
export const getPassengerUsageReport   = (from, to) => apiClient.get(`/reports/passenger-usage${from ? `?from=${from}&to=${to}` : ''}`);
export const getDriverPerfReport       = (from, to) => apiClient.get(`/reports/driver-performance${from ? `?from=${from}&to=${to}` : ''}`);
export const getVehicleUtilReport      = (from, to) => apiClient.get(`/reports/vehicle-utilization${from ? `?from=${from}&to=${to}` : ''}`);
export const getTopRoutesReport        = (from, to) => apiClient.get(`/reports/top-routes${from ? `?from=${from}&to=${to}` : ''}`);

// Scheduled reports
export const getScheduledReports    = ()         => apiClient.get('/reports/scheduled');
export const createScheduledReport  = (data)     => apiClient.post('/reports/scheduled', data);
export const updateScheduledReport  = (id, data) => apiClient.put(`/reports/scheduled/${id}`, data);
export const deleteScheduledReport  = (id)       => apiClient.delete(`/reports/scheduled/${id}`);
export const sendScheduledReportNow = (id)       => apiClient.post(`/reports/scheduled/${id}/send-now`, {});

// Audit log
export const getAuditLogs = (params = {}) => apiClient.get(`/audit-logs?${new URLSearchParams(params)}`);

// Wallet admin adjustments
export const adminAdjustWallet   = (data)       => apiClient.post('/wallet/adjust', data);
export const getAdjustmentHistory = (limit = 100) => apiClient.get(`/wallet/adjustments?limit=${limit}`);

// Notifications
export const getNotifications           = ()       => apiClient.get('/notifications');
export const getUserNotifications_v2    = (id)     => apiClient.get(`/notifications/user/${id}`);
export const markNotificationAsRead     = (id)     => apiClient.put(`/notifications/${id}/read`, {});
export const createNotification         = (data)   => apiClient.post('/notifications', data);
export const getNotificationTemplates   = ()       => apiClient.get('/notifications/templates');
export const createTemplate             = (data)   => apiClient.post('/notifications/templates', data);
export const updateTemplate             = (id, d)  => apiClient.put(`/notifications/templates/${id}`, d);
export const deleteTemplate             = (id)     => apiClient.delete(`/notifications/templates/${id}`);
export const getScheduledNotifications  = ()       => apiClient.get('/notifications/scheduled');
export const scheduleNotification       = (data)   => apiClient.post('/notifications/schedule', data);
export const cancelScheduled            = (id)     => apiClient.delete(`/notifications/scheduled/${id}`);

// Trip conflicts (server-side detection)
export const getTripConflicts = () => apiClient.get('/trips/conflicts');

// Trip delays (admin delay management)
export const getTripDelays = () => apiClient.get('/trips/delays');

// Pre-trip checklists (admin compliance audit)
export const getTripChecklists = () => apiClient.get('/trips/checklists');

// Stop arrivals for a specific trip
export const getTripStopArrivals = (tripId) => apiClient.get(`/trips/${tripId}/arrivals`);

// Emergency alerts (admin view of driver-submitted emergencies)
export const getEmergencyAlerts = () => apiClient.get('/dashboard/emergency-alerts');

// Driver-reported issues inbox
export const getAdminIssues = () => apiClient.get('/dashboard/issues');

// Roles & permissions CRUD
export const getRoles                = ()           => apiClient.get('/roles');
export const createRole              = (data)       => apiClient.post('/roles', data);
export const deleteRole              = (id)         => apiClient.delete(`/roles/${id}`);
export const updateRolePermissions   = (id, perms)  => apiClient.put(`/roles/${id}/permissions`, { permissions: perms });
export const refreshPermissionCache  = ()           => apiClient.post('/roles/cache/refresh', {});

// Analytics
export const getPassengerHeatmap = (from, to) => apiClient.get(`/analytics/passenger-heatmap${from ? `?from=${from}&to=${to}` : ''}`);
export const getGpsHeatmap       = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiClient.get(`/analytics/gps-heatmap${q ? `?${q}` : ''}`);
};

// GPS
export const recordGpsLog = (data) => apiClient.post('/gps/log', data);
export const getTripGpsLogs_v2 = (tripId) => apiClient.get(`/gps/trip/${tripId}`);
export const getLiveGps = () => apiClient.get('/gps/live');
export const getGeofenceAlerts = (status) => apiClient.get(`/gps/geofence-alerts${status ? `?status=${status}` : ''}`);

// Passenger Count
export const recordPassengerCount = (data) => apiClient.post('/passenger-count/record', data);
export const getTripPassengerCounts_v2 = (tripId) => apiClient.get(`/passenger-count/trip/${tripId}`);

// Staff Management
export const getStaffAccounts         = ()         => apiClient.get('/staff/accounts');
export const updateStaffAccount       = (id, data) => apiClient.put(`/staff/accounts/${id}`, data);
export const getStaffTransactions     = ()         => apiClient.get('/staff/wallet/all-history');
export const getSuspiciousTransactions = ()        => apiClient.get('/staff/wallet/suspicious');
export const getReconciliation        = (date)     => apiClient.get(`/staff/reconciliation?date=${date}`);
export const submitReconciliation     = (id, data) => apiClient.put(`/staff/reconciliation/${id}`, data);

// Wallet Freeze
export const getWalletStatuses  = ()         => apiClient.get('/wallet/statuses');
export const freezeWallet       = (id, data) => apiClient.post(`/wallet/${id}/freeze`, data);
export const unfreezeWallet     = (id, data) => apiClient.post(`/wallet/${id}/unfreeze`, data);
export const getFreezeLog       = ()         => apiClient.get('/wallet/freeze-log');

// Complaints
export const getComplaints      = ()         => apiClient.get('/complaints');
export const createComplaint    = (data)     => apiClient.post('/complaints', data);
export const updateComplaint    = (id, data) => apiClient.put(`/complaints/${id}`, data);
export const addComplaintComment = (id, data) => apiClient.post(`/complaints/${id}/comments`, data);
