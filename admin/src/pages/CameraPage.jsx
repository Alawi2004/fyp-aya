// src/pages/CameraPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Smartphone, Moon, Eye, AlertTriangle, User } from 'lucide-react';
import { useWebSocketCamera } from '../hooks/useWebSocketCamera';
import { useCounterData }     from '../hooks/useCounterData';

// ─── Constants ────────────────────────────────────────────────────────────────

import { CAMERA_REST_URL } from '../config/camera';
const CAMERA_SERVER_REST = CAMERA_REST_URL;

const MOCK_BUSES = [
  { bus_id: 'BUS-01', driver: 'Karim Moussa',   route: 'Route 12A', on_bus: 24, driver_alert: 'focused',   active: true  },
  { bus_id: 'BUS-05', driver: 'Lara Abi Nader', route: 'Route 7B',  on_bus: 18, driver_alert: 'focused',   active: true  },
  { bus_id: 'BUS-09', driver: 'Joe Pharaon',    route: 'Route 3C',  on_bus: 40, driver_alert: 'focused',   active: true  },
  { bus_id: 'BUS-02', driver: 'Maya Salameh',   route: 'Route 5D',  on_bus: 11, driver_alert: 'focused',   active: false },
  { bus_id: 'BUS-11', driver: 'Rami Khoury',    route: 'Route 9E',  on_bus:  0, driver_alert: 'focused',   active: false },
  { bus_id: 'BUS-07', driver: 'Sara Khoury',    route: 'Route 3C',  on_bus: 25, driver_alert: 'focused',   active: false },
  { bus_id: 'BUS-12', driver: 'Fadi Gemayel',   route: 'Route 7B',  on_bus: 30, driver_alert: 'focused',   active: true  },
];

const ALERT_META = {
  focused:        { color: '#059669', bg: '#dcfce7', border: '#86efac', Icon: Check,         label: 'Focused',         severity: 0 },
  phone_detected: { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', Icon: Smartphone,    label: 'Phone Detected!', severity: 3 },
  drowsy:         { color: '#d97706', bg: '#fef3c7', border: '#fde68a', Icon: Moon,          label: 'Drowsy',          severity: 2 },
  distracted:     { color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', Icon: Eye,           label: 'Distracted!',     severity: 1 },
  no_face:        { color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', Icon: AlertTriangle, label: 'No Face',         severity: 1 },
};
const alertMeta = (a) => ALERT_META[a] || ALERT_META.focused;

const ALERT_SEQUENCE = [
  'focused','focused','focused','focused','distracted',
  'focused','focused','phone_detected','focused','focused',
  'drowsy','focused','focused','focused',
];
const INITIAL_STATUS = {
  alert: 'focused', face_detected: true, eyes_detected: true,
  phone_detected: false, fps: 24.5, ear: 0.32, yaw: 2, pitch: -3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : { r: 100, g: 100, b: 100 };
}

function playAlertSound(type) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'phone_detected') { osc.frequency.value = 880; osc.type = 'square';   }
    else if (type === 'drowsy')    { osc.frequency.value = 440; osc.type = 'sine';     }
    else                           { osc.frequency.value = 660; osc.type = 'triangle'; }
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch { /* no audio */ }
}

// ─── Simulated driver status (fallback when server offline) ──────────────────

function useSimulatedDriverStatus(busId) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [alerts, setAlerts] = useState([]);
  const idxRef       = useRef(0);
  const prevAlertRef = useRef('focused');
  const prevBusId    = useRef(busId);

  if (prevBusId.current !== busId) {
    prevBusId.current = busId;
    setStatus(INITIAL_STATUS);
    setAlerts([]);
  }

  useEffect(() => {
    if (!busId) return;
    idxRef.current       = 0;
    prevAlertRef.current = 'focused';
    const tick = () => {
      idxRef.current = (idxRef.current + 1) % ALERT_SEQUENCE.length;
      const alert = ALERT_SEQUENCE[idxRef.current];
      setStatus({
        alert,
        face_detected:  alert !== 'distracted',
        eyes_detected:  alert !== 'drowsy',
        phone_detected: alert === 'phone_detected',
        fps:            (23 + Math.random() * 4).toFixed(1),
        ear:            alert === 'drowsy' ? 0.17 + Math.random() * 0.03 : 0.28 + Math.random() * 0.06,
        yaw:            alert === 'distracted' ? 38 + Math.random() * 10 : (Math.random() - 0.5) * 15,
        pitch:          alert === 'drowsy' ? -25 + Math.random() * 5 : (Math.random() - 0.5) * 10,
        timestamp: new Date().toISOString(),
        bus_id: busId,
      });
      if (alert !== prevAlertRef.current && alert !== 'focused') {
        setAlerts((prev) => [{ alert, previous: prevAlertRef.current,
          timestamp: new Date().toISOString(), bus_id: busId }, ...prev].slice(0, 20));
      }
      prevAlertRef.current = alert;
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [busId]);

  return { status, alerts };
}

// Maps gaze string from camera-aya to yaw/pitch angles for the overlay canvas
function gazeToAngles(gaze) {
  switch (gaze) {
    case 'left':  return { yaw: +40, pitch:   0 };
    case 'right': return { yaw: -40, pitch:   0 };
    case 'down':  return { yaw:   0, pitch: -25 };
    case 'up':    return { yaw:   0, pitch: +20 };
    default:      return { yaw:   0, pitch:   0 };
  }
}

// ─── Real driver status (polling from camera server) ─────────────────────────

function useServerDriverStatus(busId) {
  const [status, setStatus] = useState(null);
  const [online, setOnline] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const prevAlert = useRef('focused');

  useEffect(() => {
    if (!busId) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`${CAMERA_SERVER_REST}/api/bus/${busId}/driver/status`, { signal: AbortSignal.timeout(1500) });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          // camera-aya returns `state` (string) and `alert` (boolean).
          // Normalize to what the UI expects: alert = state string, eyes_detected = !eyes_closed.
          const angles     = gazeToAngles(data.gaze);
          const normalized = {
            ...data,
            alert:         data.state || data.alert_label || (data.alert ? 'distracted' : 'focused'),
            eyes_detected: !data.eyes_closed,
            yaw:           angles.yaw,
            pitch:         angles.pitch,
          };
          setStatus(normalized);
          setOnline(true);
          if (normalized.alert !== prevAlert.current) {
            if (normalized.alert !== 'focused') {
              setAlerts(prev => [{ alert: normalized.alert, previous: prevAlert.current,
                timestamp: new Date().toISOString(), bus_id: busId }, ...prev].slice(0, 20));
            }
            prevAlert.current = normalized.alert;
          }
        } else {
          setOnline(false);
        }
      } catch {
        if (active) setOnline(false);
      }
    };

    poll();
    const id = setInterval(poll, 1200);
    return () => { active = false; clearInterval(id); };
  }, [busId]);

  return { status, online, alerts };
}

