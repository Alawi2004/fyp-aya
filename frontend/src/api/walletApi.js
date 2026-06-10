import apiClient from './apiClient';

export const getWalletApi = () => apiClient.get('/wallet');
export const getWalletTransactionsApi = () => apiClient.get('/wallet/transactions');
export const getTopUpLocationsApi = () => apiClient.get('/wallet/locations');
