import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import apiClient from '../api/apiClient';
import { useApp } from '../context/AppContext';

export function useGpsTracking(tripId) {
  const subRef = useRef(null);
  const { gpsSettings } = useApp();
  const intervalMs = (gpsSettings?.updateIntervalSec ?? 10) * 1000;

  useEffect(() => {
    if (!tripId) {
      if (subRef.current) { subRef.current.remove(); subRef.current = null; }
      return;
    }

    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[GPS] Location permission denied');
        return;
      }
      if (!mounted) return;

      subRef.current = await Location.watchPositionAsync(
        {
          // BestForNavigation uses the GPS chip for true ~5m accuracy.
          // Balanced fell back to wifi/cell (~100m–1km off) which is why the
          // driver's pin showed the wrong place.
          accuracy:         Location.Accuracy.BestForNavigation,
          timeInterval:     intervalMs,
          distanceInterval: 0,          // fire on time alone — not requiring movement
        },
        ({ coords }) => {
          console.log('[GPS] sending trip_id:', tripId, coords.latitude, coords.longitude, '±', Math.round(coords.accuracy ?? 0), 'm');
          apiClient.post('/gps', {
            trip_id:   tripId,
            latitude:  coords.latitude,
            longitude: coords.longitude,
            speed:     coords.speed   ?? null,
            heading:   coords.heading ?? null,
          })
            .then(() => console.log('[GPS] saved ok'))
            .catch((err) => console.warn('[GPS] post failed', err?.response?.status, err?.response?.data, err?.message));
        },
      );
    })();

    return () => {
      mounted = false;
      if (subRef.current) { subRef.current.remove(); subRef.current = null; }
    };
  }, [tripId, intervalMs]);
}
