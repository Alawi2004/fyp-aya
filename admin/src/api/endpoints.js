import apiClient from './apiClient';

// Dashboard
export const getDashboardStats = () => apiClient.get('/dashboard/stats');
export const getDashboardOverview = () => apiClient.get('/dashboard/overview');

// Trips
export const getTrips = () => apiClient.get('/trips');
export const getTripById = (id) => apiClient.get(`/trips/${id}`);
export const createTrip = (data) => apiClient.post('/trips', data);
export const updateTripStatus = (id, status) => apiClient.put(`/trips/${id}/status`, { status });
export const getTripsByVehicleType = (type) => apiClient.get(`/trips/vehicle/${type}`);
export const getPassengerLoad = (id) => apiClient.get(`/trips/${id}/load`);
export const getTripGpsLogs = (id) => apiClient.get(`/gps/trip/${id}`);
export const getTripPassengerCounts = (id) => apiClient.get(`/passenger-count/trip/${id}`);
export const getTripEtaPredictions = (id) => apiClient.get(`/trips/${id}/eta-predictions`);

// Vehicles
export const getVehicles = () => apiClient.get('/vehicles');
export const getVehicleById = (id) => apiClient.get(`/vehicles/${id}`);
export const createVehicle = (data) => apiClient.post('/vehicles', data);
export const updateVehicle = (id, data) => apiClient.put(`/vehicles/${id}`, data);

// Drivers
export const getDrivers = () => apiClient.get('/drivers');
export const getDriverById = (id) => apiClient.get(`/drivers/${id}`);
export const createDriver = (data) => apiClient.post('/drivers', data);
export const updateDriver = (id, data) => apiClient.put(`/drivers/${id}`, data);

// Routes
export const getRoutes = () => apiClient.get('/routes');
export const getRouteById = (id) => apiClient.get(`/routes/${id}`);
export const createRoute = (data) => apiClient.post('/routes', data);
export const updateRoute = (id, data) => apiClient.put(`/routes/${id}`, data);

// Stops
export const getStops = () => apiClient.get('/stops');
export const getRouteStops = (routeId) => apiClient.get(`/routes/${routeId}/stops`);

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

// Notifications
export const getNotifications = () => apiClient.get('/notifications');
export const getUserNotifications_v2 = (id) => apiClient.get(`/notifications/user/${id}`);
export const markNotificationAsRead = (id) => apiClient.put(`/notifications/${id}/read`, {});
export const createNotification = (data) => apiClient.post('/notifications', data);

// GPS
export const recordGpsLog = (data) => apiClient.post('/gps/log', data);
export const getTripGpsLogs_v2 = (tripId) => apiClient.get(`/gps/trip/${tripId}`);

// Passenger Count
export const recordPassengerCount = (data) => apiClient.post('/passenger-count/record', data);
export const getTripPassengerCounts_v2 = (tripId) => apiClient.get(`/passenger-count/trip/${tripId}`);
