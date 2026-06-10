import apiClient from './apiClient';

// GET /api/trips/:id/eta-predictions
// Returns stop-by-stop ETAs using OSRM road data + Beirut traffic model + historical GPS
export const getTripEtaPredictions = (tripId) =>
  apiClient.get(`/trips/${tripId}/eta-predictions`);

// GET /api/routes/traffic-forecast?day=&hour=&route_id=
export const getTrafficForecast = ({ day, hour, routeId } = {}) =>
  apiClient.get('/routes/traffic-forecast', {
    params: {
      ...(day !== undefined && { day }),
      ...(hour !== undefined && { hour }),
      ...(routeId !== undefined && { route_id: routeId }),
    },
  });
