import { useEffect, useRef, useState } from 'react';
import { CAMERA_WS_URL } from '../config/camera';

const CAMERA_SERVER    = CAMERA_WS_URL;
const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS     = 30_000;

// status values: 'connecting' | 'connected' | 'disconnected'
export function useWebSocketCamera(busId = null, cameraType = 'passenger') {
  const [connected, setConnected] = useState(false);
  const [status,    setStatus]    = useState('disconnected');
  const [error,     setError]     = useState(null);
  const [frameUrl,  setFrameUrl]  = useState(null);

  const wsRef      = useRef(null);
  const prevUrl    = useRef(null);
  const retryRef   = useRef(null);
  const delayRef   = useRef(INITIAL_DELAY_MS); // current backoff delay

  useEffect(() => {
    if (!busId) return;

    let destroyed = false;

    function revokePrev() {
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    }

    function connect() {
      if (destroyed) return;
      clearTimeout(retryRef.current);
      setStatus('connecting');

      const ws = new WebSocket(`${CAMERA_SERVER}/ws/bus/${busId}/${cameraType}`);
      wsRef.current = ws;
      ws.binaryType = 'blob';

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        delayRef.current = INITIAL_DELAY_MS; // reset backoff on successful connect
        setConnected(true);
        setStatus('connected');
        setError(null);
      };

      ws.onmessage = (evt) => {
        if (destroyed) return;
        revokePrev();
        const url = URL.createObjectURL(new Blob([evt.data], { type: 'image/jpeg' }));
        prevUrl.current = url;
        setFrameUrl(url);
      };

      ws.onerror = () => {
        if (destroyed) return;
        setConnected(false);
        setStatus('disconnected');
        setError('Camera server offline — demo mode active');
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        setStatus('disconnected');

        // Exponential backoff: 1 s → 2 s → 4 s → … → 30 s cap
        const delay = delayRef.current;
        delayRef.current = Math.min(delay * 2, MAX_DELAY_MS);

        retryRef.current = setTimeout(connect, delay);
      };
    }

    delayRef.current = INITIAL_DELAY_MS; // reset before first connect attempt
    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
      revokePrev();
      setConnected(false);
      setStatus('disconnected');
      setFrameUrl(null);
    };
  }, [busId, cameraType]);

  return { connected, status, error, frameUrl };
}
