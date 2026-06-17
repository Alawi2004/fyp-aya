import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, AlertTriangle, Loader, QrCode, CheckCircle } from "lucide-react";
import jsQR from "jsqr";
import { C } from "../styles/themes";

export default function QRScanModal({ onResult, onClose }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);  // BarcodeDetector (if available)
  const rafRef      = useRef(null);
  const scannedRef  = useRef(false);

  const [camState,  setCamState]  = useState("init"); // init|requesting|live|error|unsupported
  const [camError,  setCamError]  = useState(null);
  const [manualVal, setManualVal] = useState("");
  const [detected,  setDetected]  = useState(null);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    scannedRef.current = false;
    setDetected(null);
    setCamError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState("unsupported");
      return;
    }

    setCamState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if ("BarcodeDetector" in window) {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      }
      // jsQR is always available as fallback — no else branch needed

      setCamState("live");
      scheduleScan();
    } catch (err) {
      setCamState("error");
      setCamError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access or use manual entry below."
          : `Camera error: ${err.message}`
      );
    }
  }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // ── Scan loop — BarcodeDetector first, jsQR fallback ─────────────────────
  const scheduleScan = () => {
    rafRef.current = requestAnimationFrame(async () => {
      if (scannedRef.current) return;

      const video = videoRef.current;
      if (video?.readyState >= 2) {
        let raw = null;

        // Path 1: native BarcodeDetector (Chrome/Edge)
        if (detectorRef.current) {
          try {
            const results = await detectorRef.current.detect(video);
            if (results.length > 0) raw = results[0].rawValue;
          } catch {}
        }

        // Path 2: jsQR canvas fallback (Firefox / Safari / any browser)
        if (!raw) {
          try {
            const canvas = canvasRef.current;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              canvas.width  = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(video, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
              if (code) raw = code.data;
            }
          } catch {}
        }

        if (raw && !scannedRef.current) {
          handleDetected({ type: "qr", raw });
          return;
        }
      }

      if (!scannedRef.current) setTimeout(scheduleScan, 150);
    });
  };

  const handleDetected = (result) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setDetected(result.raw);
    stopCamera();
    setTimeout(() => onResult(result), 800);
  };

  // ── Manual entry ──────────────────────────────────────────────────────────
  const submitManual = () => {
    const v = manualVal.trim();
    if (!v) return;
    handleDetected({ type: "manual", raw: v });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      {/* Hidden canvas for jsQR frame extraction */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{
        background: "#fff", borderRadius: 20, overflow: "hidden",
        width: "100%", maxWidth: 460,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        animation: "slideUp .2s ease",
      }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, #0F172A, #1E293B)`,
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(109,40,217,.3)", border: "1px solid rgba(109,40,217,.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <QrCode size={16} color={C.primary} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC" }}>Scan Passenger</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>QR Code or Manual Entry</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={15} color="#94A3B8" />
          </button>
        </div>

        <div style={{ padding: 20 }}>

          {/* Camera viewport */}
          <div style={{
            position: "relative", width: "100%", paddingBottom: "62%",
            borderRadius: 12, overflow: "hidden", background: "#0F172A",
            marginBottom: 16, border: `1px solid ${C.border}`,
          }}>
            <video
              ref={videoRef} autoPlay playsInline muted
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover",
                display: camState === "live" && !detected ? "block" : "none",
              }}
            />

            {/* Scanning overlay */}
            {camState === "live" && !detected && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: 160, height: 160, border: `2px solid ${C.primary}`,
                  borderRadius: 12, boxShadow: `0 0 0 4000px rgba(0,0,0,.45)`,
                  position: "relative",
                }}>
                  {[
                    { top: -2, left: -2, borderTop: `3px solid ${C.primary}`, borderLeft: `3px solid ${C.primary}` },
                    { top: -2, right: -2, borderTop: `3px solid ${C.primary}`, borderRight: `3px solid ${C.primary}` },
                    { bottom: -2, left: -2, borderBottom: `3px solid ${C.primary}`, borderLeft: `3px solid ${C.primary}` },
                    { bottom: -2, right: -2, borderBottom: `3px solid ${C.primary}`, borderRight: `3px solid ${C.primary}` },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 18, height: 18, ...s }} />
                  ))}
                </div>
                <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,.8)", fontWeight: 500 }}>
                  Align QR code in the frame
                </div>
              </div>
            )}

            {(camState === "init" || camState === "requesting") && (
              <Centred><Loader size={24} color={C.primary} style={{ animation: "spin 1s linear infinite" }} /><Txt>Starting camera…</Txt></Centred>
            )}
            {camState === "error" && (
              <Centred><AlertTriangle size={24} color={C.warning} /><Txt>{camError}</Txt></Centred>
            )}
            {camState === "unsupported" && (
              <Centred><Camera size={24} color="#475569" /><Txt>Camera not available in this browser.</Txt></Centred>
            )}
            {detected && (
              <Centred>
                <CheckCircle size={32} color={C.success} />
                <Txt style={{ color: "#fff", fontWeight: 700 }}>QR Detected!</Txt>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detected}</div>
              </Centred>
            )}

          </div>

          {/* Manual entry */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".4px" }}>
              Manual Entry (ID or Email)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualVal}
                onChange={e => setManualVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitManual()}
                placeholder="User ID or email…"
                autoFocus={camState === "error" || camState === "unsupported"}
                style={{
                  flex: 1, padding: "9px 12px", fontSize: 13,
                  border: `1.5px solid ${C.border}`, borderRadius: 9,
                  outline: "none", fontFamily: "Inter, system-ui, sans-serif",
                  color: "#0F172A", background: "#FAFBFC",
                }}
              />
              <button onClick={submitManual} style={{
                padding: "9px 16px", borderRadius: 9, border: "none",
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Find
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Centred({ children }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(15,23,42,.75)", gap: 8,
    }}>
      {children}
    </div>
  );
}

function Txt({ children, style }) {
  return (
    <div style={{ fontSize: 12, color: "#CBD5E1", textAlign: "center", maxWidth: 260, lineHeight: 1.4, ...style }}>
      {children}
    </div>
  );
}

