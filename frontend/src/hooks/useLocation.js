import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateLocationApi } from '../api/driverApi';

const BUFFER_KEY = 'gps_offline_buffer';
const INTERVAL_MS = 10000;

export const useLocation = ({ tripId, broadcasting, onLocationUpdate }) => {
  const intervalRef  = useRef(null);
  const flushingRef  = useRef(false);

  const flushBuffer = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const raw = await AsyncStorage.getItem(BUFFER_KEY);
      if (!raw) return;
      const buffer = JSON.parse(raw);
      if (!buffer.length) return;
      const remaining = [];
      for (const point of buffer) {
        try {
          await updateLocationApi(point);
        } catch {
          remaining.push(point);
        }
      }
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(remaining));
    } finally {
      flushingRef.current = false;
    }
  }, []);

  const postLocation = useCallback(async (latitude, longitude) => {
    const point = { trip_id: tripId, latitude, longitude };
    try {
      await updateLocationApi(point);
      flushBuffer();
    } catch {
      // Network unavailable — buffer the point for later
      try {
        const raw = await AsyncStorage.getItem(BUFFER_KEY);
        const buffer = raw ? JSON.parse(raw) : [];
        buffer.push(point);
        await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
      } catch {}
    }
  }, [tripId, flushBuffer]);

  useEffect(() => {
    if (!broadcasting || !tripId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      if (onLocationUpdate) onLocationUpdate({ latitude, longitude });
      await postLocation(latitude, longitude);

      intervalRef.current = setInterval(async () => {
        try {
          const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude: lat, longitude: lng } = l.coords;
          if (onLocationUpdate) onLocationUpdate({ latitude: lat, longitude: lng });
          await postLocation(lat, lng);
        } catch {}
      }, INTERVAL_MS);
    })();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [broadcasting, tripId, postLocation, onLocationUpdate]);
};
