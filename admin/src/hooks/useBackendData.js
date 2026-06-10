// src/hooks/useBackendData.js
// Custom hook for fetching data from the backend API
import { useState, useEffect, useCallback } from 'react';
import * as endpoints from '../api/endpoints';

export function useBackendData(fetchFunction, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

// Specific hooks for common data fetches
export function useTrips() {
  return useBackendData(endpoints.getTrips);
}

export function useVehicles() {
  return useBackendData(endpoints.getVehicles);
}

export function useDrivers() {
  return useBackendData(endpoints.getDrivers);
}

export function useRoutes() {
  return useBackendData(endpoints.getRoutes);
}

export function useDashboardStats() {
  return useBackendData(endpoints.getDashboardStats);
}

export function useTripDetails(tripId) {
  return useBackendData(
    () => tripId && endpoints.getTripById(tripId),
    [tripId]
  );
}
