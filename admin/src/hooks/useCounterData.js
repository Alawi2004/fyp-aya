import { useState, useEffect, useCallback } from 'react';

const makeEvent = (onBus) => ({
  event: Math.random() > 0.35 ? 'ENTER' : 'EXIT',
  tid: Math.floor(Math.random() * 900) + 100,
  frame: Math.floor(Math.random() * 10000),
  on_bus: onBus,
  timestamp: new Date().toISOString(),
});

export function useCounterData(busId = null, pollInterval = 1500) {
  const [counter, setCounter] = useState({
    entered: 0,
    exited: 0,
    on_bus: 0,
    fps: 24,
    last_event: null,
  });
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState({ source: 'demo', frontend_only: true });
  const [health, setHealth] = useState({ status: 'demo', frontend_only: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const resetCounter = useCallback(async () => {
    setCounter({ entered: 0, exited: 0, on_bus: 0, fps: 24, last_event: null });
    setEvents([]);
    setError(null);
    return true;
  }, []);

  useEffect(() => {
    const baseCount = busId ? Math.floor(Math.random() * 18) + 6 : 12;
    setCounter({ entered: baseCount + 8, exited: 8, on_bus: baseCount, fps: 24, last_event: null });
    setEvents([]);
    setConfig({ source: 'demo', frontend_only: true, bus_id: busId });
    setHealth({ status: 'demo', frontend_only: true });
    setLoading(false);
    setError(null);

    const id = setInterval(() => {
      setCounter((prev) => {
        const entering = Math.random() > 0.4;
        const onBus = Math.max(0, prev.on_bus + (entering ? 1 : -1));
        const event = makeEvent(onBus);
        setEvents((old) => [event, ...old].slice(0, 50));
        return {
          entered: prev.entered + (entering ? 1 : 0),
          exited: prev.exited + (entering ? 0 : 1),
          on_bus: onBus,
          fps: 23 + Math.round(Math.random() * 3),
          last_event: event,
        };
      });
    }, pollInterval);

    return () => clearInterval(id);
  }, [busId, pollInterval]);

  return { counter, events, config, health, loading, error, resetCounter };
}
