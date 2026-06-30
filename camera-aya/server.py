"""
camera-aya/server.py
====================
Unified FastAPI camera server using the modular camera-aya implementations.

Exposes the same WebSocket + REST API as camera/camera_server.py so the
admin CameraPage.jsx requires zero changes.

Endpoints
---------
WebSocket
  WS  /ws/bus/{bus_id}/passenger   – live annotated JPEG from passenger cam
  WS  /ws/bus/{bus_id}/driver      – live annotated JPEG from driver cam

REST
  GET  /api/health
  GET  /api/buses
  POST /api/bus/register            { bus_id, passenger_source, driver_source, capacity }
  DEL  /api/bus/{bus_id}
  GET  /api/bus/{bus_id}/counter
  POST /api/bus/{bus_id}/counter/reset
  GET  /api/bus/{bus_id}/events
  GET  /api/bus/{bus_id}/driver/status
  GET  /api/bus/{bus_id}/driver/alerts
  GET  /api/passenger/status        (spec-compliant)
  GET  /api/driver/status           (spec-compliant)

Run
---
  cd camera-aya
  python server.py
  python server.py --port 9000 --buses-config buses_config.json
"""

import argparse
import asyncio
import json
import os
import sys
import threading
import time
import types
import urllib.request as _urllib
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

# =============================================================================
#  Path setup
# =============================================================================

_SERVER_DIR    = os.path.dirname(os.path.abspath(__file__))
_PASSENGER_DIR = os.path.join(_SERVER_DIR, "passenger")
_DRIVER_DIR    = os.path.join(_SERVER_DIR, "driver")

# Prefer the bundled model file; ultralytics will download if neither exists
_YOLO_PATH = os.path.join(_PASSENGER_DIR, "yolov8n.pt")
if not os.path.isfile(_YOLO_PATH):
    _YOLO_PATH = os.path.join(_DRIVER_DIR, "yolov8n.pt")
if not os.path.isfile(_YOLO_PATH):
    _YOLO_PATH = "yolov8n.pt"   # let ultralytics download it

# =============================================================================
#  Node.js backend forwarding (fire-and-forget)
# =============================================================================

NODE_BACKEND = os.environ.get("NODE_BACKEND_URL", "http://localhost:4000")

# When a driver's phone connects to the ingest WebSocket, also open this local
# camera as the bus's PASSENGER counter (so the laptop webcam appears in admin
# alongside the phone driver feed). Set to "none"/"off"/"-1" to disable, or to a
# different webcam index / video-file path.
def _parse_ingest_passenger_source():
    v = os.environ.get("INGEST_PASSENGER_SOURCE", "0").strip()
    if v.lower() in ("", "none", "off", "-1", "false"):
        return None
    try:
        return int(v)
    except ValueError:
        return v   # treat as a file path / device string

INGEST_PASSENGER_SOURCE = _parse_ingest_passenger_source()

# Phones send near-full-resolution frames (e.g. 1004x1920). Running MediaPipe +
# YOLO on frames that large is slow and makes the admin video lag. Downscale so
# the longest side is at most this many pixels before the AI runs — still plenty
# of detail for face/eye/phone detection, far less CPU + bandwidth.
INGEST_MAX_DIM = int(os.environ.get("INGEST_MAX_DIM", "720") or "720")


def _forward(path: str, payload: dict):
    def _send():
        try:
            data = json.dumps(payload).encode()
            req  = _urllib.Request(
                f"{NODE_BACKEND}{path}", data=data,
                headers={"Content-Type": "application/json"}, method="POST",
            )
            _urllib.urlopen(req, timeout=2)
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


# =============================================================================
#  Merged config module
#  Must be installed in sys.modules["config"] BEFORE any camera-aya module
#  is imported, because those modules do "from config import Config" at import
#  time (or in lazy per-call imports).
# =============================================================================

_cfg_mod = types.ModuleType("config")


