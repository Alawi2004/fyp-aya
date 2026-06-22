/**
 * DriverLocationProvider — the single source of driver GPS for the whole app.
 *
 * Mounted once at the root of DriverNavigator so there is exactly ONE
 * `watchPositionAsync` subscription and ONE server broadcaster, no matter how
 * many driver screens are mounted by the tab/stack navigators.
 *
 * Replaces the previous duplicated pipelines (DriverDashboardScreen's
 * useGpsTracking → POST /gps, and DriverMapScreen's own watcher → POST
 * /driver/location), which ran two GPS watchers and double-wrote gps_logs.
 *
 * Responsibilities:
 *   • one BestForNavigation watch (2 s) → exposes { location, liveSpeed }
 *   • discovers the driver's active (ongoing) trip itself, so GPS is
 *     broadcast regardless of which screen is focused
 *   • one throttled broadcaster (every gps.update_interval_sec) → /driver/location
 */
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { getDriverTripsApi, updateLocationApi } from '../api/driverApi';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

const DriverLocationContext = createContext(null);

const WATCH_MS          = 2000; // local position update (smooth ETA / arrival)
const SPEED_BUFFER_SIZE = 5;    // rolling window for speed smoothing
const TRIP_REFRESH_MS   = 30000;

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const isActiveStatus = (s) =>
  ['ongoing', 'active', 'in_progress'].includes(String(s ?? '').toLowerCase());

export function DriverLocationProvider({ children }) {
  const { role } = useAuth();
  const { gpsSettings } = useApp();
  const isDriver    = role === 'driver';
  const broadcastMs = (gpsSettings?.updateIntervalSec ?? 10) * 1000;

  const [location,     setLocation]     = useState(null);
  const [liveSpeed,    setLiveSpeed]    = useState(null);
  const [gpsError,     setGpsError]     = useState(false);
  const [broadcasting, setBroadcasting] = useState(true);
  const [activeTrip,   setActiveTrip]   = useState(null); // { trip_id, route_id } | null

  // Refs so the throttled broadcaster always reads the latest values without
  // resetting its interval (the old per-screen effect reset every 2 s).
  const locationRef     = useRef(null);
  const tripRef         = useRef(null);
  const broadcastingRef = useRef(true);
  const speedBuf        = useRef([]);
  const subRef          = useRef(null);

  useEffect(() => { broadcastingRef.current = broadcasting; }, [broadcasting]);
  useEffect(() => { tripRef.current = activeTrip; }, [activeTrip]);

  // ── 1. Single GPS watcher ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isDriver) return;
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { if (mounted) setGpsError(true); return; }
      if (mounted) setGpsError(false);

      // Quick first fix so the map can centre immediately.
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        if (mounted) { locationRef.current = pos; setLocation(pos); }
      } catch { /* watch below will supply a fix */ }

      if (!mounted) return;
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: WATCH_MS, distanceInterval: 0 },
        (l) => {
          const pos = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          locationRef.current = pos;
          setLocation(pos);

          // GPS speed (m/s → km/h), noise-filtered + median-smoothed.
          const rawMs = l.coords.speed;
          if (rawMs != null && rawMs >= 0) {
            const kmh = rawMs * 3.6;
            if (kmh >= 2 && kmh <= 120) {
              const buf = [...speedBuf.current, kmh].slice(-SPEED_BUFFER_SIZE);
              speedBuf.current = buf;
              setLiveSpeed(Math.round(median(buf)));
            }
          }
        },
      );
    })();

    return () => {
      mounted = false;
      if (subRef.current) { subRef.current.remove(); subRef.current = null; }
    };
  }, [isDriver]);

  // ── 2. Discover the active (ongoing) trip so we broadcast from any screen ───
  const refreshActiveTrip = useCallback(async () => {
    if (!isDriver) return;
    try {
      const res = await getDriverTripsApi();
      const raw = Array.isArray(res.data) ? res.data
        : (Array.isArray(res.data?.trips) ? res.data.trips : []);
      const t = raw.find((x) => isActiveStatus(x.status)) ?? null;
      setActiveTrip(t ? { trip_id: t.trip_id ?? t._id ?? null, route_id: t.route_id ?? null } : null);
    } catch { /* keep last known active trip on transient failure */ }
  }, [isDriver]);

  useEffect(() => {
    if (!isDriver) return;
    refreshActiveTrip();
    const id = setInterval(refreshActiveTrip, TRIP_REFRESH_MS);
    return () => clearInterval(id);
  }, [isDriver, refreshActiveTrip]);

  // ── 3. Single throttled broadcaster (fixed interval, latest values) ────────
  useEffect(() => {
    if (!isDriver) return;
    const tick = () => {
      const trip = tripRef.current;
      const pos  = locationRef.current;
      if (!broadcastingRef.current || !trip?.trip_id || !pos) return;
      updateLocationApi({ trip_id: trip.trip_id, latitude: pos.latitude, longitude: pos.longitude })
        .catch(() => {});
    };
    const id = setInterval(tick, broadcastMs);
    return () => clearInterval(id);
  }, [isDriver, broadcastMs]);

  return (
    <DriverLocationContext.Provider
      value={{ location, liveSpeed, gpsError, broadcasting, setBroadcasting, activeTrip, refreshActiveTrip }}
    >
      {children}
    </DriverLocationContext.Provider>
  );
}

export const useDriverLocation = () => useContext(DriverLocationContext) ?? {};
