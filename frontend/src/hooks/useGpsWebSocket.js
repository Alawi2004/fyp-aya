/**
 * useGpsWebSocket — React Native GPS stream hook
 *
 * Connects to the backend WebSocket server (/gps-stream) and subscribes
 * to real-time GPS updates for a specific vehicle.  HTTP polling is used
 * ONLY as a fallback:
 *   • EXPO_PUBLIC_FRONTEND_ONLY === 'true'  (dev mock mode)
 *   • before the WebSocket has opened (so the first fix appears fast)
 *   • while the WebSocket is disconnected / reconnecting
 *
 * Once the WebSocket is open, polling stops — the two never run together.
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
  const pollRef    = useRef(null);

  // Apply a position update from either source. setState setters and refs are
  // stable, so this never needs to be re-created.
  const applyLocation = useCallback((lat, lng, ts) => {
    if (!mountedRef.current || isNaN(lat) || isNaN(lng)) return;
    setLocation({ latitude: lat, longitude: lng });
    setLastUpdated(ts || new Date().toISOString());
    setIsLive(true);
  }, []);

  // ── HTTP polling fallback ──────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;   // already polling — never stack intervals
    const tick = async () => {
      if (!mountedRef.current) return;
      try {
        const loc = await fetchBusGps(vehicleId);
        applyLocation(
          parseFloat(loc?.latitude ?? loc?.lat),
          parseFloat(loc?.longitude ?? loc?.lng),
          loc?.updatedAt || loc?.recorded_at,
        );
      } catch { /* keep showing last known position */ }
    };
    tick();                                   // immediate first read
    pollRef.current = setInterval(tick, POLL_INTERVAL);
  }, [vehicleId, applyLocation]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current || FRONTEND_ONLY) return;

    let ws;
    try {
      ws = new WebSocket(_wsUrl());
    } catch {
      startPolling();   // WebSocket unavailable — fall back to polling
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      stopPolling();    // live stream is authoritative — stop the fallback poll
      ws.send(JSON.stringify({ type: "subscribe", vehicle_id: vehicleId }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "gps_update" && msg.lat != null) {
          applyLocation(Number(msg.lat), Number(msg.lng), msg.recorded_at);
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onerror = () => { /* onclose fires next — handled there */ };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      startPolling();   // resume polling while disconnected
      retryTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };
  }, [vehicleId, startPolling, stopPolling, applyLocation]);

  // ── Effect: start stream on mount, tear down on unmount ──────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Poll immediately for a fast first fix; in live mode the WebSocket's
    // onopen handler stops it once the stream is established.
    startPolling();
    if (!FRONTEND_ONLY) connect();

    return () => {
      mountedRef.current = false;
      stopPolling();
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;  // prevent reconnect attempt on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [vehicleId, connect, startPolling, stopPolling]);

  return { location, isLive, isConnected, lastUpdated };
}