class _Config:
    # ── Passenger ─────────────────────────────────────────────────────────────
    CAMERA_INDEX             = 0
    FRAME_WIDTH              = 1280
    FRAME_HEIGHT             = 720
    YOLO_MODEL               = _YOLO_PATH
    PERSON_CLASS_ID          = 0
    DETECTION_CONF           = 0.50
    TRACKER                  = "bytetrack.yaml"
    LINE_ORIENTATION         = "vertical"
    LINE_A_POSITION          = 0.35
    LINE_B_POSITION          = 0.65
    ENTRY_DIRECTION          = "left_to_right"
    LINE_FLASH_SECS          = 0.7
    BUS_CAPACITY             = 50
    DB_FILE                  = "logs/passenger_data.db"
    LOG_FILE                 = "logs/passenger_log.csv"
    EXPORT_JSON              = "logs/live_data.json"
    EXPORT_INTERVAL_SECS     = 5
    SNAPSHOT_INTERVAL_SECS   = 30
    API_HOST                 = "0.0.0.0"
    API_PORT                 = 5050
    # ── Driver ────────────────────────────────────────────────────────────────
    EAR_THRESHOLD                  = 0.22
    EYE_CLOSED_ALERT_SECS          = 2.0
    GAZE_AWAY_ALERT_SECS           = 3.0
    LOOK_DOWN_ALERT_SECS           = 2.0
    PHONE_ALERT_SECS               = 1.5
    NO_FACE_ALERT_SECS             = 3.0
    GAZE_YAW_THRESHOLD             = 20
    GAZE_PITCH_DOWN_THRESHOLD      = 10
    GAZE_PITCH_UP_THRESHOLD        = 15
    PHONE_CONF_THRESHOLD           = 0.45
    PHONE_CONF_THRESHOLD_NEAR_FACE = 0.28
    PHONE_CLASS_ID                 = 67
    YOLO_SKIP_FRAMES               = 3
    PHONE_PROXIMITY_FACTOR         = 1.8
    HAND_EAR_X_EXTEND              = 1.0
    HAND_EAR_Y_TOP_EXTEND          = 0.2
    HAND_EAR_Y_BOT_EXTEND          = 0.15
    HAND_DETECT_CONFIDENCE         = 0.60
    # PERCLOS
    PERCLOS_WINDOW_SECS            = 60.0
    PERCLOS_DROWSY_THRESHOLD       = 0.15
    DROWSY_ALERT_SECS              = 0.0
    # Seatbelt
    SEATBELT_MODEL                 = "seatbelt.pt"
    SEATBELT_CONF_THRESHOLD        = 0.40
    SEATBELT_OFF_ALERT_SECS        = 2.0
    # Phone logging
    PHONE_LOG_DETECTIONS           = True
    PHONE_DETECTION_LOG            = "logs/phone_detections.csv"


_cfg_mod.Config = _Config
sys.modules["config"] = _cfg_mod

# =============================================================================
#  Import passenger modules
#  Add passenger/ to sys.path, import everything needed, then clear the
#  'utils' namespace so the driver's utils.drawing can be loaded fresh.
# =============================================================================

sys.path.insert(0, _PASSENGER_DIR)

from counter.people_tracker import PeopleTracker   # noqa: E402
from counter.line_counter   import LineCounter      # noqa: E402
import utils.drawing as _pd                         # noqa: E402

# Keep named references to every passenger drawing function we need
_pass_draw_zone_bgs       = _pd.draw_zone_backgrounds
_pass_draw_flash          = _pd.draw_crossing_flash
_pass_draw_lines          = _pd.draw_counting_lines
_pass_draw_tracks         = _pd.draw_tracks
_pass_draw_stats          = _pd.draw_stats_panel
_pass_draw_events         = _pd.draw_recent_events

# Purge cached 'utils' so driver can import its own utils.drawing
for _k in list(sys.modules.keys()):
    if _k == "utils" or _k.startswith("utils."):
        del sys.modules[_k]

sys.path.remove(_PASSENGER_DIR)

# =============================================================================
#  Import driver modules
#  Add driver/ to sys.path and import. After this, 'utils.drawing' in
#  sys.modules refers to driver's version (which is what we want for lazy
#  draw_status_panel calls that do "from config import Config").
# =============================================================================

sys.path.insert(0, _DRIVER_DIR)

from detectors.face_detector     import FaceDetector     # noqa: E402
from detectors.eye_detector      import EyeDetector, PERCLOSTracker  # noqa: E402
from detectors.gaze_estimator    import GazeEstimator    # noqa: E402
from detectors.phone_detector    import PhoneDetector    # noqa: E402
from detectors.seatbelt_detector import SeatbeltDetector # noqa: E402
from alerts.alert_manager        import AlertManager     # noqa: E402
import utils.drawing as _dd                         # noqa: E402

_drv_draw_status    = _dd.draw_status_panel
_drv_draw_alerts    = _dd.draw_alerts
_drv_draw_phones    = _dd.draw_phone_boxes
_drv_draw_gaze      = _dd.draw_gaze_arrow
_drv_draw_face_box  = _dd.draw_face_box
_drv_draw_fps       = _dd.draw_fps
_drv_draw_event_log = _dd.draw_event_log

sys.path.remove(_DRIVER_DIR)

# Ensure the merged config stays available for any future lazy imports
sys.modules["config"] = _cfg_mod

print("[camera-aya] Passenger + driver modules loaded successfully.")

# =============================================================================
#  FastAPI
# =============================================================================

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    raise SystemExit("pip install fastapi uvicorn")


# =============================================================================
#  SharedCamera — one VideoCapture shared by both sessions (same device)
# =============================================================================

