import apiClient from './apiClient';
export const createBookingApi = (data) => apiClient.post('/bookings', data);
export const getBookingsApi = () => apiClient.get('/bookings');
export const getBookingByIdApi = (id) => apiClient.get(`/bookings/${id}`);
export const cancelBookingApi = (id) => apiClient.delete(`/bookings/${id}`);
export const verifyTicketApi = (qr) => apiClient.post('/bookings/verify', { qrCode: qr });