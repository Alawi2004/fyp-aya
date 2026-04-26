import { useEffect, useRef, useState } from 'react';

const CAMERA_SERVER = 'ws://localhost:9000';

export function useWebSocketCamera(busId = null, cameraType = 'passenger') {
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState(null);
  const [frameUrl,  setFrameUrl]  = useState(null);

  const wsRef      = useRef(null);
  const prevUrl    = useRef(null);
  const retryRef   = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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

      const ws = new WebSocket(`${CAMERA_SERVER}/ws/bus/${busId}/${cameraType}`);
      wsRef.current = ws;
      ws.binaryType = 'blob';

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        setConnected(true);
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
        if (!destroyed) {
          setConnected(false);
          setError('Camera server offline — demo mode active');
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setConnected(false);
        retryRef.current = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
      revokePrev();
      setConnected(false);
      setFrameUrl(null);
    };
  }, [busId, cameraType]);

  return { connected, error, frameUrl };
}