class SharedCamera:
    def __init__(self, source, w: int = 1280, h: int = 720):
        self._cap = cv2.VideoCapture(source)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  w)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not self._cap.isOpened():
            raise RuntimeError(f"[SharedCamera] Cannot open source {source}")
        self._frame: Optional[np.ndarray] = None
        self._lock    = threading.Lock()
        self._running = True
        self._thread  = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()
        print(f"[SharedCamera] Opened source {source}")

    def _reader(self):
        while self._running:
            ret, f = self._cap.read()
            if ret:
                with self._lock:
                    self._frame = f
            else:
                time.sleep(0.01)

    def read(self):
        with self._lock:
            if self._frame is None:
                return False, None
            return True, self._frame.copy()

    def release(self):
        self._running = False
        self._thread.join(timeout=2)
        self._cap.release()


# =============================================================================
#  PassengerCameraSession
# =============================================================================

class PassengerCameraSession:

    def __init__(self, bus_id: str, source,
                 shared_cam: Optional[SharedCamera] = None,
                 capacity: int = 50):
        self.bus_id    = bus_id
        self.source    = source
        self._shared   = shared_cam
        self._capacity = capacity

        self._tracker: PeopleTracker = PeopleTracker()
        self._line_counter: Optional[LineCounter] = None   # created on first frame

        self._events: deque        = deque(maxlen=200)
        self._recent_events: list  = []
        self._fps                  = 0.0
        self._frame_count: int     = 0

        self._lock    = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._latest_jpeg: Optional[bytes]       = None
        self._cap: Optional[cv2.VideoCapture]    = None

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

    def reset(self):
        with self._lock:
            if self._line_counter:
                self._line_counter.reset()
            self._events.clear()
            self._recent_events.clear()

    # ── data access ───────────────────────────────────────────────────────────

    def get_counter(self) -> dict:
        with self._lock:
            lc = self._line_counter
            if not lc:
                return {
                    "current_passengers": 0, "entries": 0, "exits": 0,
                    "available_seats": self._capacity, "capacity": self._capacity,
                    "on_bus": 0, "entered": 0, "exited": 0,
                    "fps": 0.0, "bus_id": self.bus_id, "last_event": None,
                }
            on_bus = lc.current_count
            return {
                "current_passengers": on_bus,
                "entries":            lc.total_entries,
                "exits":              lc.total_exits,
                "available_seats":    max(0, self._capacity - on_bus),
                "capacity":           self._capacity,
                "on_bus":             on_bus,
                "entered":            lc.total_entries,
                "exited":             lc.total_exits,
                "fps":                round(self._fps, 1),
                "bus_id":             self.bus_id,
                "last_event":         list(self._events)[-1] if self._events else None,
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
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  _Config.FRAME_WIDTH)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, _Config.FRAME_HEIGHT)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not self._cap.isOpened():
                print(f"[PassengerCam][{self.bus_id}] Cannot open source {self.source}")
                self._running = False
                return

        fps_buf = deque(maxlen=30)
        t_prev  = time.perf_counter()

        while self._running:
            try:
                ret, frame = (self._shared.read() if use_shared
                              else self._cap.read())
                if not ret or frame is None:
                    time.sleep(0.02)
                    continue

                h, w = frame.shape[:2]
                now  = time.perf_counter()

                self._frame_count += 1
                frame_no = self._frame_count

                with self._lock:
                    if self._line_counter is None:
                        self._line_counter = LineCounter(frame_w=w, frame_h=h)

                try:
                    tracks = self._tracker.track(frame)
                except Exception:
                    tracks = []

                active_ids = []
                with self._lock:
                    lc = self._line_counter
                    for (tid, x1, y1, x2, y2, _conf) in tracks:
                        active_ids.append(tid)
                        cx = (x1 + x2) // 2
                        cy = (y1 + y2) // 2
                        event = lc.update(tid, cx, cy, now)
                        if event:
                            on_bus = lc.current_count
                            self._events.append({
                                "timestamp": datetime.now().isoformat(timespec="seconds"),
                                "event":     event.upper(),
                                "tid":       tid,
                                "on_bus":    on_bus,
                                "frame":     frame_no,
                            })
                            self._recent_events.insert(0, {
                                "time":     datetime.now().strftime("%H:%M:%S"),
                                "type":     event,
                                "track_id": tid,
                                "count":    on_bus,
                            })
                            self._recent_events = self._recent_events[:6]
                            _forward("/api/camera/passenger-events", {
                                "bus_id":          self.bus_id,
                                "event_type":      event.upper(),
                                "track_id":        tid,
                                "passenger_count": on_bus,
                                "available_seats": max(0, self._capacity - on_bus),
                            })
                    lc.cleanup_stale_tracks(active_ids)

                fps_buf.append(1.0 / max(now - t_prev, 1e-6))
                t_prev = now

                with self._lock:
                    self._fps = float(np.mean(fps_buf))
                    fps = self._fps
                    lc  = self._line_counter
                    re  = list(self._recent_events)

                _pass_draw_zone_bgs(frame, lc)
                _pass_draw_flash(frame, lc, now)
                _pass_draw_lines(frame, lc, now)
                _pass_draw_tracks(frame, tracks, lc)
                _pass_draw_stats(frame, lc, fps, now)
                _pass_draw_events(frame, re)

                _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                with self._lock:
                    self._latest_jpeg = jpeg.tobytes()

            except Exception as e:
                print(f"[PassengerCam][{self.bus_id}] frame error: {e}")
                time.sleep(0.05)

        if self._cap:
            self._cap.release()


