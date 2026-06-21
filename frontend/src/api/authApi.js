import apiClient from './apiClient';
export const loginApi = (data) => apiClient.post('/auth/login', data);
export const registerApi = (data) => apiClient.post('/auth/register', data);
export const forgotPasswordApi = (email) => apiClient.post('/auth/forgot-password', { email });
export const logoutApi = () => apiClient.post('/auth/logout');
export const getProfileApi = () => apiClient.get('/users/me').then(r => r.data);
export const updateProfileApi = (data) => apiClient.put('/users/me', data).then(r => r.data);
export const getMyRatingsApi = () => apiClient.get('/ratings/me').then(r => r.data);
export const sendOtpApi = (email, purpose) => apiClient.post('/auth/send-otp', { email, purpose });
export const verifyOtpApi = (email, code) => apiClient.post('/auth/verify-otp', { email, code });
export const resetPasswordOtpApi = (data) => apiClient.post('/auth/reset-password-otp', data);
export const uploadAvatarApi = (uri) => {
  const filename = uri.split('/').pop() || 'avatar.jpg';
  const ext = (/\.(\w+)$/.exec(filename)?.[1] || 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const form = new FormData();
  form.append('photo', { uri, name: filename, type });
  return apiClient.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};