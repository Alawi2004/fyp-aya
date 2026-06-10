import apiClient from './apiClient';

export const getMultiTripRouteApi = ({
  startId,
  endId,
  mode = 'fastest',
  alternatives = true,
  departureTime,
}) =>
  apiClient.get('/routes/multi-trip', {
    params: {
      start_id: startId,
      end_id: endId,
      mode,
      alternatives,
      ...(departureTime && { departure_time: departureTime }),
    },
  });
