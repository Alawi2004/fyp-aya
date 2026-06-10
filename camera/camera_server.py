"""
=============================================================================
 MULTI-BUS CAMERA SERVER  —  FastAPI + WebSocket  v3
=============================================================================

 Each bus gets:
   • Passenger camera  — 3-zone door counting   (real_camera.py logic)
   • Driver camera     — driver behaviour monitor (driver_monitor.py)

 Single-camera laptop mode
 ──────────────────────────
   When passenger_source == driver_source (e.g. both = 0), a SharedCamera
   reads frames once and distributes them to both sessions — no double
   VideoCapture conflict.

 Endpoints
 ─────────
   REST
     GET  /api/health
     GET  /api/buses
     POST /api/bus/register          { bus_id, passenger_source, driver_source }
     DELETE /api/bus/{bus_id}
     GET  /api/bus/{bus_id}/counter
     POST /api/bus/{bus_id}/counter/reset
     GET  /api/bus/{bus_id}/events
     GET  /api/bus/{bus_id}/driver/status
     GET  /api/bus/{bus_id}/driver/alerts

   WebSocket
     WS  /ws/bus/{bus_id}/passenger  — live JPEG (annotated passenger cam)
     WS  /ws/bus/{bus_id}/driver     — live JPEG (annotated driver cam)

   Legacy (backwards-compat single-bus)
     GET  /api/counter
     GET  /api/events
     WS   /ws/video

 Run
 ───
   pip install fastapi uvicorn opencv-python ultralytics mediapipe
   python camera_server.py
   python camera_server.py --host 0.0.0.0 --port 9000 --buses-config buses_config.json
=============================================================================
"""

import asyncio
import argparse
import json
import threading
import time
import urllib.request as _urllib
import cv2
import numpy as np
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# URL of the Node.js backend — override via env var NODE_BACKEND_URL
import os as _os
NODE_BACKEND = _os.environ.get("NODE_BACKEND_URL", "http://localhost:5000")


def _forward_to_backend(path: str, payload: dict):
    """Fire-and-forget POST to the Node.js backend.  Never raises or blocks."""
    def _send():
        try:
            data = json.dumps(payload).encode()
            req  = _urllib.Request(
                f"{NODE_BACKEND}{path}", data=data,
                headers={"Content-Type": "application/json"}, method="POST",
            )
            _urllib.urlopen(req, timeout=2)
        except Exception:
            pass   # Node backend offline — silently skip
    threading.Thread(target=_send, daemon=True).start()

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    raise SystemExit("Install FastAPI: pip install fastapi uvicorn")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[Server] WARNING: ultralytics not installed — AI detection disabled")

from driver_monitor import DriverMonitor

# ─── import proper 3-zone passenger counter from real_camera.py ───────────────
try:
    from real_camera import (
        TrackerMemory,
        PassengerCounter,
        draw_scene,
        ZONE_LEFT_FRAC,
        ZONE_RIGHT_FRAC,
        ENTER_IS_LEFT_TO_RIGHT,
        CONF_THRESH  as _RC_CONF,
        IOU_THRESH   as _RC_IOU,
        DEFAULT_MODEL as _RC_MODEL,
    )
    REAL_CAMERA_OK = True
    print("[Server] real_camera.py loaded — 3-zone passenger counter active")
except Exception as _e:
    REAL_CAMERA_OK = False
    print(f"[Server] WARNING: real_camera.py not importable ({_e})")
    print("         Using simplified inline counter")
    # fallback constants
    ZONE_LEFT_FRAC          = 0.35
    ZONE_RIGHT_FRAC         = 0.65
    ENTER_IS_LEFT_TO_RIGHT  = True
    _RC_CONF                = 0.35
    _RC_IOU                 = 0.45
    _RC_MODEL               = "yolov8n.pt"

PASS_FRAME_W = 640
PASS_FRAME_H = 480


