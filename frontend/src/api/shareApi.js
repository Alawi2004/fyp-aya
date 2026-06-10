import apiClient from './apiClient';

// POST /api/share/ticket/token  — authenticated passenger issues a share token
export const issueShareTokenApi = (data) =>
  apiClient.post('/share/ticket/token', data);

// GET /api/share/ticket?t=TOKEN  — public; validates token + returns safe metadata
export const getSharedTicketApi = (token) =>
  apiClient.get('/share/ticket', { params: { t: token } });

// POST /api/share/ticket/verify  — driver/inspector validates a scanned share QR
export const verifyShareQrApi = (token) =>
  apiClient.post('/share/ticket/verify', { token });
