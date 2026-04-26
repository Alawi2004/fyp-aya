import apiClient from './apiClient';

export const getMultiTripRouteApi = ({ startId, endId, mode = 'fastest', alternatives = true }) =>
  apiClient.get('/routes/multi-trip', {
    params: {
      start_id: startId,
      end_id: endId,
      mode,
      alternatives,
    },
  });