# =============================================================================
#  SharedCamera
#  One VideoCapture instance shared by multiple sessions (same physical camera)
# =============================================================================

class SharedCamera:
    """
    Opens a camera once and exposes .read() to multiple consumers.
    Runs a background reader thread so both passenger and driver sessions
    can call .read() independently without competing for the capture object.
    """

    def __init__(self, source, frame_w: int = PASS_FRAME_W, frame_h: int = PASS_FRAME_H):
        self.source = source
        self._cap   = cv2.VideoCapture(source)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  frame_w)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, frame_h)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self._cap.isOpened():
            raise RuntimeError(f"[SharedCamera] Cannot open source: {source}")

        self._frame: Optional[np.ndarray] = None
        self._lock   = threading.Lock()
        self._running = True
        self._thread  = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()
        print(f"[SharedCamera] Opened source {source}")

    def _reader(self):
        while self._running:
            ret, frame = self._cap.read()
            if ret:
                with self._lock:
                    self._frame = frame
            else:
                time.sleep(0.01)

    def read(self) -> tuple:
        """Returns (True, frame_copy) or (False, None) if no frame yet."""
        with self._lock:
            if self._frame is None:
                return False, None
            return True, self._frame.copy()

    def release(self):
        self._running = False
        self._thread.join(timeout=2)
        self._cap.release()
        print(f"[SharedCamera] Released source {self.source}")


# =============================================================================
#  FALLBACK 3-zone counter (used when real_camera.py is not importable)
# =============================================================================

