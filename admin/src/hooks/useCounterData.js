import { useState, useEffect, useCallback, useRef } from 'react';
import { CAMERA_REST_URL } from '../config/camera';

const CAMERA_SERVER_REST = CAMERA_REST_URL;

const makeDemoEvent = (onBus) => ({
  event:     Math.random() > 0.35 ? 'ENTER' : 'EXIT',
  tid:       Math.floor(Math.random() * 900) + 100,
  frame:     Math.floor(Math.random() * 10000),
  on_bus:    onBus,
  timestamp: new Date().toISOString(),
});

export function useCounterData(busId = null, pollInterval = 1500) {
  const [counter, setCounter] = useState({ entered: 0, exited: 0, on_bus: 0, fps: 0, last_event: null });
  const [events,  setEvents]  = useState([]);
  const [health,  setHealth]  = useState({ status: 'demo' });
  const [online,  setOnline]  = useState(false);

  const onlineRef    = useRef(false);
  const demoStateRef = useRef(null);
  const demoIdRef    = useRef(null);
  const busIdRef     = useRef(busId);

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
    if (demoStateRef.current) {
      demoStateRef.current = { entered: 0, exited: 0, on_bus: 0 };
    }
    setCounter({ entered: 0, exited: 0, on_bus: 0, fps: 0, last_event: null });
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!busId) return;

    let active = true;
    const baseCount = Math.floor(Math.random() * 18) + 6;
    demoStateRef.current = { on_bus: baseCount, entered: baseCount + 8, exited: 8 };

    function stopDemo() {
      if (demoIdRef.current) {
        clearInterval(demoIdRef.current);
        demoIdRef.current = null;
      }
    }

    function startDemo() {
      if (!active) return;
      onlineRef.current = false;
      setOnline(false);
      setHealth({ status: 'demo' });
      if (demoIdRef.current) return;
      demoIdRef.current = setInterval(() => {
        if (!active) return;
        const ds = demoStateRef.current;
        const entering = Math.random() > 0.4;
        demoStateRef.current = {
          on_bus:  Math.max(0, ds.on_bus + (entering ? 1 : -1)),
          entered: ds.entered + (entering ? 1 : 0),
          exited:  ds.exited  + (entering ? 0 : 1),
        };
        const event = makeDemoEvent(demoStateRef.current.on_bus);
        setEvents(old => [event, ...old].slice(0, 50));
        setCounter({ ...demoStateRef.current, fps: 23 + Math.round(Math.random() * 3), last_event: event });
      }, pollInterval);
    }

    async function poll() {
      if (!active) return;
      try {
        const [hRes, cRes] = await Promise.all([
          fetch(`${CAMERA_SERVER_REST}/api/health`,               { signal: AbortSignal.timeout(1500) }),
          fetch(`${CAMERA_SERVER_REST}/api/bus/${busId}/counter`, { signal: AbortSignal.timeout(1500) }),
        ]);
        if (!active) return;
        if (!hRes.ok || !cRes.ok) { startDemo(); return; }

        const [hData, cData] = await Promise.all([hRes.json(), cRes.json()]);
        if (!active) return;

        let eData = [];
        try {
          const eRes = await fetch(`${CAMERA_SERVER_REST}/api/bus/${busId}/events?limit=50`, { signal: AbortSignal.timeout(1500) });
          if (eRes.ok) eData = await eRes.json();
        } catch {}

        if (!active) return;
        stopDemo();
        onlineRef.current = true;
        setOnline(true);
        setHealth({ status: hData.status || 'ok', buses: hData.buses });
        setCounter({
          on_bus:          cData.on_bus      ?? cData.current_passengers ?? 0,
          entered:         cData.entered     ?? cData.entries             ?? 0,
          exited:          cData.exited      ?? cData.exits               ?? 0,
          fps:             cData.fps         ?? 0,
          last_event:      cData.last_event  ?? null,
          available_seats: cData.available_seats ?? null,
          capacity:        cData.capacity    ?? null,
        });
        if (Array.isArray(eData) && eData.length > 0) setEvents(eData);
      } catch {
        if (active) startDemo();
      }
    }

    setCounter({ entered: 0, exited: 0, on_bus: 0, fps: 0, last_event: null });
    setEvents([]);
    setOnline(false);
    onlineRef.current = false;

    poll();
    const pollId = setInterval(poll, pollInterval);

    return () => {
      active = false;
      clearInterval(pollId);
      stopDemo();
    };
  }, [busId, pollInterval]);

  return { counter, events, health, online, resetCounter };
}
