import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = "ws://localhost:8000/ws/video";
const WS_CONNECT_TIMEOUT = 4000; // ms to wait before falling back to webcam

export function useCameraStream() {
  const [imgSrc,      setImgSrc]      = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [usingWebcam, setUsingWebcam] = useState(false);
  const [error,       setError]       = useState(null);

  const wsRef       = useRef(null);
  const prevUrl     = useRef(null);
  const pingRef     = useRef(null);
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const timerRef    = useRef(null);
  const didFallback = useRef(false);

  const startWebcam = useCallback(async () => {
    if (didFallback.current) return;
    didFallback.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setUsingWebcam(true);
      setConnected(true);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      const msg =
        err.name === "NotAllowedError"  ? "Camera permission denied" :
        err.name === "NotFoundError"    ? "No camera found on this device" :
        err.name === "NotReadableError" ? "Camera is in use by another app" :
        "Camera unavailable";
      setError(msg);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    let ws;
    let retryTimeout;
    let unmounted = false;

    function stopWebcam() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    function connect() {
      if (unmounted) return;
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.binaryType = "blob";

      timerRef.current = setTimeout(() => {
        if (!didFallback.current) startWebcam();
      }, WS_CONNECT_TIMEOUT);

      ws.onopen = () => {
        if (unmounted) { ws.close(); return; }
        clearTimeout(timerRef.current);
        setConnected(true);
        setUsingWebcam(false);
        setError(null);
        stopWebcam();
        didFallback.current = false;

        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 5000);
      };

      ws.onmessage = (evt) => {
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        const url = URL.createObjectURL(evt.data);
        prevUrl.current = url;
        setImgSrc(url);
      };

      ws.onerror = () => {
        if (unmounted) return;
        clearTimeout(timerRef.current);
        setConnected(false);
        if (!didFallback.current) startWebcam();
      };

      ws.onclose = () => {
        if (unmounted) return;
        clearTimeout(timerRef.current);
        setConnected(false);
        clearInterval(pingRef.current);
        if (!didFallback.current) startWebcam();
      };
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(retryTimeout);
      clearTimeout(timerRef.current);
      clearInterval(pingRef.current);
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
      ws?.close();
      stopWebcam();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (usingWebcam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [usingWebcam]);

  return { imgSrc, videoRef, connected, usingWebcam, error };
}