if not REAL_CAMERA_OK:
    # Minimal re-implementation so the server still works without real_camera.py

    HISTORY_LEN      = 20
    SMOOTH_LEN       = 6
    MIN_CROSS_SPEED  = 2
    REENTRY_COOLDOWN = 45

    class TrackerMemory:
        MAX_MISSING = 15
        def __init__(self):
            self._tracks = {}

        def update(self, detections):
            seen = set()
            for d in detections:
                tid = d["tid"]
                cx  = (d["x1"] + d["x2"]) // 2
                seen.add(tid)
                if tid not in self._tracks:
                    self._tracks[tid] = _TS(tid)
                ts = self._tracks[tid]
                ts.history.append(cx)
                ts.frames_missing = 0
            stale = [t for t, s in self._tracks.items()
                     if t not in seen and (s.__dict__.__setitem__('frames_missing', s.frames_missing + 1) or s.frames_missing) > self.MAX_MISSING]
            for t in stale:
                del self._tracks[t]
            return list(self._tracks.values())

        def all_tracks(self):
            return self._tracks

    class _TS:
        def __init__(self, tid):
            self.tid             = tid
            self.history         = deque(maxlen=HISTORY_LEN)
            self.zone_state      = "unknown"
            self.counted_state   = "unknown"
            self.last_counted_frame = -999
            self.frames_missing  = 0

        @property
        def smooth_cx(self):
            if not self.history: return None
            return float(np.mean(list(self.history)[-SMOOTH_LEN:]))

        @property
        def velocity_x(self):
            if len(self.history) < 3: return None
            pts = list(self.history)
            diffs = [pts[i] - pts[i-1] for i in range(1, min(len(pts), 6))]
            return float(np.mean(diffs))

    class PassengerCounter:
        def __init__(self, zone_left, zone_right, enter_is_ltr=True):
            self.zone_left   = zone_left
            self.zone_right  = zone_right
            self.enter_is_ltr = enter_is_ltr
            self.entered     = 0
            self.exited      = 0

        @property
        def on_bus(self):
            return max(self.entered - self.exited, 0)

        def _region(self, cx):
            if cx < self.zone_left:  return "left_side"
            if cx > self.zone_right: return "right_side"
            return "in_zone"

        def _semantic(self, geo):
            if self.enter_is_ltr:
                return {"left_side": "outside", "right_side": "inside"}.get(geo, geo)
            return {"left_side": "inside", "right_side": "outside"}.get(geo, geo)

        def process(self, tracks, frame_idx):
            events = []
            for ts in tracks:
                cx = ts.smooth_cx
                if cx is None: continue
                geo = self._region(cx)
                sem = self._semantic(geo) if geo != "in_zone" else "in_zone"
                if ts.zone_state == "unknown":
                    ts.zone_state = ts.counted_state = sem
                    continue
                prev = ts.zone_state
                ts.zone_state = sem
                if prev != "in_zone" or sem == "in_zone": continue
                vel = ts.velocity_x
                if vel is not None and abs(vel) < MIN_CROSS_SPEED: continue
                if (frame_idx - ts.last_counted_frame) <= REENTRY_COOLDOWN: continue
                if sem == "inside" and ts.counted_state != "inside":
                    self.entered += 1
                    ts.counted_state = "inside"
                    ts.last_counted_frame = frame_idx
                    events.append(self._evt(ts.tid, "ENTER", frame_idx))
                elif sem == "outside" and ts.counted_state != "outside":
                    self.exited += 1
                    ts.counted_state = "outside"
                    ts.last_counted_frame = frame_idx
                    events.append(self._evt(ts.tid, "EXIT", frame_idx))
            return events

        def _evt(self, tid, etype, fi):
            return {
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "frame": fi, "tid": tid, "event": etype, "on_bus": self.on_bus,
            }

        def reset(self):
            self.entered = self.exited = 0

    C_ZONE  = (0, 55,  0)
    C_LL    = (0, 210, 80)
    C_LR    = (0, 120, 255)
    C_OUT   = (255, 200, 0)
    C_IN    = (0, 255, 120)
    C_ZONE_ = (0, 210, 255)
    C_BG    = (10, 10, 10)

    def draw_scene(frame, detections, all_tracks, counter, zl, zr, fps,
                   event_log=None, flash_event=None):
        H, W = frame.shape[:2]
        ov = frame.copy()
        cv2.rectangle(ov, (zl, 0), (zr, H), C_ZONE, -1)
        cv2.addWeighted(ov, 0.22, frame, 0.78, 0, frame)
        cv2.line(frame, (zl, 0), (zl, H), C_LL, 2)
        cv2.line(frame, (zr, 0), (zr, H), C_LR, 2)
        mid = H // 4
        cv2.putText(frame, "OUTSIDE",   (max(zl//2-28,2), mid), cv2.FONT_HERSHEY_SIMPLEX, 0.55, C_OUT, 2)
        cv2.putText(frame, "INSIDE",    (zr+(W-zr)//2-25, mid), cv2.FONT_HERSHEY_SIMPLEX, 0.55, C_IN,  2)
        cv2.putText(frame, "DOOR ZONE", ((zl+zr)//2-40,   mid), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200,200,200), 1)
        if flash_event:
            fc = (0,255,120) if flash_event.get("event") == "ENTER" else (0,100,255)
            cv2.rectangle(frame, (8,8), (W-8, H-8), fc, 8)
        det_by_tid = {d["tid"]: d for d in detections}
        for ts in all_tracks.values():
            if ts.frames_missing > 0: continue
            det = det_by_tid.get(ts.tid)
            if det is None: continue
            color = {"outside": C_OUT, "inside": C_IN, "in_zone": C_ZONE_}.get(ts.zone_state, (200,200,200))
            cv2.rectangle(frame, (det["x1"], det["y1"]), (det["x2"], det["y2"]), color, 2)
            cv2.putText(frame, f"#{ts.tid} {ts.zone_state.upper()}", (det["x1"], det["y1"]-4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, color, 1)
        pw, ph = 210, 110
        ov2 = frame.copy()
        cv2.rectangle(ov2, (W-pw, 0), (W, ph), C_BG, -1)
        cv2.addWeighted(ov2, 0.70, frame, 0.30, 0, frame)
        cv2.putText(frame, "PASSENGER CAM", (W-pw+8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160,160,160), 1)
        cv2.putText(frame, f"ON BUS : {counter.on_bus}", (W-pw+8, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.80, C_IN, 2)
        cv2.putText(frame, f"Entered: {counter.entered}", (W-pw+8, 66), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255,200,0), 1)
        cv2.putText(frame, f"Exited : {counter.exited}",  (W-pw+8, 86), cv2.FONT_HERSHEY_SIMPLEX, 0.52, C_LR, 1)
        cv2.putText(frame, f"FPS {fps:.1f}", (W-pw+8, ph-6), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (110,110,110), 1)
        if event_log:
            recent   = list(event_log)[-4:]
            ticker_h = 16 * len(recent) + 10
            ty_base  = H - ticker_h
            ov3 = frame.copy()
            cv2.rectangle(ov3, (0, ty_base), (W, H), C_BG, -1)
            cv2.addWeighted(ov3, 0.70, frame, 0.30, 0, frame)
            for i, evt in enumerate(reversed(recent)):
                fade = 1.0 - i * 0.20
                ec = tuple(int(v * fade) for v in ((0,255,120) if evt["event"] == "ENTER" else (0,100,255)))
                ts_s = evt.get("timestamp","")[-8:]
                cv2.putText(frame, f"{evt['event']}  #{evt['tid']}  on_bus={evt['on_bus']}  {ts_s}",
                            (8, ty_base + 13 + i * 16),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, ec, 1)
        return frame


# =============================================================================
#  PassengerCameraSession  —  3-zone door counter
# =============================================================================

class PassengerCameraSession:
    """
    Runs the full 3-zone passenger counter in a background thread.
    Optionally accepts a SharedCamera when the source is shared with driver cam.
    """

    def __init__(self, bus_id: str, source, shared_cam: Optional[SharedCamera] = None,
                 capacity: int = 30):
        self.bus_id     = bus_id
        self.source     = source
        self._shared    = shared_cam
        self._capacity  = capacity     # vehicle seat capacity

        # ── YOLO ──────────────────────────────────────────────────────────────
        self._yolo = None
        if YOLO_AVAILABLE:
            try:
                self._yolo = YOLO(_RC_MODEL)
                print(f"[PassengerCam][Bus {bus_id}] YOLO loaded ({_RC_MODEL})")
            except Exception as e:
                print(f"[PassengerCam][Bus {bus_id}] YOLO error: {e}")

        # ── zone counters ──────────────────────────────────────────────────────
        zone_left  = int(PASS_FRAME_W * ZONE_LEFT_FRAC)
        zone_right = int(PASS_FRAME_W * ZONE_RIGHT_FRAC)
        self._memory  = TrackerMemory()
        self._counter = PassengerCounter(zone_left, zone_right, ENTER_IS_LEFT_TO_RIGHT)
        self._zone_left  = zone_left
        self._zone_right = zone_right

        self._events: deque = deque(maxlen=200)
        self._fps        = 0.0
        self._frame_idx  = 0
        self._flash_event = None
        self._flash_until = 0

        self._lock    = threading.Lock()
        self._running = False
        self._paused  = False
        self._thread: Optional[threading.Thread] = None
        self._latest_jpeg: Optional[bytes] = None
        self._cap: Optional[cv2.VideoCapture] = None

    # ── control ───────────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        if self._cap:
            self._cap.release()

    def pause(self):  self._paused = True
    def resume(self): self._paused = False

    def reset(self):
        with self._lock:
            self._counter.reset()
            self._memory  = TrackerMemory()
            self._events.clear()
            self._frame_idx = 0

    # ── data access ───────────────────────────────────────────────────────────

    def get_counter(self) -> dict:
        with self._lock:
            last    = list(self._events)[-1] if self._events else None
            on_bus  = self._counter.on_bus
            return {
                # ── spec-compliant fields ─────────────────────────────────────
                "current_passengers": on_bus,
                "entries":            self._counter.entered,
                "exits":              self._counter.exited,
                "available_seats":    max(0, self._capacity - on_bus),
                "capacity":           self._capacity,
                # ── legacy / internal fields ──────────────────────────────────
                "entered":    self._counter.entered,
                "exited":     self._counter.exited,
                "on_bus":     on_bus,
                "fps":        round(self._fps, 1),
                "last_event": last,
                "bus_id":     self.bus_id,
            }

    def get_events(self, limit: int = 50) -> list:
        with self._lock:
            return list(self._events)[-limit:]

    def get_latest_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._latest_jpeg

    # ── main loop ─────────────────────────────────────────────────────────────

    def _loop(self):
        use_shared = self._shared is not None

        if not use_shared:
            self._cap = cv2.VideoCapture(self.source)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  PASS_FRAME_W)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, PASS_FRAME_H)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not self._cap.isOpened():
                print(f"[PassengerCam][Bus {self.bus_id}] Cannot open: {self.source}")
                self._running = False
                return

        fps_buf = deque(maxlen=30)
        t_prev  = time.perf_counter()

        while self._running:
            if self._paused:
                time.sleep(0.05)
                continue

            # ── read frame ────────────────────────────────────────────────────
            if use_shared:
                ret, frame = self._shared.read()
            else:
                ret, frame = self._cap.read()

            if not ret or frame is None:
                if not use_shared:
                    src = self.source
                    if isinstance(src, str) and Path(src).is_file():
                        self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                time.sleep(0.02)
                continue

            self._frame_idx += 1
            fi = self._frame_idx

            # ── YOLO detect + ByteTrack ───────────────────────────────────────
            detections = []
            if self._yolo is not None:
                results = self._yolo.track(
                    frame, persist=True,
                    conf=_RC_CONF, iou=_RC_IOU,
                    classes=[0], tracker="bytetrack.yaml",
                    verbose=False,
                )
                boxes = results[0].boxes
                if boxes.id is not None:
                    for box in boxes:
                        tid = int(box.id[0])
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        detections.append(
                            dict(tid=tid, x1=x1, y1=y1, x2=x2, y2=y2,
                                 conf=float(box.conf[0])))

            # ── update tracker + counter ──────────────────────────────────────
            tracks = self._memory.update(detections)
            events = self._counter.process(tracks, fi)

            with self._lock:
                for evt in events:
                    self._events.append(evt)
                    self._flash_event = evt
                    self._flash_until = fi + 18
                    # Forward to Node.js backend for DB logging (non-blocking)
                    _forward_to_backend("/api/camera/passenger-events", {
                        "bus_id":           self.bus_id,
                        "event_type":       evt["event"],
                        "track_id":         evt["tid"],
                        "passenger_count":  self._counter.on_bus,
                        "available_seats":  max(0, self._capacity - self._counter.on_bus),
                    })
                if fi > self._flash_until:
                    self._flash_event = None

            # ── FPS ───────────────────────────────────────────────────────────
            t_now = time.perf_counter()
            fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
            t_prev = t_now
            fps    = float(np.mean(fps_buf))
            with self._lock:
                self._fps = fps

            # ── annotate (3-zone scene) ───────────────────────────────────────
            with self._lock:
                cur_events = list(self._events)
                flash_now  = self._flash_event

            ann = draw_scene(
                frame.copy(), detections,
                self._memory.all_tracks(), self._counter,
                self._zone_left, self._zone_right, fps,
                event_log=cur_events,
                flash_event=flash_now,
            )

            _, jpeg = cv2.imencode(
                ".jpg", ann, [cv2.IMWRITE_JPEG_QUALITY, 75])
            with self._lock:
                self._latest_jpeg = jpeg.tobytes()

        if self._cap:
            self._cap.release()


# =============================================================================
#  BusCameraSession  —  groups passenger + driver cameras for one bus
# =============================================================================

@dataclass
class BusCameraSession:
    bus_id:           str
    passenger_source: object
    driver_source:    object
    capacity:         int = 30   # vehicle seat capacity

    passenger_cam: Optional[PassengerCameraSession] = field(default=None, init=False)
    driver_cam:    Optional[DriverMonitor]           = field(default=None, init=False)
    shared_cam:    Optional[SharedCamera]            = field(default=None, init=False)
    registered_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def start(self):
        # If both cams share the same physical camera, open it once
        if self.passenger_source == self.driver_source:
            try:
                self.shared_cam = SharedCamera(self.passenger_source)
            except RuntimeError as e:
                print(f"[BusCameraSession] {e}")
                self.shared_cam = None

        # Passenger cam
        self.passenger_cam = PassengerCameraSession(
            self.bus_id, self.passenger_source,
            shared_cam=self.shared_cam,
            capacity=self.capacity,
        )

        # Driver cam
        self.driver_cam = DriverMonitor(
            source=self.driver_source, bus_id=self.bus_id)
        if self.shared_cam is not None:
            self.driver_cam._shared_cam = self.shared_cam

        self.passenger_cam.start()
        self.driver_cam.start()
        print(f"[BusCameraSession] Bus {self.bus_id} started "
              f"(passenger={self.passenger_source}, driver={self.driver_source}"
              f"{', shared' if self.shared_cam else ''})")

    def stop(self):
        if self.passenger_cam:
            self.passenger_cam.stop()
        if self.driver_cam:
            self.driver_cam.stop()
        if self.shared_cam:
            self.shared_cam.release()
        print(f"[BusCameraSession] Bus {self.bus_id} stopped")


# =============================================================================
#  FastAPI app
# =============================================================================

app = FastAPI(title="Multi-Bus Camera Server", version="3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_sessions: dict[str, BusCameraSession] = {}
_sessions_lock = threading.Lock()


# ── REST ──────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    with _sessions_lock:
        buses = list(_sessions.keys())
    return {"status": "ok", "buses": buses, "timestamp": datetime.now().isoformat()}


@app.get("/api/buses")
def list_buses():
    with _sessions_lock:
        result = []
        for bus_id, sess in _sessions.items():
            pc = sess.passenger_cam
            dc = sess.driver_cam
            ds = dc.get_status() if dc else {}
            ct = pc.get_counter() if pc else {}
            result.append({
                "bus_id":           bus_id,
                "passenger_source": str(sess.passenger_source),
                "driver_source":    str(sess.driver_source),
                "on_bus":           ct.get("on_bus", 0),
                "driver_alert":     ds.get("alert", "unknown"),
                "registered_at":    sess.registered_at,
            })
    return {"buses": result}


@app.post("/api/bus/register")
def register_bus(body: dict):
    bus_id = str(body.get("bus_id", "")).strip()
    if not bus_id:
        raise HTTPException(400, "bus_id is required")
    p_src = body.get("passenger_source", 0)
    d_src = body.get("driver_source", 0)
    for v in [p_src, d_src]:
        try:
            v = int(v)
        except (ValueError, TypeError):
            pass
    capacity = body.get("capacity", 30)
    try: capacity = int(capacity)
    except (ValueError, TypeError): capacity = 30

    with _sessions_lock:
        if bus_id in _sessions:
            _sessions[bus_id].stop()
        sess = BusCameraSession(bus_id=bus_id, passenger_source=p_src,
                                driver_source=d_src, capacity=capacity)
        sess.start()
        _sessions[bus_id] = sess
    return {"ok": True, "bus_id": bus_id}


@app.delete("/api/bus/{bus_id}")
def remove_bus(bus_id: str):
    with _sessions_lock:
        sess = _sessions.pop(bus_id, None)
    if not sess:
        raise HTTPException(404, f"Bus {bus_id} not found")
    sess.stop()
    return {"ok": True, "bus_id": bus_id}


@app.get("/api/bus/{bus_id}/counter")
def get_counter(bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.passenger_cam:
        raise HTTPException(404, f"Bus {bus_id} not found")
    return sess.passenger_cam.get_counter()


@app.get("/api/bus/{bus_id}/events")
def get_events(bus_id: str, limit: int = 50):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.passenger_cam:
        raise HTTPException(404, f"Bus {bus_id} not found")
    return sess.passenger_cam.get_events(limit)


@app.post("/api/bus/{bus_id}/counter/reset")
def reset_counter(bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.passenger_cam:
        raise HTTPException(404, f"Bus {bus_id} not found")
    sess.passenger_cam.reset()
    return {"ok": True, "bus_id": bus_id}


@app.get("/api/bus/{bus_id}/driver/status")
def get_driver_status(bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.driver_cam:
        raise HTTPException(404, f"Bus {bus_id} not found")
    return sess.driver_cam.get_status()


@app.get("/api/bus/{bus_id}/driver/alerts")
def get_driver_alerts(bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.driver_cam:
        raise HTTPException(404, f"Bus {bus_id} not found")
    return {"alerts": sess.driver_cam.get_alert_history(), "bus_id": bus_id}


# ── Spec-compliant endpoints ─────────────────────────────────────────────────

@app.get("/api/passenger/status")
def passenger_status_spec(bus_id: Optional[str] = Query(default=None)):
    """
    Spec endpoint — GET /api/passenger/status
    Returns: current_passengers, entries, exits, available_seats, capacity
    """
    with _sessions_lock:
        sess = _sessions.get(bus_id) if bus_id else next(iter(_sessions.values()), None)
    if not sess or not sess.passenger_cam:
        return {"current_passengers": 0, "entries": 0, "exits": 0,
                "available_seats": 0, "capacity": 30}
    ct = sess.passenger_cam.get_counter()
    return {
        "current_passengers": ct["on_bus"],
        "entries":            ct["entered"],
        "exits":              ct["exited"],
        "available_seats":    ct["available_seats"],
        "capacity":           ct["capacity"],
        "fps":                ct["fps"],
        "bus_id":             ct["bus_id"],
    }


@app.get("/api/driver/status")
def driver_status_spec(bus_id: Optional[str] = Query(default=None)):
    """
    Spec endpoint — GET /api/driver/status
    Returns: state, confidence, alert (bool), + detail metrics
    """
    with _sessions_lock:
        sess = _sessions.get(bus_id) if bus_id else next(iter(_sessions.values()), None)
    if not sess or not sess.driver_cam:
        return {"state": "unknown", "confidence": 0, "alert": False}
    ds = sess.driver_cam.get_status()
    return {
        "state":      ds.get("state", ds.get("alert", "unknown")),
        "confidence": ds.get("confidence", 0),
        "alert":      bool(ds.get("alert", False)),
        "details": {
            "face_detected":  ds.get("face_detected"),
            "eyes_detected":  ds.get("eyes_detected"),
            "phone_detected": ds.get("phone_detected"),
            "ear":            ds.get("ear"),
            "perclos":        ds.get("perclos"),
            "yaw":            ds.get("yaw"),
            "pitch":          ds.get("pitch"),
            "gaze":           ds.get("gaze"),
            "fps":            ds.get("fps"),
        },
        "bus_id":    ds.get("bus_id"),
        "timestamp": ds.get("timestamp"),
    }


# ── Driver alert forwarding task ──────────────────────────────────────────────

_prev_driver_alerts: dict = {}

async def _driver_alert_forwarder():
    """Background task: detects driver alert transitions and forwards to Node backend."""
    global _prev_driver_alerts
    while True:
        await asyncio.sleep(2)
        with _sessions_lock:
            sessions = dict(_sessions)
        for bus_id, sess in sessions.items():
            if not sess.driver_cam:
                continue
            ds    = sess.driver_cam.get_status()
            alert = ds.get("state", ds.get("alert_label", "focused"))
            if _prev_driver_alerts.get(bus_id) != alert:
                _prev_driver_alerts[bus_id] = alert
                if alert != "focused":
                    _forward_to_backend("/api/camera/driver-alerts", {
                        "bus_id":     bus_id,
                        "alert_type": alert,
                        "confidence": ds.get("confidence", 0),
                    })


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_driver_alert_forwarder())


# ── Legacy backwards-compat ───────────────────────────────────────────────────

@app.get("/api/counter")
def compat_counter():
    with _sessions_lock:
        if not _sessions:
            return {"entered": 0, "exited": 0, "on_bus": 0, "fps": 0, "last_event": None}
        sess = next(iter(_sessions.values()))
    return sess.passenger_cam.get_counter() if sess.passenger_cam else {}


@app.get("/api/events")
def compat_events(limit: int = 50):
    with _sessions_lock:
        if not _sessions:
            return []
        sess = next(iter(_sessions.values()))
    return sess.passenger_cam.get_events(limit) if sess.passenger_cam else []


# ── WebSocket streaming ───────────────────────────────────────────────────────

async def _stream(websocket: WebSocket, get_frame_fn, interval: float = 0.04):
    await websocket.accept()
    try:
        while True:
            jpeg = get_frame_fn()
            if jpeg:
                await websocket.send_bytes(jpeg)
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] error: {e}")


@app.websocket("/ws/bus/{bus_id}/passenger")
async def ws_passenger(websocket: WebSocket, bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.passenger_cam:
        await websocket.close(code=4004)
        return
    await _stream(websocket, sess.passenger_cam.get_latest_jpeg)


@app.websocket("/ws/bus/{bus_id}/driver")
async def ws_driver(websocket: WebSocket, bus_id: str):
    with _sessions_lock:
        sess = _sessions.get(bus_id)
    if not sess or not sess.driver_cam:
        await websocket.close(code=4004)
        return

    def get_frame():
        jpeg, _ = sess.driver_cam.get_latest()
        return jpeg

    await _stream(websocket, get_frame)


@app.websocket("/ws/video")
async def ws_legacy(websocket: WebSocket):
    with _sessions_lock:
        sess = next(iter(_sessions.values()), None) if _sessions else None
    if not sess or not sess.passenger_cam:
        await websocket.accept()
        await websocket.close(code=4004)
        return
    await _stream(websocket, sess.passenger_cam.get_latest_jpeg)


# =============================================================================
#  Startup: auto-register buses from JSON config
# =============================================================================

def _load_config(path: str):
    if not Path(path).exists():
        return
    with open(path) as f:
        buses = json.load(f)
    for bus in buses:
        bus_id = str(bus.get("bus_id", "")).strip()
        if not bus_id:
            continue
        p_src    = bus.get("passenger_source", 0)
        d_src    = bus.get("driver_source",    0)
        capacity = bus.get("capacity",         30)
        try: p_src    = int(p_src)
        except (ValueError, TypeError): pass
        try: d_src    = int(d_src)
        except (ValueError, TypeError): pass
        try: capacity = int(capacity)
        except (ValueError, TypeError): capacity = 30

        sess = BusCameraSession(bus_id=bus_id, passenger_source=p_src,
                                driver_source=d_src, capacity=capacity)
        sess.start()
        _sessions[bus_id] = sess


# =============================================================================
#  Entry point
# =============================================================================

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host",         default="0.0.0.0")
    ap.add_argument("--port",         type=int, default=9000)
    ap.add_argument("--buses-config", default="buses_config.json")
    args = ap.parse_args()

    _load_config(args.buses_config)

    print(f"\n[Server] Starting on http://{args.host}:{args.port}")
    print(f"[Server] Passenger counter: {'real_camera.py (3-zone)' if REAL_CAMERA_OK else 'fallback inline'}")
    print(f"[Server] Register bus: POST /api/bus/register")
    print(f"[Server] List buses:   GET  /api/buses\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
