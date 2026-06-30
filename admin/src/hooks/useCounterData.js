import { useState, useEffect, useCallback, useRef } from 'react';
import { CAMERA_REST_URL } from '../config/camera';

const CAMERA_SERVER_REST = CAMERA_REST_URL;

const EMPTY_COUNTER = { entered: 0, exited: 0, on_bus: 0, fps: 0, last_event: null };

/**
 * Live passenger-counter data for one bus, read straight from the camera server.
 *
 * No mock/demo data: when the camera server is offline, or the selected bus has
 * no passenger-counter session, the counter reads zero and `online` is false.
 * The UI should show an "offline" state rather than fabricated numbers.
 */
export function useCounterData(busId = null, pollInterval = 1500) {
  const [counter, setCounter] = useState(EMPTY_COUNTER);
  const [events,  setEvents]  = useState([]);
  const [health,  setHealth]  = useState({ status: 'offline' });
  const [online,  setOnline]  = useState(false);

  const onlineRef = useRef(false);
  const busIdRef  = useRef(busId);

  useEffect(() => { busIdRef.current = busId; }, [busId]);

  const resetCounter = useCallback(async () => {
    if (onlineRef.current && busIdRef.current) {
      try {
        await fetch(`${CAMERA_SERVER_REST}/api/bus/${busIdRef.current}/counter/reset`, {
          method: 'POST',
          signal: AbortSignal.timeout(2000),
        });
      } catch {}
    }
    setCounter(EMPTY_COUNTER);
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!busId) return;
    let active = true;

    function goOffline() {
      if (!active) return;
      onlineRef.current = false;
      setOnline(false);
      setHealth({ status: 'offline' });
      setCounter(EMPTY_COUNTER);
      setEvents([]);
    }

    async function poll() {
      if (!active) return;
      try {
        // 1. Is the camera server reachable at all?
        const hRes = await fetch(`${CAMERA_SERVER_REST}/api/health`, { signal: AbortSignal.timeout(1500) });
        if (!active) return;
        if (!hRes.ok) { goOffline(); return; }

        const hData = await hRes.json();
        if (!active) return;
        onlineRef.current = true;
        setOnline(true);
        setHealth({ status: hData.status || 'ok', buses: hData.buses });

        // 2. Does THIS bus have a live passenger-counter session?
        const cRes = await fetch(`${CAMERA_SERVER_REST}/api/bus/${busId}/counter`, { signal: AbortSignal.timeout(1500) });
        if (!active) return;
        if (!cRes.ok) {
          // Server is up but this bus has no passenger camera — show zeros, not mock.
          setCounter(EMPTY_COUNTER);
          setEvents([]);
          return;
        }

        const cData = await cRes.json();
        if (!active) return;
        setCounter({
          on_bus:          cData.on_bus      ?? cData.current_passengers ?? 0,
          entered:         cData.entered     ?? cData.entries             ?? 0,
          exited:          cData.exited      ?? cData.exits               ?? 0,
          fps:             cData.fps         ?? 0,
          last_event:      cData.last_event  ?? null,
          available_seats: cData.available_seats ?? null,
          capacity:        cData.capacity    ?? null,
        });

        try {
          const eRes = await fetch(`${CAMERA_SERVER_REST}/api/bus/${busId}/events?limit=50`, { signal: AbortSignal.timeout(1500) });
          if (eRes.ok && active) {
            const eData = await eRes.json();
            if (Array.isArray(eData)) setEvents(eData);
          }
        } catch { /* events optional */ }
      } catch {
        goOffline();
      }
    }

    setCounter(EMPTY_COUNTER);
    setEvents([]);
    setOnline(false);
    onlineRef.current = false;

    poll();
    const pollId = setInterval(poll, pollInterval);

    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, [busId, pollInterval]);

  return { counter, events, health, online, resetCounter };
}