# =============================================================================
#  DriverCameraSession
# =============================================================================

_ALERT_STATE_MAP = {
    "EYES_CLOSED":    "drowsy",
    "DROWSY":         "drowsy",
    "PHONE_DETECTED": "phone_detected",
    "GAZE_LEFT":      "distracted",
    "GAZE_RIGHT":     "distracted",
    "GAZE_DOWN":      "distracted",
    "SEATBELT_OFF":   "seatbelt_off",
    "NO_FACE":        "no_face",
}


class DriverCameraSession:

    def __init__(self, bus_id: str, source,
                 shared_cam: Optional[SharedCamera] = None,
                 external: bool = False):
        self.bus_id  = bus_id
        self.source  = source
        self._shared = shared_cam
        # External (ingest) mode: frames are pushed in via submit_frame()
        # instead of being read from a local VideoCapture / SharedCamera.
        self._external      = external
        self._input_frame: Optional[np.ndarray] = None
        # Auto-orientation for phone frames: find the rotation that yields a
        # face, then lock it (handles iOS/Android orientation differences).
        self._rotation     = 0
        self._rot_locked   = False
        self._rot_attempts = 0

        self._face_det     = FaceDetector()
        self._eye_det      = EyeDetector()
        self._perclos      = PERCLOSTracker()
        self._gaze_est     = GazeEstimator()
        self._phone_det    = PhoneDetector()
        self._seatbelt_det = SeatbeltDetector()
        self._alert_mgr    = AlertManager()

        self._status: dict = {
            "state": "unknown", "confidence": 0, "alert": False,
            "face_detected": False, "eyes_closed": False, "gaze": "unknown",
            "phone_detected": False, "ear": 0.0,
            "perclos": 0.0, "perclos_drowsy": False,
            "seatbelt_on": True,
            "fps": 0.0,
            "bus_id": bus_id, "timestamp": datetime.now().isoformat(),
        }
        self._alert_history: list        = []
        self._recent_events: deque       = deque(maxlen=5)
        self._vote_buf:      deque       = deque(maxlen=30)
        self._prev_alert                 = "focused"

        self._lock    = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._latest_jpeg: Optional[bytes]       = None
        self._cap: Optional[cv2.VideoCapture]    = None

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
        try:
            self._face_det.close()
            self._phone_det.close()
        except Exception:
            pass

    # ── data access ───────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        with self._lock:
            return dict(self._status)

    def get_alert_history(self) -> list:
        with self._lock:
            return list(self._alert_history)

    def get_latest(self) -> tuple:
        with self._lock:
            return self._latest_jpeg, dict(self._status)

    def submit_frame(self, frame: np.ndarray):
        """Push a frame from an external source (e.g. the driver's phone)."""
        with self._lock:
            self._input_frame = frame

    _ROT_CODES = {90: cv2.ROTATE_90_CLOCKWISE,
                  180: cv2.ROTATE_180,
                  270: cv2.ROTATE_90_COUNTERCLOCKWISE}

    def _rotate(self, frame, deg):
        if deg == 0:
            return frame
        return cv2.rotate(frame, self._ROT_CODES[deg])

    def _orient(self, frame):
        """Return an upright frame. Until a face is found, periodically try each
        rotation and lock onto the one that works. Never gives up permanently —
        if the driver isn't visible at startup it keeps searching (throttled)
        until a face appears, so it can't lock onto the wrong orientation."""
        if self._rot_locked:
            return self._rotate(frame, self._rotation)
        self._rot_attempts += 1
        # Throttle the 4× search so we don't burn CPU while no face is visible.
        if self._rot_attempts % 3 == 0:
            for deg in (0, 90, 270, 180):
                cand = self._rotate(frame, deg)
                try:
                    fr = self._face_det.detect(cand)
                    if fr and fr.multi_face_landmarks:
                        self._rotation   = deg
                        self._rot_locked = True
                        print(f"[DriverCam][{self.bus_id}] orientation locked at {deg}°")
                        return cand
                except Exception:
                    pass
        return self._rotate(frame, self._rotation)

    # ── main loop ─────────────────────────────────────────────────────────────

    def _loop(self):
        use_shared   = self._shared is not None
        use_external = self._external
        if not use_shared and not use_external:
            self._cap = cv2.VideoCapture(self.source)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  _Config.FRAME_WIDTH)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, _Config.FRAME_HEIGHT)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not self._cap.isOpened():
                print(f"[DriverCam][{self.bus_id}] Cannot open source {self.source}")
                self._running = False
                return

        fps_buf = deque(maxlen=30)
        t_prev  = time.perf_counter()

        while self._running:
            try:
                if use_external:
                    with self._lock:
                        frame = None if self._input_frame is None else self._input_frame.copy()
                    ret = frame is not None
                else:
                    ret, frame = (self._shared.read() if use_shared
                                  else self._cap.read())
                if not ret or frame is None:
                    time.sleep(0.02)
                    continue

                # Phone frames: auto-correct orientation (iOS/Android differ).
                # Local webcams: mirror for a natural "selfie" view.
                if use_external:
                    frame = self._orient(frame)
                else:
                    frame = cv2.flip(frame, 1)
                h, w  = frame.shape[:2]
                now   = time.perf_counter()

                fps_buf.append(1.0 / max(now - t_prev, 1e-6))
                t_prev = now
                fps = float(np.mean(fps_buf))

                # ── Detect ────────────────────────────────────────────────────
                ear            = 0.30
                eyes_closed    = False
                gaze           = "unknown"
                face_box       = None
                perclos        = 0.0
                perclos_drowsy = False
                phone_near     = False
                phone_boxes    = []
                seatbelt_on    = True

                try:
                    face_results = self._face_det.detect(frame)
                    face_found   = bool(face_results and face_results.multi_face_landmarks)
                except Exception:
                    face_found = False

                if face_found:
                    try:
                        lm = face_results.multi_face_landmarks[0]
                        _, _, ear, eyes_closed = self._eye_det.compute(lm, w, h)
                        self._eye_det.draw(frame, lm, w, h, eyes_closed)
                        perclos, perclos_drowsy = self._perclos.update(now, ear)
                        gaze     = self._gaze_est.estimate(lm, w, h, frame)
                        face_box = self._face_det.get_face_box(lm, w, h)
                        _drv_draw_face_box(frame, face_box, gaze)
                        _drv_draw_gaze(frame, gaze, face_box)
                    except Exception:
                        pass

                try:
                    phone_near, phone_boxes = self._phone_det.detect(frame, face_box)
                    if phone_boxes:
                        _drv_draw_phones(frame, phone_boxes)
                except Exception:
                    pass

                try:
                    seatbelt_on, _ = self._seatbelt_det.detect(frame, face_box)
                except Exception:
                    pass

                alerts = self._alert_mgr.update(
                    face_detected=face_found,
                    eyes_closed=eyes_closed,
                    gaze=gaze,
                    phone_near=phone_near,
                    now=now,
                    perclos_drowsy=perclos_drowsy,
                    seatbelt_on=seatbelt_on,
                )

                # ── State + confidence ────────────────────────────────────────
                if alerts:
                    raw_state = alerts[0]["type"]
                    state = _ALERT_STATE_MAP.get(raw_state, "distracted")
                else:
                    state = "focused"

                self._vote_buf.append(state)
                vote_counts: dict[str, int] = {}
                for v in self._vote_buf:
                    vote_counts[v] = vote_counts.get(v, 0) + 1
                top_state  = max(vote_counts, key=vote_counts.get)
                confidence = int(vote_counts[top_state] / len(self._vote_buf) * 100)

                with self._lock:
                    # Cast every value to a native Python type — the detectors
                    # return numpy bools/floats which FastAPI's JSON encoder
                    # cannot serialize (raises ValueError on /driver/status).
                    self._status = {
                        "state":          str(top_state),
                        "alert_label":    str(top_state),
                        "confidence":     int(confidence),
                        "alert":          bool(top_state != "focused"),
                        "face_detected":  bool(face_found),
                        "eyes_closed":    bool(eyes_closed),
                        "gaze":           str(gaze),
                        "phone_detected": bool(phone_near),
                        "ear":            float(round(ear, 3)),
                        "perclos":        float(perclos),
                        "perclos_drowsy": bool(perclos_drowsy),
                        "seatbelt_on":    bool(seatbelt_on),
                        "fps":            float(round(fps, 1)),
                        "bus_id":         self.bus_id,
                        "timestamp":      datetime.now().isoformat(),
                    }
                    if top_state != "focused" and top_state != self._prev_alert:
                        self._alert_history.append({
                            "type":      top_state,
                            "timestamp": datetime.now().isoformat(),
                        })
                        _forward("/api/camera/driver-alerts", {
                            "bus_id":     self.bus_id,
                            "alert_type": top_state,
                            "confidence": confidence,
                        })
                    self._prev_alert = top_state

                for alert in alerts:
                    if alert["new_log"]:
                        ts = datetime.now().strftime("%H:%M:%S")
                        self._recent_events.appendleft(
                            (ts, alert["type"], alert["duration"]))

                # ── Draw HUD ──────────────────────────────────────────────────
                with self._lock:
                    re = list(self._recent_events)

                _drv_draw_status(frame, face_found, eyes_closed, gaze, phone_near, ear)
                _drv_draw_fps(frame, fps)
                _drv_draw_event_log(frame, re)

                _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                with self._lock:
                    self._latest_jpeg = jpeg.tobytes()

            except Exception as e:
                print(f"[DriverCam][{self.bus_id}] frame error: {e}")
                time.sleep(0.05)

        if self._cap:
            self._cap.release()


