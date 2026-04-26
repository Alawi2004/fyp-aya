import apiClient from './apiClient';
export const getDriverTripsApi = () => apiClient.get('/driver/trips');
export const startTripApi = (id) => apiClient.put(`/driver/trips/${id}/start`);
export const completeTripApi = (id) => apiClient.put(`/driver/trips/${id}/complete`);
export const getPassengerListApi = (tripId) => apiClient.get(`/driver/trips/${tripId}/passengers`);
export const getEarningsApi = () => apiClient.get('/driver/earnings');
export const reportIssueApi = (data) => apiClient.post('/driver/issues', data);
export const sendEmergencyApi = (data) => apiClient.post('/driver/emergency', data);
export const updateLocationApi = (data) => apiClient.post('/driver/location', data);