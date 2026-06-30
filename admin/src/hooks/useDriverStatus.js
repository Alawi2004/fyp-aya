import { useState, useEffect } from 'react';
import { CAMERA_REST_URL } from '../config/camera';

const CAMERA_SERVER_REST = CAMERA_REST_URL;

const EMPTY_STATUS = {
  state: 'unknown', confidence: 0, alert: false,
  face_detected: false, eyes_closed: false, phone_detected: false,
  gaze: 'unknown', ear: 0, perclos: 0, seatbelt_on: true, fps: 0,
};

/**
 * Polls the camera server for one bus's live driver-monitor status + recent
 * AI alert history. `online` is false when the bus has no active driver feed
 * (e.g. the driver has not started a trip), in which case status is empty.
 */
export function useDriverStatus(busId = null, pollInterval = 1500) {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [alerts, setAlerts] = useState([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!busId) return;
    let active = true;

    setStatus(EMPTY_STATUS);
    setAlerts([]);
    setOnline(false);

    async function poll() {
      if (!active) return;
      try {
        const sRes = await fetch(
          `${CAMERA_SERVER_REST}/api/bus/${encodeURIComponent(busId)}/driver/status`,
          { signal: AbortSignal.timeout(1500) },
        );
        if (!active) return;
        if (!sRes.ok) { setOnline(false); setStatus(EMPTY_STATUS); return; }

        const sData = await sRes.json();
        if (!active) return;
        setOnline(true);
        setStatus({ ...EMPTY_STATUS, ...sData });

        try {
          const aRes = await fetch(
            `${CAMERA_SERVER_REST}/api/bus/${encodeURIComponent(busId)}/driver/alerts`,
            { signal: AbortSignal.timeout(1500) },
          );
          if (aRes.ok && active) {
            const aData = await aRes.json();
            if (Array.isArray(aData?.alerts)) setAlerts([...aData.alerts].reverse());
          }
        } catch { /* alerts optional */ }
      } catch {
        if (active) { setOnline(false); setStatus(EMPTY_STATUS); }
      }
    }

    poll();
    const id = setInterval(poll, pollInterval);
    return () => { active = false; clearInterval(id); };
  }, [busId, pollInterval]);

  return { status, alerts, online };
}