# =============================================================================
#  BusCameraSession  — groups both cameras for one bus
# =============================================================================

@dataclass
class BusCameraSession:
    bus_id:           str
    passenger_source: object
    driver_source:    object
    capacity:         int = 50

    passenger_cam: Optional[PassengerCameraSession] = field(default=None, init=False)
    driver_cam:    Optional[DriverCameraSession]     = field(default=None, init=False)
    shared_cam:    Optional[SharedCamera]            = field(default=None, init=False)
    registered_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def start(self):
        driver_external = self.driver_source == "ingest"

        # Share one capture only when both cams read the SAME real device.
        if (self.passenger_source is not None
                and not driver_external
                and self.passenger_source == self.driver_source):
            try:
                self.shared_cam = SharedCamera(
                    self.passenger_source,
                    w=_Config.FRAME_WIDTH, h=_Config.FRAME_HEIGHT,
                )
            except RuntimeError as e:
                print(f"[BusCameraSession] {e}")
                self.shared_cam = None

        # Passenger cam — skipped when passenger_source is None (e.g. a
        # phone-only driver-monitor session).
        if self.passenger_source is not None:
            self.passenger_cam = PassengerCameraSession(
                self.bus_id, self.passenger_source,
                shared_cam=self.shared_cam, capacity=self.capacity,
            )
            self.passenger_cam.start()

        driver_note = ""
        if driver_external:
            # Frames are pushed in via /ws/bus/{id}/driver/ingest.
            self.driver_cam = DriverCameraSession(
                self.bus_id, "ingest", external=True,
            )
            self.driver_cam.start()
        elif self.driver_source is not None:
            try:
                self.driver_cam = DriverCameraSession(
                    self.bus_id, self.driver_source,
                    shared_cam=self.shared_cam,
                )
                self.driver_cam.start()
            except Exception as e:
                self.driver_cam = None
                driver_note = f" [driver disabled: {e}]"
                print(f"[BusCameraSession] Driver pipeline unavailable for "
                      f"bus {self.bus_id}: {e}")

        shared_note = " [shared camera]" if self.shared_cam else ""
        print(f"[BusCameraSession] Bus {self.bus_id} started "
              f"(passenger={self.passenger_source}, "
              f"driver={self.driver_source}){shared_note}{driver_note}")

    def ensure_passenger(self, source, capacity: int = 50):
        """Attach a passenger-counter cam (e.g. the laptop webcam) without
        disturbing an already-running driver cam."""
        if self.passenger_cam is not None or source is None:
            return
        self.passenger_source = source
        self.capacity         = capacity
        self.passenger_cam = PassengerCameraSession(
            self.bus_id, source, capacity=capacity,
        )
        self.passenger_cam.start()
        print(f"[BusCameraSession] Bus {self.bus_id} passenger cam started "
              f"(source={source})")

    def ensure_driver_ingest(self):
        """Switch the driver cam to phone-ingest mode, keeping any passenger
        cam running."""
        if self.driver_cam is not None and getattr(self.driver_cam, "_external", False):
            return  # already an ingest cam
        if self.driver_cam is not None:
            self.driver_cam.stop()
        self.driver_source = "ingest"
        self.driver_cam = DriverCameraSession(self.bus_id, "ingest", external=True)
        self.driver_cam.start()
        print(f"[BusCameraSession] Bus {self.bus_id} driver cam switched to phone ingest")

    def stop_driver(self):
        if self.driver_cam:
            self.driver_cam.stop()
            self.driver_cam = None

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

