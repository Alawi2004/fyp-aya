import { useState, useEffect, useCallback } from "react";

const POLL_MS = 3000;

const makeEvent = (onBus) => ({
  event: Math.random() > 0.35 ? "ENTER" : "EXIT",
  tid: Math.floor(Math.random() * 900) + 100,
  frame: Math.floor(Math.random() * 10000),
  on_bus: onBus,
  timestamp: new Date().toISOString(),
});

export function useBusCounter() {
  const [counts, setCounts] = useState({ entered: 18, exited: 6, on_bus: 12, fps: 24 });
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState({ status: "demo", frontend_only: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tick = useCallback(() => {
    setCounts((prev) => {
      const entering = Math.random() > 0.4;
      const onBus = Math.max(0, prev.on_bus + (entering ? 1 : -1));
      const event = makeEvent(onBus);
      setEvents((old) => [event, ...old].slice(0, 50));
      return {
        entered: prev.entered + (entering ? 1 : 0),
        exited: prev.exited + (entering ? 0 : 1),
        on_bus: onBus,
        fps: 23 + Math.round(Math.random() * 3),
      };
    });
    setStatus({ status: "demo", frontend_only: true, updated_at: new Date().toISOString() });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [tick]);

  const resetCounts = useCallback(async () => {
    setCounts({ entered: 0, exited: 0, on_bus: 0, fps: 24 });
    setEvents([]);
    setError(null);
  }, []);

  return { counts, events, status, loading, error, refetch: tick, resetCounts };
}
