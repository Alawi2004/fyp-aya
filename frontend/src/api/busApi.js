import apiClient from './apiClient';
export const getBusesApi = (params) => apiClient.get('/buses', { params });
export const getBusDetailsApi = (id) => apiClient.get(`/buses/${id}`);
export const getBusLocationApi = (id) => apiClient.get(`/buses/${id}/location`);
export const getBusRouteApi = (id) => apiClient.get(`/buses/${id}/route`);