app = FastAPI(title="Camera-Aya Server", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_sessions: dict[str, BusCameraSession] = {}
_sessions_lock = threading.Lock()


# ── REST ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    with _sessions_lock:
        buses = list(_sessions.keys())
    return {"status": "ok", "buses": buses, "timestamp": datetime.now().isoformat()}


@app.get("/api/buses")
def list_buses():
    with _sessions_lock:
        out = []
        for bus_id, sess in _sessions.items():
            ct = sess.passenger_cam.get_counter() if sess.passenger_cam else {}
            ds = sess.driver_cam.get_status()     if sess.driver_cam    else {}
            out.append({
                "bus_id":           bus_id,
                "passenger_source": str(sess.passenger_source),
                "driver_source":    str(sess.driver_source),
                "on_bus":           ct.get("on_bus", 0),
                "driver_alert":     ds.get("alert", False),
                "registered_at":    sess.registered_at,
            })
    return {"buses": out}


@app.post("/api/bus/register")
def register_bus(body: dict):
    bus_id = str(body.get("bus_id", "")).strip()
    if not bus_id:
        raise HTTPException(400, "bus_id is required")
    p_src = body.get("passenger_source", 0)
    d_src = body.get("driver_source",    0)
    try: p_src = int(p_src)
    except (ValueError, TypeError): pass
    try: d_src = int(d_src)
    except (ValueError, TypeError): pass
    capacity = int(body.get("capacity", 50) or 50)

    with _sessions_lock:
        existing = _sessions.get(bus_id)
        # A driver's phone may be actively streaming this bus via the ingest
        # WebSocket. Admin selecting the bus must NOT tear that live feed down —
        # instead just attach the passenger (laptop) cam alongside it.
        if existing and existing.driver_cam and getattr(existing.driver_cam, "_external", False):
            existing.ensure_passenger(p_src, capacity)
            return {"ok": True, "bus_id": bus_id, "note": "passenger cam added to ingest session"}
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


@app.get("/api/passenger/status")
def passenger_status_spec(bus_id: Optional[str] = Query(default=None)):
    with _sessions_lock:
        sess = (_sessions.get(bus_id) if bus_id
                else next(iter(_sessions.values()), None))
    if not sess or not sess.passenger_cam:
        return {"current_passengers": 0, "entries": 0, "exits": 0,
                "available_seats": 50, "capacity": 50}
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
    with _sessions_lock:
        sess = (_sessions.get(bus_id) if bus_id
                else next(iter(_sessions.values()), None))
    if not sess or not sess.driver_cam:
        return {"state": "unknown", "confidence": 0, "alert": False}
    ds = sess.driver_cam.get_status()
    return {
        "state":      ds.get("state",      "unknown"),
        "confidence": ds.get("confidence", 0),
        "alert":      bool(ds.get("alert", False)),
        "details": {
            "face_detected":  ds.get("face_detected"),
            "eyes_closed":    ds.get("eyes_closed"),
            "phone_detected": ds.get("phone_detected"),
            "ear":            ds.get("ear"),
            "gaze":           ds.get("gaze"),
            "fps":            ds.get("fps"),
        },
        "bus_id":    ds.get("bus_id"),
        "timestamp": ds.get("timestamp"),
    }


# ── WebSocket streaming ───────────────────────────────────────────────────────

async def _stream(websocket: WebSocket, get_frame_fn, interval: float = 0.033):
    await websocket.accept()
    last_sent: Optional[bytes] = None
    try:
        while True:
            jpeg = get_frame_fn()
            # Only send when there is a new frame to avoid re-sending the same bytes
            if jpeg and jpeg is not last_sent:
                await websocket.send_bytes(jpeg)
                last_sent = jpeg
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


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

    def _get_frame():
        jpeg, _ = sess.driver_cam.get_latest()
        return jpeg

    await _stream(websocket, _get_frame)


# ── Driver frame ingest (phone camera → AI pipeline) ──────────────────────────

import base64 as _base64


@app.websocket("/ws/bus/{bus_id}/driver/ingest")
async def ws_driver_ingest(websocket: WebSocket, bus_id: str):
    """
    Receives live JPEG frames from the driver's phone and feeds them into the
    driver-monitor AI pipeline. Each message is a JPEG, sent either as binary
    bytes or as a (optionally data-URI prefixed) base64 string.

    A driver-only ingest session is auto-created on first connect, so the phone
    does not need to call /api/bus/register first. The annotated result is then
    available to admin viewers at /ws/bus/{bus_id}/driver.
    """
    await websocket.accept()

    with _sessions_lock:
        sess = _sessions.get(bus_id)
        if sess is None:
            # No session yet — create a driver-only ingest session.
            sess = BusCameraSession(bus_id=bus_id, passenger_source=None,
                                    driver_source="ingest")
            sess.start()
            _sessions[bus_id] = sess
        else:
            # Session exists (e.g. admin already started a passenger cam) —
            # switch its driver cam to phone ingest, keeping the passenger cam.
            sess.ensure_driver_ingest()
        # Open the laptop webcam as this bus's passenger counter so it shows up
        # in admin alongside the phone driver feed.
        if INGEST_PASSENGER_SOURCE is not None:
            sess.ensure_passenger(INGEST_PASSENGER_SOURCE, 50)
        driver_cam = sess.driver_cam

    print(f"[Ingest][{bus_id}] phone camera connected "
          f"(passenger_source={INGEST_PASSENGER_SOURCE})")
    n_frames = 0
    n_decoded = 0
    try:
        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break

            raw = msg.get("bytes")
            if raw is None and msg.get("text") is not None:
                txt = msg["text"]
                if txt.startswith("data:"):
                    txt = txt.split(",", 1)[-1]
                try:
                    raw = _base64.b64decode(txt)
                except Exception:
                    raw = None
            if not raw:
                continue
            n_frames += 1

            arr   = np.frombuffer(raw, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None:
                # Downscale large phone frames so the AI keeps up (less lag).
                h0, w0 = frame.shape[:2]
                m = max(h0, w0)
                if m > INGEST_MAX_DIM:
                    s = INGEST_MAX_DIM / m
                    frame = cv2.resize(frame, (int(w0 * s), int(h0 * s)),
                                       interpolation=cv2.INTER_AREA)
                n_decoded += 1
                driver_cam.submit_frame(frame)
                # Periodic diagnostic so we can see frames are flowing + whether
                # the AI is finding a face.
                if n_decoded % 30 == 0:
                    st = driver_cam.get_status()
                    print(f"[Ingest][{bus_id}] {n_decoded} frames "
                          f"({frame.shape[1]}x{frame.shape[0]}) · "
                          f"face={st.get('face_detected')} state={st.get('state')} "
                          f"seatbelt_on={st.get('seatbelt_on')}")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[Ingest][{bus_id}] error: {e}")
    finally:
        # End of trip / phone disconnected — tear the whole session down so the
        # laptop webcam is released and admin shows the bus as offline.
        with _sessions_lock:
            s = _sessions.pop(bus_id, None)
        if s:
            s.stop()
        print(f"[Ingest][{bus_id}] phone camera disconnected "
              f"({n_decoded}/{n_frames} frames decoded)")


# ── Legacy compat ─────────────────────────────────────────────────────────────

@app.get("/api/counter")
def compat_counter():
    with _sessions_lock:
        if not _sessions:
            return {"entered": 0, "exited": 0, "on_bus": 0, "fps": 0, "last_event": None}
        sess = next(iter(_sessions.values()))
    return sess.passenger_cam.get_counter() if sess.passenger_cam else {}


@app.websocket("/ws/video")
async def ws_legacy(websocket: WebSocket):
    with _sessions_lock:
        sess = next(iter(_sessions.values()), None)
    if not sess or not sess.passenger_cam:
        await websocket.accept()
        await websocket.close(code=4004)
        return
    await _stream(websocket, sess.passenger_cam.get_latest_jpeg)


# =============================================================================
#  Startup: load buses from JSON config
# =============================================================================

def _load_buses_config(path: str):
    if not Path(path).exists():
        print(f"[Server] No buses config at {path} — start buses via POST /api/bus/register")
        return
    with open(path) as f:
        buses = json.load(f)
    for bus in buses:
        bus_id = str(bus.get("bus_id", "")).strip()
        if not bus_id:
            continue
        p_src    = bus.get("passenger_source", 0)
        d_src    = bus.get("driver_source",    0)
        capacity = int(bus.get("capacity",     50) or 50)
        try: p_src = int(p_src)
        except (ValueError, TypeError): pass
        try: d_src = int(d_src)
        except (ValueError, TypeError): pass
        sess = BusCameraSession(bus_id=bus_id, passenger_source=p_src,
                                driver_source=d_src, capacity=capacity)
        sess.start()
        _sessions[bus_id] = sess
    print(f"[Server] Loaded {len(_sessions)} bus(es) from {path}")


# =============================================================================
#  Entry point
# =============================================================================

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Camera-Aya unified server")
    ap.add_argument("--host",         default="0.0.0.0")
    ap.add_argument("--port",         type=int, default=9000)
    ap.add_argument("--buses-config", default=os.path.join(_SERVER_DIR, "buses_config.json"))
    args = ap.parse_args()

    _load_buses_config(args.buses_config)

    print(f"\n[Camera-Aya Server] http://{args.host}:{args.port}")
    print(f"  WS streams : /ws/bus/{{bus_id}}/passenger | driver")
    print(f"  REST       : /api/buses  /api/bus/register  /api/health")
    print(f"  Spec APIs  : /api/passenger/status  /api/driver/status\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