// ─── Animated passenger detection canvas (demo mode) ─────────────────────────

function PassengerDetectionCanvas({ counter }) {
  const canvasRef  = useRef(null);
  const counterRef = useRef(counter);

  useEffect(() => { counterRef.current = counter; }, [counter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const ZL = Math.floor(W * 0.35);
    const ZR = Math.floor(W * 0.65);

    let frameIdx  = 0;
    let rafHandle = null;
    const state = {
      people: [],
      nextId: 1,
      flashFrame: -999,
      flashType: null,
    };

    function getZone(x) {
      if (x < ZL) return 'outside';
      if (x > ZR) return 'inside';
      return 'door';
    }

    function spawnPerson() {
      if (state.people.length >= 3) return;
      const goRight = Math.random() > 0.38;
      state.people.push({
        id: state.nextId++,
        x:     goRight ? -15 : W + 15,
        y:     H * 0.22 + Math.random() * H * 0.52,
        speed: goRight ? 0.85 + Math.random() * 0.55 : -(0.85 + Math.random() * 0.55),
        w: 26, h: 50,
        zone:    'outside',
        counted: false,
      });
    }

    function drawArrow(x1, y1, x2, y2, color, lineW) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 9 * Math.cos(angle - 0.4), y2 - 9 * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - 9 * Math.cos(angle + 0.4), y2 - 9 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }

    function draw() {
      frameIdx++;
      const c = counterRef.current;

      ctx.fillStyle = '#051a0e';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.setLineDash([2, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.setLineDash([]);

      // Zone fills
      ctx.fillStyle = 'rgba(250,180,0,0.07)';   ctx.fillRect(0,  0, ZL,      H);
      ctx.fillStyle = 'rgba(0,200,255,0.06)';   ctx.fillRect(ZL, 0, ZR - ZL, H);
      ctx.fillStyle = 'rgba(0,200,80,0.09)';    ctx.fillRect(ZR, 0, W - ZR,  H);

      // Flash overlay on passenger event
      const flashAge = frameIdx - state.flashFrame;
      if (flashAge < 22) {
        const a = (1 - flashAge / 22) * 0.18;
        ctx.fillStyle = state.flashType === 'ENTER'
          ? `rgba(0,255,120,${a})` : `rgba(255,60,60,${a})`;
        ctx.fillRect(0, 0, W, H);
        const ba = (1 - flashAge / 22) * 0.85;
        ctx.strokeStyle = state.flashType === 'ENTER'
          ? `rgba(0,255,120,${ba})` : `rgba(255,60,60,${ba})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
      }

      // Detection boundary lines (dashed)
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ZL, 0); ctx.lineTo(ZL, H); ctx.stroke();

      ctx.strokeStyle = '#0891b2';
      ctx.beginPath(); ctx.moveTo(ZR, 0); ctx.lineTo(ZR, H); ctx.stroke();
      ctx.setLineDash([]);

      // Small tick marks on detection lines
      for (let y = 10; y < H; y += 30) {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(ZL - 4, y, 8, 2);
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(ZR - 4, y, 8, 2);
      }

      // Zone labels
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';  ctx.fillText('OUTSIDE',   ZL / 2,          20);
      ctx.fillStyle = '#67e8f9';  ctx.fillText('DOOR ZONE', (ZL + ZR) / 2,   20);
      ctx.fillStyle = '#4ade80';  ctx.fillText('INSIDE',    ZR + (W - ZR)/2, 20);

      // Direction arrows near detection lines
      const arrowY = H / 2;
      drawArrow(ZL - 32, arrowY, ZL - 8, arrowY, 'rgba(248,113,113,0.7)', 1.5);
      drawArrow(ZL + 8,  arrowY, ZL + 32, arrowY, 'rgba(74,222,128,0.7)', 1.5);

      // Spawn people
      if (frameIdx % 140 === 0 || (state.people.length === 0 && frameIdx % 45 === 0)) {
        spawnPerson();
      }

      // Update & draw people
      state.people = state.people.filter(p => {
        p.x += p.speed;
        const newZone = getZone(p.x);

        if (!p.counted) {
          if (p.speed > 0 && newZone === 'inside' && p.zone !== 'inside') {
            p.counted = true;
            state.flashFrame = frameIdx;
            state.flashType  = 'ENTER';
          } else if (p.speed < 0 && newZone === 'outside' && p.zone !== 'outside') {
            p.counted = true;
            state.flashFrame = frameIdx;
            state.flashType  = 'EXIT';
          }
        }
        p.zone = newZone;

        if (p.x < -50 || p.x > W + 50) return false;

        const col = p.zone === 'door' ? '#67e8f9'
                  : p.zone === 'inside' ? '#4ade80' : '#fbbf24';
        const px  = p.x - p.w / 2;
        const py  = p.y - p.h / 2;

        // Detection bounding box
        ctx.strokeStyle = col;
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(px - 3, py - 3, p.w + 6, p.h + 6);

        // Body
        ctx.fillStyle = col + 'bb';
        ctx.beginPath();
        ctx.roundRect(px, py + 16, p.w, p.h - 16, 4);
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(p.x, py + 10, 10, 0, Math.PI * 2);
        ctx.fill();

        // Track ID label
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(px - 2, py - 16, 34, 13);
        ctx.fillStyle = col;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`#${p.id} ${p.zone.toUpperCase().slice(0,3)}`, px, py - 5);

        return true;
      });

      // Stats panel (top-right)
      ctx.fillStyle = 'rgba(0,0,0,0.70)';
      ctx.beginPath();
      ctx.roundRect(W - 138, 6, 132, 82, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(16,163,74,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(W - 138, 6, 132, 82);

      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('PASSENGER CAM', W - 132, 22);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`${c.on_bus}`, W - 132, 50);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('ON BUS', W - 110, 50);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#60a5fa'; ctx.fillText(`↓ Entered: ${c.entered}`, W - 132, 64);
      ctx.fillStyle = '#f87171'; ctx.fillText(`↑ Exited:  ${c.exited}`,  W - 132, 78);

      // Event ticker bottom
      if (flashAge < 70) {
        const a = Math.max(0, 1 - flashAge / 70);
        const isEnter = state.flashType === 'ENTER';
        ctx.fillStyle = `rgba(0,0,0,${a * 0.72})`;
        ctx.fillRect(0, H - 28, W, 28);
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isEnter ? `rgba(0,255,120,${a})` : `rgba(255,80,80,${a})`;
        ctx.fillText(
          isEnter ? '↓  PASSENGER ENTERED' : '↑  PASSENGER EXITED',
          W / 2, H - 9
        );
      }

      // "DEMO MODE" watermark
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillText('DETECTION DEMO · Start camera_server.py for live feed', 8, H - 8);

      rafHandle = requestAnimationFrame(draw);
    }

    rafHandle = requestAnimationFrame(draw);
    return () => { if (rafHandle) cancelAnimationFrame(rafHandle); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={640} height={360}
      style={{ width: '100%', height: '100%', display: 'block', borderRadius: 8 }}
    />
  );
}

// ─── Driver monitoring canvas overlay (drawn on top of webcam) ───────────────

function DriverOverlayCanvas({ driverStatus, alertMeta: meta }) {
  const canvasRef  = useRef(null);
  const statusRef  = useRef(driverStatus);
  const metaRef    = useRef(meta);

  useEffect(() => { statusRef.current = driverStatus; }, [driverStatus]);
  useEffect(() => { metaRef.current   = meta; },         [meta]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frameIdx  = 0;
    let rafHandle = null;

    function draw() {
      frameIdx++;
      const status = statusRef.current;
      const m      = metaRef.current;
      const W = canvas.width;
      const H = canvas.height;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      if (!status) { rafHandle = requestAnimationFrame(draw); return; }

      const rgb = hexToRgb(m.color);
      const faceDetected = status.face_detected !== false;

      if (faceDetected) {
        // Minor jitter to simulate live tracking
        const jx = (Math.random() - 0.5) * 3;
        const jy = (Math.random() - 0.5) * 3;
        const fx = Math.floor((0.28 + jx * 0.002) * W);
        const fy = Math.floor((0.10 + jy * 0.002) * H);
        const fw = Math.floor(0.44 * W);
        const fh = Math.floor(0.65 * H);

        const faceCol = status.alert === 'focused'
          ? 'rgba(0,200,80,0.9)'
          : status.alert === 'drowsy'
            ? 'rgba(255,140,0,0.9)'
            : `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;

        // Face bounding box
        ctx.strokeStyle = faceCol;
        ctx.lineWidth = 2;
        ctx.strokeRect(fx, fy, fw, fh);

        // Corner bracket markers
        const cLen = 16;
        ctx.lineWidth = 3;
        ctx.strokeStyle = faceCol;
        // TL
        ctx.beginPath(); ctx.moveTo(fx, fy + cLen); ctx.lineTo(fx, fy); ctx.lineTo(fx + cLen, fy); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(fx + fw - cLen, fy); ctx.lineTo(fx + fw, fy); ctx.lineTo(fx + fw, fy + cLen); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(fx, fy + fh - cLen); ctx.lineTo(fx, fy + fh); ctx.lineTo(fx + cLen, fy + fh); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(fx + fw - cLen, fy + fh); ctx.lineTo(fx + fw, fy + fh); ctx.lineTo(fx + fw, fy + fh - cLen); ctx.stroke();

        // Face label
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(fx, fy - 18, 82, 16);
        ctx.fillStyle = faceCol;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('FACE  DETECTED', fx + 3, fy - 5);

        // Eye dots
        const eyeY  = fy + fh * 0.28;
        const lEyeX = fx + fw * 0.31;
        const rEyeX = fx + fw * 0.69;
        const eyesOpen = status.eyes_detected !== false;
        const eyeCol   = eyesOpen ? 'rgba(0,230,80,0.95)' : 'rgba(255,60,60,0.95)';

        [lEyeX, rEyeX].forEach(ex => {
          ctx.fillStyle = eyeCol;
          ctx.beginPath(); ctx.arc(ex, eyeY, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(ex, eyeY, 2.5, 0, Math.PI * 2); ctx.fill();
          // Iris ring
          ctx.strokeStyle = eyesOpen ? 'rgba(0,255,120,0.6)' : 'rgba(255,80,80,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(ex, eyeY, 9, 0, Math.PI * 2); ctx.stroke();
        });

        // Eye label under eyes
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = eyeCol;
        ctx.fillText(eyesOpen ? 'EYES OPEN' : 'EYES CLOSED', fx + fw / 2, eyeY + 20);
        if (!eyesOpen) {
          const ear = status.ear || 0;
          ctx.fillStyle = 'rgba(255,100,0,0.9)';
          ctx.fillText(`EAR: ${ear.toFixed ? ear.toFixed(3) : ear}`, fx + fw / 2, eyeY + 32);
        }

        // Head direction arrow from nose
        const noseX = fx + fw / 2;
        const noseY = fy + fh * 0.55;
        const yaw   = (status.yaw   || 0) * Math.PI / 180;
        const pitch = (status.pitch || 0) * Math.PI / 180;
        const dx = Math.sin(yaw)   * 38;
        const dy = Math.sin(pitch) * 38;
        const angle = Math.atan2(dy, dx);

        ctx.strokeStyle = 'rgba(0,210,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(noseX, noseY); ctx.lineTo(noseX + dx, noseY + dy); ctx.stroke();
        ctx.fillStyle = 'rgba(0,210,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(noseX + dx, noseY + dy);
        ctx.lineTo(noseX + dx - 9 * Math.cos(angle - 0.4), noseY + dy - 9 * Math.sin(angle - 0.4));
        ctx.lineTo(noseX + dx - 9 * Math.cos(angle + 0.4), noseY + dy - 9 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();

        // Phone detection zone indicator (upper frame)
        if (status.phone_detected) {
          ctx.strokeStyle = 'rgba(220,38,38,0.9)';
          ctx.lineWidth = 2.5;
          const px = fx + fw * 0.1, py = fy + fh * 0.05;
          const pw = fw * 0.3, ph = fh * 0.35;
          ctx.strokeRect(px, py, pw, ph);
          ctx.fillStyle = 'rgba(220,38,38,0.85)';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('PHONE 📱', px, py - 4);
        }
      } else {
        // No face — show "FACE NOT FOUND" in center
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W * 0.2, H * 0.35, W * 0.6, 40);
        ctx.strokeStyle = 'rgba(239,68,68,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(W * 0.2, H * 0.35, W * 0.6, 40);
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f87171';
        ctx.fillText('⚠  FACE NOT DETECTED', W / 2, H * 0.35 + 26);
      }

      // Flashing alert border
      if (status.alert && status.alert !== 'focused') {
        const blink = Math.sin(frameIdx * 0.14) > 0;
        if (blink) {
          const bw = 8;
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;
          ctx.lineWidth = bw;
          ctx.strokeRect(bw / 2, bw / 2, W - bw, H - bw);
          // Inner second border
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
          ctx.strokeRect(bw + 3, bw + 3, W - (bw + 3) * 2, H - (bw + 3) * 2);
        }
      }

      // "DRIVER MONITORING" badge bottom-left
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(6, H - 22, 185, 16);
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('DRIVER MONITORING · DEMO MODE', 10, H - 9);

      rafHandle = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (rafHandle) cancelAnimationFrame(rafHandle); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={640} height={360}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Critical alert banner (phone / drowsy) ───────────────────────────────────

function CriticalAlertBanner({ alert, busId, driver, onDismiss }) {
  const meta = alertMeta(alert);
  if (!alert || alert === 'focused' || meta.severity < 2) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', borderRadius: 10,
      border: `2px solid ${meta.border}`,
      backgroundColor: meta.bg,
      boxShadow: `0 4px 24px ${meta.color}44`,
      animation: 'blink 1s infinite',
    }}>
      <meta.Icon size={28} color={meta.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: meta.color }}>
          CRITICAL DRIVER ALERT — {busId}
        </div>
        <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 1 }}>
          {meta.label} · {driver}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date().toLocaleTimeString()}</div>
      <button onClick={onDismiss} style={{
        background: 'none', border: `1px solid ${meta.border}`,
        borderRadius: 6, cursor: 'pointer', fontSize: 13,
        color: meta.color, padding: '3px 8px', fontWeight: 700,
      }}>Dismiss</button>
    </div>
  );
}

// ─── Toast (non-critical alerts) ─────────────────────────────────────────────

function AlertToast({ alert, busId, driver, onDismiss }) {
  const meta = alertMeta(alert);
  if (!alert || alert === 'focused' || meta.severity >= 2) return null;
  return (
    <div style={{
      position: 'fixed', top: 76, right: 22, zIndex: 9999,
      width: 340, padding: '13px 16px', borderRadius: 12,
      border: `2px solid ${meta.border}`, backgroundColor: meta.bg,
      boxShadow: `0 8px 32px ${meta.color}44`,
      animation: 'slideIn .25s ease',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(110%); opacity:0 } to { transform:none; opacity:1 } }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.45} }
      `}</style>
      <meta.Icon size={24} color={meta.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: meta.color, marginBottom: 2 }}>Driver Alert — {busId}</div>
        <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{meta.label}</div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{driver} · {new Date().toLocaleTimeString()}</div>
      </div>
      <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:meta.color }}>✕</button>
    </div>
  );
}

// ─── Bus selector ─────────────────────────────────────────────────────────────

function BusSelectorPanel({ buses, selectedBusId, onSelect, onRefresh, loading }) {
  const active   = buses.filter(b => b.active !== false);
  const inactive = buses.filter(b => b.active === false);

  const BusCard = ({ bus }) => {
    const meta     = alertMeta(bus.driver_alert || 'focused');
    const selected = bus.bus_id === selectedBusId;
    const isActive = bus.active !== false;

    return (
      <button onClick={() => isActive && onSelect(bus.bus_id)} style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '9px 11px', borderRadius: 9, textAlign: 'left',
        cursor: isActive ? 'pointer' : 'not-allowed',
        opacity: isActive ? 1 : 0.55,
        border: selected ? '2px solid #3b82f6'
          : meta.severity >= 2 ? `2px solid ${meta.border}`
          : isActive ? '2px solid #e5e7eb' : '2px solid #d1d5db',
        backgroundColor: selected ? '#eff6ff' : isActive ? '#fff' : '#f3f4f6',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
        transition: 'all .15s', position: 'relative', overflow: 'hidden',
      }}>
        {meta.severity >= 1 && isActive && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            backgroundColor: meta.color,
            animation: meta.severity >= 2 ? 'blink 1s infinite' : 'none',
          }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: selected ? '#1d4ed8' : isActive ? '#111827' : '#9ca3af' }}>
            {bus.bus_id}
          </span>
          {isActive ? (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8,
                            backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                            animation: meta.severity >= 2 ? 'blink 1s infinite' : 'none', whiteSpace: 'nowrap' }}>
              {meta.label}
            </span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8,
                            backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #d1d5db' }}>
              ○ Offline
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: isActive ? '#6b7280' : '#b0b7c3',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bus.driver || '—'} · {bus.route || '—'}
        </div>
        {isActive && (
          <div style={{ fontSize: 10, fontWeight: 600, color: bus.on_bus > 0 ? '#059669' : '#9ca3af' }}>
            {bus.on_bus > 0 ? `${bus.on_bus} passengers` : 'Empty'}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Fleet ({buses.length})
        </span>
        <button onClick={onRefresh} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', padding: 2 }}>
          {loading ? '⏳' : '↻'}
        </button>
      </div>
      {active.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 1 }}>
            ● Active ({active.length})
          </div>
          {active.map(bus => <BusCard key={bus.bus_id} bus={bus} />)}
        </>
      )}
      {inactive.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 6, marginBottom: 1 }}>
            ○ Inactive ({inactive.length})
          </div>
          {inactive.map(bus => <BusCard key={bus.bus_id} bus={bus} />)}
        </>
      )}
    </div>
  );
}

