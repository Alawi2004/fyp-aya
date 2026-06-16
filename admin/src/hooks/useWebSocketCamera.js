import { useEffect, useRef, useState } from 'react';
import { CAMERA_WS_URL } from '../config/camera';

const CAMERA_SERVER     = CAMERA_WS_URL;
const INITIAL_DELAY_MS  = 1_000;
const MAX_DELAY_MS      = 16_000;
const STALE_TIMEOUT_MS  = 3_000; // force reconnect if no frame for 3 s

export function useWebSocketCamera(busId = null, cameraType = 'passenger') {
  const [connected, setConnected] = useState(false);
  const [status,    setStatus]    = useState('disconnected');
  const [frameUrl,  setFrameUrl]  = useState(null);

  const wsRef        = useRef(null);
  const prevUrl      = useRef(null);
  const retryRef     = useRef(null);
  const watchdogRef  = useRef(null);
  const delayRef     = useRef(INITIAL_DELAY_MS);
  const destroyedRef = useRef(false);

  useEffect(() => {
    if (!busId) return;

    destroyedRef.current = false;

    function revokePrev() {
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    }

    function clearWatchdog() {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    }

    function resetWatchdog(closeAndReconnect) {
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        if (destroyedRef.current) return;
        // No frame received — force close so onclose triggers a reconnect
        wsRef.current?.close();
        setConnected(false);
        setStatus('disconnected');
      }, STALE_TIMEOUT_MS);
    }

    function connect() {
      if (destroyedRef.current) return;
      clearTimeout(retryRef.current);
      clearWatchdog();
      setStatus('connecting');

      const ws = new WebSocket(`${CAMERA_SERVER}/ws/bus/${busId}/${cameraType}`);
      wsRef.current = ws;
      ws.binaryType = 'blob';

      ws.onopen = () => {
        if (destroyedRef.current) { ws.close(); return; }
        delayRef.current = INITIAL_DELAY_MS;
        setConnected(true);
        setStatus('connected');
        resetWatchdog();
      };

      ws.onmessage = (evt) => {
        if (destroyedRef.current) return;
        resetWatchdog();
        revokePrev();
        const url = URL.createObjectURL(new Blob([evt.data], { type: 'image/jpeg' }));
        prevUrl.current = url;
        setFrameUrl(url);
      };

      ws.onerror = () => {
        if (destroyedRef.current) return;
        clearWatchdog();
        setConnected(false);
        setStatus('disconnected');
      };

      ws.onclose = () => {
        if (destroyedRef.current) return;
        clearWatchdog();
        setConnected(false);
        setStatus('disconnected');
        const delay = delayRef.current;
        delayRef.current = Math.min(delay * 2, MAX_DELAY_MS);
        retryRef.current = setTimeout(connect, delay);
      };
    }

    delayRef.current = INITIAL_DELAY_MS;
    connect();

    return () => {
      destroyedRef.current = true;
      clearTimeout(retryRef.current);
      clearWatchdog();
      wsRef.current?.close();
      revokePrev();
      setConnected(false);
      setStatus('disconnected');
      setFrameUrl(null);
    };
  }, [busId, cameraType]);

  return { connected, status, frameUrl };
}
