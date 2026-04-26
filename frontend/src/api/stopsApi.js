import apiClient from './apiClient';

export const getStopsApi = () => apiClient.get('/stops');