// ─── Shared camera controls ───────────────────────────────────────────────────

function CamIconBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: '1px solid #d1d5db', borderRadius: 5,
      cursor: 'pointer', padding: '2px 7px', fontSize: 13, color: '#6b7280',
      lineHeight: 1, display: 'flex', alignItems: 'center', transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none';    e.currentTarget.style.color = '#6b7280'; }}
    >
      {children}
    </button>
  );
}

function CamMaxOverlay({ title, onClose, onMinimize, children }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const overlayBtn = (onClick, label, tip) => (
    <button onClick={onClick} title={tip} style={{
      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 6, color: '#e2e8f0', cursor: 'pointer',
      fontSize: 13, padding: '5px 13px', fontWeight: 500, transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
    >{label}</button>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: 1400, height: '100%',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, flexShrink: 0,
        }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onMinimize && overlayBtn(onMinimize, '— Minimize', 'Collapse panel')}
            {overlayBtn(onClose, '✕ Close', 'Exit fullscreen (Esc)')}
          </div>
        </div>

        {/* Video — fills remaining height, capped by aspect ratio */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '100%', aspectRatio: '16/9', maxHeight: '100%',
              overflow: 'hidden', borderRadius: 10, position: 'relative',
            }}>
              {children}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: '#374151', flexShrink: 0 }}>
          Esc · click outside · or — Minimize to collapse
        </div>
      </div>
    </div>
  );
}

