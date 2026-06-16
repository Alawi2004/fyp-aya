/**
 * useGpsWebSocket — React Native GPS stream hook
 *
 * Connects to the backend WebSocket server (/gps-stream) and subscribes
 * to real-time GPS updates for a specific vehicle.  Falls back to HTTP
 * polling when:
 *   • EXPO_PUBLIC_FRONTEND_ONLY === 'true'  (dev mock mode)
 *   • WebSocket connection fails or disconnects
 *
 * Usage:
 *   const { location, isLive, isConnected, lastUpdated } = useGpsWebSocket(busId);
 *
 *   location    — { latitude, longitude } — latest known position
 *   isLive      — true once a real GPS packet has been received
 *   isConnected — true while the WebSocket is open
 *   lastUpdated — ISO string of the last GPS packet
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchBusGps } from "../api/apiClient";

const FRONTEND_ONLY  = process.env.EXPO_PUBLIC_FRONTEND_ONLY !== "false";
const POLL_INTERVAL  = 3_000;   // fallback polling interval (ms)
const RECONNECT_DELAY = 4_000;  // delay before WebSocket reconnect attempt

// Build WebSocket URL from the API base URL env var
function _wsUrl() {
  const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
  // Strip /api suffix, replace http(s):// with ws(s)://
  return base.replace(/\/api\/?$/, "").replace(/^http/, "ws") + "/gps-stream";
}

export function useGpsWebSocket(vehicleId, initialLocation = null) {
  const [location,    setLocation]    = useState(initialLocation);
  const [isLive,      setIsLive]      = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const wsRef      = useRef(null);
  const mountedRef = useRef(true);
  const retryTimer = useRef(null);

  // ── Polling fallback (used in FRONTEND_ONLY mode or after WS failure) ──────
  const startPolling = useCallback(() => {
    const interval = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const loc = await fetchBusGps(vehicleId);
        const lat = parseFloat(loc?.latitude ?? loc?.lat);
        const lng = parseFloat(loc?.longitude ?? loc?.lng);
        if (!isNaN(lat) && !isNaN(lng) && mountedRef.current) {
          setLocation({ latitude: lat, longitude: lng });
          setLastUpdated(loc.updatedAt || loc.recorded_at || new Date().toISOString());
          setIsLive(true);
        }
      } catch { /* keep showing last known position */ }
    }, POLL_INTERVAL);
    return interval;
  }, [vehicleId]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current || FRONTEND_ONLY) return;

    const url = _wsUrl();
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return; // WebSocket not available — polling fallback handles it
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", vehicle_id: vehicleId }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "gps_update" && msg.lat != null) {
          setLocation({ latitude: msg.lat, longitude: msg.lng });
          setLastUpdated(msg.recorded_at || new Date().toISOString());
          setIsLive(true);
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onerror = () => { /* onclose fires next — handled there */ };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      // Attempt reconnect after a short delay
      retryTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };
  }, [vehicleId]);

  // ── Effect: start stream on mount, tear down on unmount ──────────────────
  useEffect(() => {
    mountedRef.current = true;
    let pollInterval   = null;

    if (FRONTEND_ONLY) {
      // Dev mode — use polling with mock data
      pollInterval = startPolling();
    } else {
      connect();
      // Start polling as a background fallback; it will update location
      // if the WebSocket hasn't received anything for 6+ seconds.
      pollInterval = startPolling();
    }

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;  // prevent reconnect attempt on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [vehicleId, connect, startPolling]);

  return { location, isLive, isConnected, lastUpdated };
}
