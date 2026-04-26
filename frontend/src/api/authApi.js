import apiClient from './apiClient';
export const loginApi = (data) => apiClient.post('/auth/login', data);
export const registerApi = (data) => apiClient.post('/auth/register', data);
export const forgotPasswordApi = (email) => apiClient.post('/auth/forgot-password', { email });
export const logoutApi = () => apiClient.post('/auth/logout');
export const getProfileApi = () => apiClient.get('/auth/me');
export const updateProfileApi = (data) => apiClient.put('/auth/profile', data);