// ─── Passenger camera panel ───────────────────────────────────────────────────

function PassengerCameraPanel({ busId, counter }) {
  const { frameUrl, connected, status } = useWebSocketCamera(busId, 'passenger');
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const isLive = connected && !!frameUrl;

  // Badge: LIVE → DISCONNECTED → CONNECTING → DEMO
  const badge = connected && frameUrl
    ? { text: '● LIVE',          bg: '#dcfce7', color: '#166534', border: '#86efac' }
    : status === 'connecting'
    ? { text: '◉ CONNECTING',    bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' }
    : frameUrl   // frozen last frame — was live, now dropped
    ? { text: '✕ DISCONNECTED', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
    : { text: '◎ DEMO',          bg: '#fef3c7', color: '#92400e', border: '#fde68a' };

  return (
    <>
      {maximized && (
        <CamMaxOverlay
          title={`Passenger Camera — ${busId}`}
          onClose={() => setMaximized(false)}
          onMinimize={() => { setMaximized(false); setCollapsed(true); }}
        >
          {isLive ? (
            <>
              <img src={frameUrl} alt="passenger cam"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                         backgroundColor: '#051a0e' }} />
              <div style={{ position: 'absolute', top: 8, left: 8,
                            backgroundColor: 'rgba(0,0,0,.70)', padding: '3px 9px', borderRadius: 6,
                            fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                {busId} · 3-ZONE COUNTER
              </div>
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: '#051a0e' }}>
              <PassengerDetectionCanvas counter={counter} />
            </div>
          )}
        </CamMaxOverlay>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Title bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
            Passenger Camera — {busId}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>3-ZONE DETECTION</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            backgroundColor: badge.bg, color: badge.color,
                            border: `1px solid ${badge.border}` }}>
              {badge.text}
            </span>
            <CamIconBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? '▲' : '▼'}
            </CamIconBtn>
            <CamIconBtn onClick={() => setMaximized(true)} title="Maximize">⛶</CamIconBtn>
          </div>
        </div>

        {/* Video / canvas */}
        {!collapsed && (
          <div style={{
            position: 'relative', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden',
            border: `2px solid ${isLive ? '#059669' : '#1a3a2e'}`,
            boxShadow: isLive ? '0 0 18px #05966933' : 'none',
            backgroundColor: '#051a0e',
          }}>
            {isLive ? (
              <>
                <img src={frameUrl} alt="passenger cam"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                <div style={{ position: 'absolute', top: 8, left: 8,
                              backgroundColor: 'rgba(0,0,0,.70)', padding: '3px 9px', borderRadius: 6,
                              fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                  {busId} · 3-ZONE COUNTER
                </div>
              </>
            ) : (
              <PassengerDetectionCanvas counter={counter} />
            )}
          </div>
        )}

        {/* Counter tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'On Bus',  value: counter.on_bus,  color: '#059669', bg: '#f0fdf4', border: '#86efac' },
            { label: 'Entered', value: counter.entered, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Exited',  value: counter.exited,  color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                                       backgroundColor: bg, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 2, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Driver camera panel ──────────────────────────────────────────────────────

function DriverCameraPanel({ busId, bus, driverStatus, alertMeta: meta }) {
  const { frameUrl } = useWebSocketCamera(busId, 'driver');
  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const serverFrameRef = useRef(false);
  const [webcamOn,   setWebcamOn]   = useState(false);
  const [camErr,     setCamErr]     = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);
  const [maximized,  setMaximized]  = useState(false);

  if (frameUrl && !serverFrameRef.current) serverFrameRef.current = true;

  useEffect(() => {
    serverFrameRef.current = false;
    if (!busId) return;
    let stopped = false;
    const timer = setTimeout(() => {
      if (stopped || serverFrameRef.current) return;
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          if (stopped || serverFrameRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setWebcamOn(true);
        })
        .catch(() => { if (!stopped) setCamErr(true); });
    }, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setWebcamOn(false);
      setCamErr(false);
    };
  }, [busId]);

  const serverStreaming = !!frameUrl;
  useEffect(() => {
    if (serverStreaming && webcamOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setWebcamOn(false);
    }
  }, [serverStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const showServer      = !!frameUrl;
  const showWebcam      = !showServer && webcamOn;
  const showPlaceholder = !showServer && !webcamOn;
  const isLive          = showServer || showWebcam;

  const videoContent = (
    <div style={{
      position: 'relative', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden',
      backgroundColor: '#0a0a0a',
      border: `2px solid ${meta.severity > 0 ? meta.border : isLive ? '#374151' : '#1f2937'}`,
      boxShadow: meta.severity > 0 ? `0 0 20px ${meta.color}44` : 'none',
      transition: 'border-color .3s, box-shadow .3s',
    }}>
      {showServer && (
        <img src={frameUrl} alt="driver cam" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
      )}
      <video ref={videoRef} autoPlay playsInline muted style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', transform: 'scaleX(-1)',
        display: showWebcam ? 'block' : 'none',
      }} />
      {showWebcam && (
        <DriverOverlayCanvas driverStatus={driverStatus} alertMeta={meta} />
      )}
      {isLive && !showServer && (
        <>
          <div style={{ position: 'absolute', top: 8, left: 8,
                        backgroundColor: 'rgba(0,0,0,.70)', padding: '3px 9px', borderRadius: 6,
                        fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            {busId} · {bus?.driver || 'Driver'}
          </div>
          <div style={{
            position: 'absolute', top: 8, right: 8,
            backgroundColor: meta.severity > 0 ? meta.color : 'rgba(5,150,105,.85)',
            padding: '3px 10px', borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: '#fff',
            animation: meta.severity >= 2 ? 'blink 1s infinite' : 'none',
          }}>
            {meta.label.toUpperCase()}
          </div>
        </>
      )}
      {showPlaceholder && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 10,
                      background: 'linear-gradient(135deg,#0f172a,#1e293b)' }}>
          <User size={40} color="#94a3b8" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{busId} — Driver Camera</div>
            <div style={{ fontSize: 10, color: camErr ? '#f87171' : '#94a3b8', marginTop: 4 }}>
              {camErr ? 'Camera permission denied' : 'Connecting…'}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {maximized && (
        <CamMaxOverlay
          title={`Driver Camera — ${busId}`}
          onClose={() => setMaximized(false)}
          onMinimize={() => { setMaximized(false); setCollapsed(true); }}
        >
          {showServer ? (
            <img src={frameUrl} alt="driver cam"
              style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#0a0a0a' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg,#0f172a,#1e293b)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 48 }}>👤</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
                {camErr ? 'Camera permission denied'
                  : showWebcam ? 'Webcam active in panel — server feed not available'
                  : 'Camera connecting…'}
              </div>
            </div>
          )}
        </CamMaxOverlay>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
            👤 Driver Camera — {busId}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>BEHAVIOUR ANALYSIS</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            backgroundColor: showServer ? '#dcfce7' : showWebcam ? '#eff6ff' : '#f3f4f6',
                            color: showServer ? '#166534' : showWebcam ? '#1d4ed8' : '#6b7280',
                            border: `1px solid ${showServer ? '#86efac' : showWebcam ? '#bfdbfe' : '#d1d5db'}` }}>
              {showServer ? '● SERVER' : showWebcam ? '● WEBCAM' : '○ OFFLINE'}
            </span>
            <CamIconBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? '▲' : '▼'}
            </CamIconBtn>
            <CamIconBtn onClick={() => setMaximized(true)} title="Maximize">⛶</CamIconBtn>
          </div>
        </div>

        {/* Video container */}
        {!collapsed && videoContent}
      </div>
    </>
  );
}

// ─── Driver status metrics panel ──────────────────────────────────────────────

function DriverStatusPanel({ busId, bus, driverStatus, simAlerts }) {
  const status = driverStatus;
  const meta   = alertMeta(status?.alert || 'focused');
  if (!busId) return null;

  const alerts = simAlerts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Alert badge */}
      <div style={{ padding: '10px 14px', borderRadius: 10, border: `2px solid ${meta.border}`,
                    backgroundColor: meta.bg, display: 'flex', alignItems: 'center', gap: 10,
                    animation: status?.alert !== 'focused' ? 'blink 1.2s infinite' : 'none' }}>
        <meta.Icon size={22} color={meta.color} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: meta.color }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
            {bus?.driver || busId} · Driver Monitor
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#9ca3af' }}>SEVERITY</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: meta.color }}>{meta.severity}/3</div>
        </div>
      </div>

      {/* Detection indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
        {[
          { label: 'Face',  value: status?.face_detected  ? 'Detected' : 'Not Found', ok: status?.face_detected  !== false },
          { label: 'Eyes',  value: status?.eyes_detected  ? 'Open'     : 'Closed',    ok: status?.eyes_detected  !== false },
          { label: 'Phone', value: status?.phone_detected ? 'DETECTED' : 'Clear',     ok: !status?.phone_detected },
        ].map(({ label, value, ok }) => (
          <div key={label} style={{ padding: '7px 5px', borderRadius: 8, textAlign: 'center',
                                     border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
                                     backgroundColor: ok ? '#f0fdf4' : '#fef2f2' }}>
            <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: ok ? '#059669' : '#dc2626' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Metric gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
        {[
          { label: 'EAR',   value: status?.ear   != null ? Number(status.ear).toFixed(3)   : '—',
            note: status?.ear < 0.21 ? 'LOW' : 'OK', noteCol: status?.ear < 0.21 ? '#dc2626' : '#059669' },
          { label: 'Yaw',   value: status?.yaw   != null ? `${Number(status.yaw)  > 0 ? '+' : ''}${Number(status.yaw).toFixed(0)}°` : '—',
            note: Math.abs(status?.yaw  || 0) > 35 ? 'HIGH' : 'OK', noteCol: Math.abs(status?.yaw  || 0) > 35 ? '#dc2626' : '#059669' },
          { label: 'Pitch', value: status?.pitch != null ? `${Number(status.pitch) > 0 ? '+' : ''}${Number(status.pitch).toFixed(0)}°` : '—',
            note: (status?.pitch || 0) < -20 ? 'LOW' : 'OK', noteCol: (status?.pitch || 0) < -20 ? '#dc2626' : '#059669' },
        ].map(({ label, value, note, noteCol }) => (
          <div key={label} style={{ padding: '5px', borderRadius: 7, textAlign: 'center',
                                     backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{value}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: noteCol }}>{note}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
        FPS: {status?.fps || '—'}
      </div>

      {/* Alert history */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Alert History</div>
          <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {alerts.slice(0, 8).map((a, i) => {
              const m = alertMeta(a.alert);
              return (
                <div key={i} style={{ padding: '5px 9px', borderRadius: 6, fontSize: 11,
                                       backgroundColor: m.bg, border: `1px solid ${m.border}`,
                                       display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: m.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><m.Icon size={11} />{m.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CameraPage() {
  const [buses,         setBuses]         = useState(MOCK_BUSES);
  const [busesLoading,  setBusesLoading]  = useState(false);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [showEvents,    setShowEvents]    = useState(false);
  const [toast,         setToast]         = useState(null);
  const [criticalBanner, setCriticalBanner] = useState(null);
  const toastDismissRef = useRef(null);

  const { counter, events, health, resetCounter } = useCounterData(selectedBusId, 1500);
  const selectedBus = buses.find(b => b.bus_id === selectedBusId);

  // Real server driver status (if camera_server.py is running)
  const { status: serverStatus, online: serverOnline, alerts: serverAlerts } = useServerDriverStatus(selectedBusId);
  // Simulated fallback
  const { status: simStatus, alerts: simAlerts } = useSimulatedDriverStatus(selectedBusId);

  // Prefer server data; fall back to simulation
  const driverStatus = serverOnline && serverStatus ? serverStatus : simStatus;
  const driverAlerts = serverOnline && serverAlerts.length > 0 ? serverAlerts : simAlerts;
  const driverMeta   = alertMeta(driverStatus?.alert || 'focused');
  const prevAlertRef = useRef('focused');

  // Handle alert changes — toast / banner / sound
  useEffect(() => {
    if (!selectedBusId) return;
    const alert = driverStatus?.alert;
    if (!alert || alert === prevAlertRef.current) return;
    prevAlertRef.current = alert;

    if (alert !== 'focused') {
      playAlertSound(alert);
      const payload = { alert, busId: selectedBusId, driver: selectedBus?.driver };
      if (alertMeta(alert).severity >= 2) {
        setCriticalBanner(payload);
        clearTimeout(toastDismissRef.current);
        toastDismissRef.current = setTimeout(() => setCriticalBanner(null), 10000);
      } else {
        setToast(payload);
        clearTimeout(toastDismissRef.current);
        toastDismissRef.current = setTimeout(() => setToast(null), 6000);
      }
    }
  }, [driverStatus?.alert, selectedBusId, selectedBus?.driver]);

  // Propagate alert to bus list indicator
  useEffect(() => {
    if (!selectedBusId) return;
    setBuses(prev => prev.map(b =>
      b.bus_id === selectedBusId ? { ...b, driver_alert: driverStatus?.alert || 'focused' } : b
    ));
  }, [driverStatus?.alert, selectedBusId]);

  const fetchBuses = useCallback(async () => {
    setBusesLoading(true);
    // Try camera server first for live bus list
    try {
      const res = await fetch(`${CAMERA_SERVER_REST}/api/buses`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data.buses && data.buses.length > 0) {
          const merged = data.buses.map(b => ({
            ...MOCK_BUSES.find(m => m.bus_id === b.bus_id) || {},
            ...b, active: true,
          }));
          setBuses(merged);
          if (!selectedBusId) setSelectedBusId(merged[0]?.bus_id);
          setBusesLoading(false);
          return;
        }
      }
    } catch { /* fall through to mock */ }
    setBuses(MOCK_BUSES);
    if (!selectedBusId) setSelectedBusId(MOCK_BUSES.find(b => b.active !== false)?.bus_id || null);
    setBusesLoading(false);
  }, [selectedBusId]);

  useEffect(() => { fetchBuses(); }, [fetchBuses]);

  useEffect(() => {
    if (!selectedBusId) {
      const first = buses.find(b => b.active !== false);
      if (first) setSelectedBusId(first.bus_id);
    }
  }, [buses, selectedBusId]);

  const handleReset = async () => {
    if (window.confirm(`Reset passenger counter for ${selectedBusId}?`)) {
      await resetCounter();
    }
  };

  const camServerHealth = health?.status === 'ok';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes slideIn { from { transform:translateX(110%); opacity:0 } to { transform:none; opacity:1 } }
      `}</style>

      {/* Toast (distracted — severity 1) */}
      {toast && (
        <AlertToast alert={toast.alert} busId={toast.busId} driver={toast.driver}
          onDismiss={() => { setToast(null); clearTimeout(toastDismissRef.current); }} />
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: '2px solid #e5e7eb', paddingBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
            Bus Camera Monitor
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
            Passenger 3-zone entry/exit counter · Driver behaviour analysis (phone, drowsiness, distraction)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedBusId && (
            <div style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          backgroundColor: driverMeta.bg, color: driverMeta.color,
                          border: `2px solid ${driverMeta.border}`,
                          animation: driverStatus?.alert !== 'focused' ? 'blink 1s infinite' : 'none' }}>
              {selectedBusId}: {driverMeta.label}
            </div>
          )}
          <div style={{ padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        backgroundColor: serverOnline ? '#f0fdf4' : camServerHealth ? '#f0fdf4' : '#f9fafb',
                        color: serverOnline || camServerHealth ? '#166534' : '#6b7280',
                        border: `1px solid ${serverOnline || camServerHealth ? '#86efac' : '#d1d5db'}` }}>
            {serverOnline ? '● Camera Server Live' : camServerHealth ? '● API Online' : '○ Demo Mode'}
          </div>
          {selectedBusId && (
            <button onClick={handleReset} style={{
              padding: '7px 13px', borderRadius: 8, border: '2px solid #3b82f6',
              backgroundColor: '#fff', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            }}>
              ↺ Reset Counter
            </button>
          )}
        </div>
      </div>

      {/* ── Critical alert banner ── */}
      {criticalBanner && (
        <CriticalAlertBanner
          alert={criticalBanner.alert}
          busId={criticalBanner.busId}
          driver={criticalBanner.driver}
          onDismiss={() => { setCriticalBanner(null); clearTimeout(toastDismissRef.current); }}
        />
      )}

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>

        {/* LEFT: fleet selector */}
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12,
                      border: '1px solid #e5e7eb', height: 'fit-content', position: 'sticky', top: 20 }}>
          <BusSelectorPanel buses={buses} selectedBusId={selectedBusId}
            onSelect={setSelectedBusId} onRefresh={fetchBuses} loading={busesLoading} />
        </div>

        {/* RIGHT: camera content */}
        <div key={selectedBusId} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {!selectedBusId ? (
            <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 48,
                          border: '2px dashed #d1d5db', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🚌</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Select an Active Bus
              </div>
              <div style={{ fontSize: 12 }}>Choose a bus from the fleet list on the left.</div>
            </div>
          ) : (
            <>
              {/* ── Camera feeds side by side ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Passenger camera + counter */}
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14,
                              border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PassengerCameraPanel busId={selectedBusId} counter={counter} />
                </div>

                {/* Driver camera + status */}
                <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14,
                              border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <DriverCameraPanel
                    busId={selectedBusId}
                    bus={selectedBus}
                    driverStatus={driverStatus}
                    alertMeta={driverMeta}
                  />
                  <DriverStatusPanel
                    key={selectedBusId}
                    busId={selectedBusId}
                    bus={selectedBus}
                    driverStatus={driverStatus}
                    simAlerts={driverAlerts}
                  />
                </div>
              </div>

              {/* ── Status bar ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '11px 16px',
                            border: '1px solid #e5e7eb', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: 'Bus',          value: selectedBusId },
                  { label: 'Driver',       value: selectedBus?.driver  || '—' },
                  { label: 'Route',        value: selectedBus?.route   || '—' },
                  { label: 'Passengers',   value: counter.on_bus },
                  { label: 'Total Buses',  value: buses.length },
                  { label: 'Active Buses', value: buses.filter(b => b.active !== false).length },
                  { label: 'Driver Alert', value: driverMeta.label, color: driverMeta.color },
                  { label: 'Data Source',  value: serverOnline ? 'Camera Server' : 'Demo', color: serverOnline ? '#059669' : '#6b7280' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: color || '#111827', marginTop: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* ── Passenger events log ── */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              marginBottom: showEvents || counter.last_event ? 10 : 0 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>
                    Passenger Events — {selectedBusId}
                  </h3>
                  <button onClick={() => setShowEvents(s => !s)} style={{
                    padding: '4px 12px', borderRadius: 6, border: '2px solid #059669',
                    backgroundColor: showEvents ? '#ecfdf5' : '#fff',
                    color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  }}>
                    {showEvents ? '▲ Hide' : '▼ Show'}
                  </button>
                </div>

                {counter.last_event ? (
                  <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#f9fafb',
                                border: counter.last_event.event === 'ENTER' ? '2px solid #93c5fd' : '2px solid #fca5a5',
                                display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {[
                      { label: 'Event',    value: counter.last_event.event === 'ENTER' ? '↓ ENTRY' : '↑ EXIT',
                        color: counter.last_event.event === 'ENTER' ? '#3b82f6' : '#ef4444' },
                      { label: 'Track ID', value: `#${counter.last_event.tid}`, color: '#111827' },
                      { label: 'On Bus',   value: counter.last_event.on_bus,    color: '#059669' },
                      { label: 'Time',     value: new Date(counter.last_event.timestamp).toLocaleTimeString(), color: '#6b7280' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 10, backgroundColor: '#f9fafb', borderRadius: 8,
                                textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    No events yet for {selectedBusId}
                  </div>
                )}

                {showEvents && events.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 8 }}>
                    {events.map((evt, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        borderBottom: i < events.length - 1 ? '1px solid #f3f4f6' : 'none',
                        display: 'grid', gridTemplateColumns: '70px 60px 70px 80px 90px',
                        gap: 8, fontSize: 11, alignItems: 'center',
                      }}>
                        <span style={{ color: evt.event === 'ENTER' ? '#3b82f6' : '#ef4444', fontWeight: 700 }}>
                          {evt.event === 'ENTER' ? '↓ ENTER' : '↑ EXIT'}
                        </span>
                        <span style={{ color: '#374151' }}>#{evt.tid}</span>
                        <span style={{ color: '#6b7280' }}>F{evt.frame}</span>
                        <span style={{ color: '#059669', fontWeight: 600 }}>On: {evt.on_bus}</span>
                        <span style={{ color: '#9ca3af' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
