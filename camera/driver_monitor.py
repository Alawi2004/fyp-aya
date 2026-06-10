"""
=============================================================================
 DRIVER MONITORING SYSTEM  —  Professional Grade v2
=============================================================================

 Detection stack
 ───────────────
   MediaPipe Face Mesh  (478 landmarks, with iris refinement)
     • Eye Aspect Ratio (EAR)        → drowsiness / eye-closure detection
     • Head pose (yaw / pitch / roll) → gaze direction + distraction
   YOLOv8n                            → cell-phone detection (COCO class 67)
   OpenCV Haar cascades               → fallback when MediaPipe unavailable

 Alert levels  (evaluated in priority order)
 ────────────────────────────────────────────
   "phone_detected"  — phone visible near face / upper frame
   "drowsy"          — average EAR < threshold for N consecutive frames
   "distracted"      — face absent  OR  head rotated beyond safe limits
   "focused"         — all checks pass

 Tuning  (CONFIG section below)
 ──────────────────────────────
   EAR_THRESHOLD      — eye aspect ratio below = closing (typical: 0.20–0.23)
   EAR_CONSEC_FRAMES  — frames below EAR before drowsy fires
   YAW_LIMIT_DEG      — max left/right head turn (degrees)
   PITCH_LIMIT_DEG    — max downward head tilt (negative = looking down)
   DISTRACTED_FRAMES  — frames without face before distracted fires
   PHONE_FRAMES       — debounce frames for phone alert

 Usage (standalone)
 ───────────────────
   python driver_monitor.py
   python driver_monitor.py --source 0 --bus-id BUS-01

 Usage (module)
 ───────────────
   from driver_monitor import DriverMonitor
   mon = DriverMonitor(source=0, bus_id="BUS-01")
   mon.start()
   jpeg_bytes, status = mon.get_latest()
   mon.stop()
=============================================================================
"""

import cv2
import numpy as np
import time
import threading
import argparse
from collections import Counter, deque
from datetime import datetime
from pathlib import Path
from typing import Optional

# ── optional heavy deps ───────────────────────────────────────────────────────
try:
    import mediapipe as mp
    _MP_FACE_MESH = mp.solutions.face_mesh
    _MP_DRAWING   = mp.solutions.drawing_utils
    MEDIAPIPE_OK  = True
except ImportError:
    MEDIAPIPE_OK  = False
    print("[DriverMonitor] mediapipe not installed — falling back to Haar cascades")
    print("                 Install: pip install mediapipe")

try:
    from ultralytics import YOLO
    YOLO_OK = True
except ImportError:
    YOLO_OK = False
    print("[DriverMonitor] ultralytics not installed — phone detection disabled")


# =============================================================================
#  CONFIG
# =============================================================================

YOLO_MODEL         = "yolov8n.pt"
PHONE_CLASS_ID     = 67          # COCO: cell phone
PHONE_CONF         = 0.45
PHONE_ZONE_Y2      = 0.80        # ignore phones in lower 20 % (lap / dashboard)
PHONE_FRAMES       = 5           # debounce — consecutive frames before alert

# Eye Aspect Ratio (Soukupová & Čech, 2016)
EAR_THRESHOLD      = 0.21        # below this → eye closing
EAR_CONSEC_FRAMES  = 25          # frames below threshold → drowsy
BLINK_MAX_FRAMES   = 4           # normal blink ≤ this many frames (not drowsy)

# Head pose limits (degrees)
YAW_LIMIT_DEG      = 35          # side-to-side: |yaw| > this → distracted
PITCH_LIMIT_DEG    = -20         # looking down: pitch < this → distracted

# No-face threshold
DISTRACTED_FRAMES  = 40          # consecutive frames with no face → distracted

FRAME_W            = 640
FRAME_H            = 480

# Alert smoothing (vote buffer)
VOTE_BUFFER_LEN    = 8           # frames — majority vote prevents flicker
# PERCLOS: % eye closure over sliding window
PERCLOS_WINDOW     = 90          # frames  (~3 s at 30 fps)
PERCLOS_THRESHOLD  = 0.35        # >35 % closure in window → add to drowsy evidence
# Iris gaze deviation threshold (fraction of eye width)
IRIS_GAZE_LIMIT    = 0.22        # >22 % offset → looking sideways

# ── MediaPipe eye landmark indices (6-point EAR) ──────────────────────────────
#   P1=outer, P2=upper-outer, P3=upper-inner, P4=inner, P5=lower-inner, P6=lower-outer
LEFT_EYE_EAR  = [33,  160, 158, 133, 153, 144]
RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380]

# ── MediaPipe iris landmark indices (refine_landmarks=True adds 468-477) ──────
LEFT_IRIS_CENTER  = 468    # centre of left iris
RIGHT_IRIS_CENTER = 473    # centre of right iris
# Eye corners for relative iris position
LEFT_EYE_OUTER  = 33
LEFT_EYE_INNER  = 133
RIGHT_EYE_OUTER = 362
RIGHT_EYE_INNER = 263

# ── Eye outline for drawing ───────────────────────────────────────────────────
LEFT_EYE_CONTOUR  = [33,  246, 161, 160, 159, 158, 157, 173, 133,
                      155, 154, 153, 145, 144, 163,  7]
RIGHT_EYE_CONTOUR = [362, 398, 384, 385, 386, 387, 388, 466, 263,
                      249, 390, 373, 374, 380, 381, 382]

# ── Head pose: 6 face anchor points (MediaPipe indices → 3-D model coords) ───
POSE_LM_IDX = [1,    152,   33,   263,   61,   291]
#               nose  chin  L-eye  R-eye  L-mouth R-mouth

POSE_3D = np.array([
    [ 0.0,    0.0,    0.0  ],   # nose tip
    [ 0.0,  -63.6,  -12.5  ],   # chin
    [-43.3,  32.7,  -26.0  ],   # left  eye outer corner
    [ 43.3,  32.7,  -26.0  ],   # right eye outer corner
    [-28.9, -28.9,  -24.1  ],   # left  mouth corner
    [ 28.9, -28.9,  -24.1  ],   # right mouth corner
], dtype=np.float64)

# ── Haar cascade paths (fallback) ─────────────────────────────────────────────
_HAAR_FACE = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
_HAAR_EYE  = cv2.data.haarcascades + "haarcascade_eye.xml"

# ── Colours (BGR) ─────────────────────────────────────────────────────────────
C = {
    "focused":        (0,   200,  80),
    "phone_detected": (0,   0,   255),
    "drowsy":         (0,   140, 255),
    "distracted":     (0,   220, 255),
    "panel_bg":       (10,  10,   10),
    "eye_open":       (0,   230,  80),
    "eye_closed":     (0,    60, 255),
    "pose_axis_x":    (255,  0,    0),
    "pose_axis_y":    (0,   255,   0),
    "pose_axis_z":    (0,    0,  255),
}


# =============================================================================
#  DriverMonitor
# =============================================================================

class DriverMonitor:
    """
    Thread-safe driver behaviour monitor.
    Call start() → get_latest() in a loop → stop() when done.
    """

    def __init__(self, source=0, bus_id: str = "unknown"):
        self.source = source
        self.bus_id = bus_id

        # ── MediaPipe Face Mesh ───────────────────────────────────────────────
        self._face_mesh: Optional[object] = None
        if MEDIAPIPE_OK:
            self._face_mesh = _MP_FACE_MESH.FaceMesh(
                max_num_faces         = 1,
                refine_landmarks      = True,   # adds iris landmarks
                min_detection_confidence = 0.55,
                min_tracking_confidence  = 0.50,
                static_image_mode     = False,
            )

        # ── Haar cascade fallback ─────────────────────────────────────────────
        self._face_cascade = cv2.CascadeClassifier(_HAAR_FACE)
        self._eye_cascade  = cv2.CascadeClassifier(_HAAR_EYE)

        # ── YOLO phone detector ───────────────────────────────────────────────
        self._yolo = None
        if YOLO_OK:
            try:
                self._yolo = YOLO(YOLO_MODEL)
                print(f"[DriverMonitor][Bus {bus_id}] YOLO loaded ({YOLO_MODEL})")
            except Exception as exc:
                print(f"[DriverMonitor][Bus {bus_id}] YOLO load failed: {exc}")

        # ── counters ──────────────────────────────────────────────────────────
        self._ear_low_frames   = 0   # consecutive frames with EAR below threshold
        self._no_face_frames   = 0   # consecutive frames with no face
        self._phone_frames_cnt = 0   # consecutive frames with phone present

        # ── vote smoothing + PERCLOS ───────────────────────────────────────────
        self._vote_buf    : deque = deque(maxlen=VOTE_BUFFER_LEN)
        self._perclos_buf : deque = deque(maxlen=PERCLOS_WINDOW)

        # ── shared state (guarded by _lock) ───────────────────────────────────
        self._status = {
            "alert":          "focused",
            "phone_detected": False,
            "drowsy":         False,
            "distracted":     False,
            "face_detected":  False,
            "eyes_detected":  True,
            "ear":            0.0,
            "yaw":            0.0,
            "pitch":          0.0,
            "fps":            0.0,
            "timestamp":      datetime.now().isoformat(),
            "bus_id":         bus_id,
        }
        self._alert_history: deque = deque(maxlen=200)
        self._latest_frame: Optional[bytes] = None
        self._lock    = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._cap: Optional[cv2.VideoCapture] = None

        # ── external shared camera ────────────────────────────────────────────
        # If source is a SharedCamera object (set by BusCameraSession when
        # passenger_source == driver_source), use it instead of opening a new cap.
        self._shared_cam = None

    # ─── Public API ──────────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        print(f"[DriverMonitor][Bus {self.bus_id}] started (source={self.source})")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
        if self._cap:
            self._cap.release()
        if self._face_mesh:
            self._face_mesh.close()
        print(f"[DriverMonitor][Bus {self.bus_id}] stopped")

    def get_latest(self):
        """Returns (jpeg_bytes | None, status_dict). Thread-safe."""
        with self._lock:
            return self._latest_frame, dict(self._status)

    def get_status(self) -> dict:
        with self._lock:
            return dict(self._status)

    def get_alert_history(self) -> list:
        with self._lock:
            return list(self._alert_history)

    # ─── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _ear(landmarks, indices: list, W: int, H: int) -> float:
        """Eye Aspect Ratio (Soukupová & Čech 2016) from 6 MediaPipe landmarks."""
        pts = np.array(
            [[landmarks[i].x * W, landmarks[i].y * H] for i in indices],
            dtype=np.float64,
        )
        # Vertical distances (P2-P6, P3-P5)
        A = np.linalg.norm(pts[1] - pts[5])
        B = np.linalg.norm(pts[2] - pts[4])
        # Horizontal distance (P1-P4)
        C = np.linalg.norm(pts[0] - pts[3])
        return float((A + B) / (2.0 * C + 1e-6))

    @staticmethod
    def _head_pose(landmarks, W: int, H: int):
        """
        Estimate yaw and pitch (degrees) using solvePnP on 6 facial anchors.
        Returns (yaw, pitch).  |yaw| > YAW_LIMIT → side-glance; pitch < PITCH_LIMIT → looking down.
        """
        pts_2d = np.array(
            [[landmarks[i].x * W, landmarks[i].y * H] for i in POSE_LM_IDX],
            dtype=np.float64,
        )
        focal  = float(W)
        cam_mx = np.array([[focal, 0, W / 2],
                           [0, focal, H / 2],
                           [0,     0,     1]], dtype=np.float64)
        dist   = np.zeros((4, 1), dtype=np.float64)

        ok, rvec, _ = cv2.solvePnP(
            POSE_3D, pts_2d, cam_mx, dist,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rvec)
        angles, *_ = cv2.RQDecomp3x3(rmat)
        pitch, yaw, _ = angles   # degrees
        return float(yaw), float(pitch)

    @staticmethod
    def _draw_eye_contour(frame, landmarks, indices: list, W: int, H: int, color):
        pts = np.array(
            [[int(landmarks[i].x * W), int(landmarks[i].y * H)] for i in indices],
            dtype=np.int32,
        )
        cv2.polylines(frame, [pts], isClosed=True, color=color, thickness=1)

    @staticmethod
    def _iris_gaze(landmarks, W: int, H: int):
        """
        Compute horizontal gaze deviation using iris centre vs eye-corner midpoint.
        Returns (gaze_offset_fraction) where:
            +0.20 = looking right, -0.20 = looking left, ~0 = straight ahead.
        Requires refine_landmarks=True (indices 468–477).
        """
        try:
            lo = np.array([landmarks[LEFT_EYE_OUTER].x * W,  landmarks[LEFT_EYE_OUTER].y * H])
            li = np.array([landmarks[LEFT_EYE_INNER].x * W,  landmarks[LEFT_EYE_INNER].y * H])
            lc = np.array([landmarks[LEFT_IRIS_CENTER].x * W, landmarks[LEFT_IRIS_CENTER].y * H])
            ro = np.array([landmarks[RIGHT_EYE_OUTER].x * W, landmarks[RIGHT_EYE_OUTER].y * H])
            ri = np.array([landmarks[RIGHT_EYE_INNER].x * W, landmarks[RIGHT_EYE_INNER].y * H])
            rc = np.array([landmarks[RIGHT_IRIS_CENTER].x * W, landmarks[RIGHT_IRIS_CENTER].y * H])

            lw = max(np.linalg.norm(li - lo), 1.0)
            rw = max(np.linalg.norm(ri - ro), 1.0)

            l_offset = (lc[0] - (lo[0] + li[0]) / 2.0) / lw
            r_offset = (rc[0] - (ro[0] + ri[0]) / 2.0) / rw
            return float((l_offset + r_offset) / 2.0)
        except (IndexError, Exception):
            return 0.0

    # ─── Main detection loop ──────────────────────────────────────────────────

    def _loop(self):
        # Open camera (or reuse shared camera)
        use_shared = self._shared_cam is not None
        if not use_shared:
            self._cap = cv2.VideoCapture(self.source)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_W)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not self._cap.isOpened():
                print(f"[DriverMonitor][Bus {self.bus_id}] Cannot open: {self.source}")
                self._running = False
                return

        fps_buf = deque(maxlen=30)
        t_prev  = time.perf_counter()

        while self._running:
            # ── read frame ───────────────────────────────────────────────────
            if use_shared:
                ret, frame = self._shared_cam.read()
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

            H_f, W_f = frame.shape[:2]

            # ── phone detection (YOLO) ────────────────────────────────────────
            phone_boxes   = []
            phone_in_zone = False

            if self._yolo is not None:
                results = self._yolo(
                    frame, classes=[PHONE_CLASS_ID],
                    conf=PHONE_CONF, verbose=False,
                )
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cy_frac = ((y1 + y2) / 2) / H_f
                    conf    = float(box.conf[0])
                    phone_boxes.append((x1, y1, x2, y2, conf))
                    if cy_frac <= PHONE_ZONE_Y2:
                        phone_in_zone = True

            if phone_in_zone:
                self._phone_frames_cnt = min(self._phone_frames_cnt + 1, PHONE_FRAMES + 5)
            else:
                self._phone_frames_cnt = max(0, self._phone_frames_cnt - 1)
            phone_alert = self._phone_frames_cnt >= PHONE_FRAMES

            # ── face / eye / pose detection ───────────────────────────────────
            face_detected  = False
            eyes_open      = True
            ear_value      = 0.0
            yaw_value      = 0.0
            pitch_value    = 0.0
            gaze_offset    = 0.0     # iris horizontal deviation (fraction)
            face_box       = None    # (x1, y1, x2, y2) in pixels
            pose_pts_2d    = None
            face_lm        = None    # MediaPipe landmark list (or None)

            if self._face_mesh is not None:
                # ── MediaPipe path ────────────────────────────────────────────
                rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_result = self._face_mesh.process(rgb)

                if mp_result.multi_face_landmarks:
                    face_detected = True
                    lm            = mp_result.multi_face_landmarks[0].landmark
                    face_lm       = lm          # safe reference for _draw

                    # EAR
                    left_ear  = self._ear(lm, LEFT_EYE_EAR,  W_f, H_f)
                    right_ear = self._ear(lm, RIGHT_EYE_EAR, W_f, H_f)
                    ear_value = (left_ear + right_ear) / 2.0
                    eyes_open = ear_value >= EAR_THRESHOLD

                    # Iris gaze (requires refine_landmarks=True, 478 pts)
                    if len(lm) > RIGHT_IRIS_CENTER:
                        gaze_offset = self._iris_gaze(lm, W_f, H_f)

                    # Head pose
                    yaw_value, pitch_value = self._head_pose(lm, W_f, H_f)

                    # Bounding box for annotation
                    xs = [lm[i].x * W_f for i in range(468)]
                    ys = [lm[i].y * H_f for i in range(468)]
                    fx1, fy1 = int(min(xs)), int(min(ys))
                    fx2, fy2 = int(max(xs)), int(max(ys))
                    face_box = (fx1, fy1, fx2, fy2)

                    # 2-D nose point for pose axes annotation
                    pose_pts_2d = np.array(
                        [[lm[i].x * W_f, lm[i].y * H_f] for i in POSE_LM_IDX],
                        dtype=np.float64,
                    )

            else:
                # ── Haar cascade fallback ─────────────────────────────────────
                gray = cv2.equalizeHist(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
                faces = self._face_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))

                if len(faces) > 0:
                    face_detected = True
                    fx, fy, fw, fh = sorted(
                        faces, key=lambda r: r[2] * r[3], reverse=True)[0]
                    face_box = (fx, fy, fx + fw, fy + fh)
                    face_roi = gray[fy:fy + fh, fx:fx + fw]
                    eyes = self._eye_cascade.detectMultiScale(
                        face_roi, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
                    eyes_open = len(eyes) >= 1
                    ear_value = 0.30 if eyes_open else 0.15   # synthetic EAR

            # ── PERCLOS update ────────────────────────────────────────────────
            if face_detected:
                self._perclos_buf.append(0 if eyes_open else 1)
            perclos = (sum(self._perclos_buf) / len(self._perclos_buf)
                       if self._perclos_buf else 0.0)

            # ── update rolling counters ───────────────────────────────────────
            if face_detected:
                self._no_face_frames = 0
            else:
                self._no_face_frames += 1

            if face_detected:
                if eyes_open:
                    self._ear_low_frames = max(0, self._ear_low_frames - 1)
                else:
                    self._ear_low_frames += 1
            # (don't increment ear_low_frames when face absent — that's distracted, not drowsy)

            # ── determine raw alert ───────────────────────────────────────────
            # Drowsy: either consecutive low EAR OR high PERCLOS
            drowsy_alert     = (self._ear_low_frames >= EAR_CONSEC_FRAMES or
                                perclos >= PERCLOS_THRESHOLD)
            # Distracted: no face, head turned, OR iris looking far sideways
            distracted_alert = self._no_face_frames >= DISTRACTED_FRAMES or (
                face_detected and (
                    abs(yaw_value)   > YAW_LIMIT_DEG or
                    pitch_value      < PITCH_LIMIT_DEG or
                    abs(gaze_offset) > IRIS_GAZE_LIMIT
                )
            )

            if phone_alert:
                raw_alert = "phone_detected"
            elif drowsy_alert:
                raw_alert = "drowsy"
            elif distracted_alert:
                raw_alert = "distracted"
            else:
                raw_alert = "focused"

            # ── vote smoothing — prevent flicker ──────────────────────────────
            self._vote_buf.append(raw_alert)
            vote_counts = Counter(self._vote_buf)
            alert       = vote_counts.most_common(1)[0][0]
            confidence  = int(vote_counts[alert] / max(len(self._vote_buf), 1) * 100)

            # ── log transitions ───────────────────────────────────────────────
            with self._lock:
                prev_alert = self._status["alert"]
            if alert != prev_alert:
                with self._lock:
                    self._alert_history.append({
                        "alert":     alert,
                        "previous":  prev_alert,
                        "timestamp": datetime.now().isoformat(),
                        "bus_id":    self.bus_id,
                    })

            # ── FPS ───────────────────────────────────────────────────────────
            t_now = time.perf_counter()
            fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
            t_prev = t_now
            fps    = float(np.mean(fps_buf))

            # ── annotate ──────────────────────────────────────────────────────
            annotated = self._draw(
                frame.copy(),
                phone_boxes, face_box, pose_pts_2d,
                alert, phone_alert, drowsy_alert, distracted_alert,
                face_detected, eyes_open,
                ear_value, yaw_value, pitch_value, fps,
                face_lm,        # None when face not detected — clean, no magic
                W_f, H_f,
                perclos=perclos,
                gaze_offset=gaze_offset,
            )

            # ── encode JPEG ───────────────────────────────────────────────────
            _, jpeg = cv2.imencode(
                ".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])

            # ── update shared state ───────────────────────────────────────────
            with self._lock:
                self._latest_frame = jpeg.tobytes()
                self._status = {
                    # ── spec-compliant top-level fields ───────────────────────
                    "state":          alert,          # Focused / Drowsy / Distracted / Phone
                    "confidence":     confidence,     # 0-100 %
                    "alert":          alert != "focused",
                    # ── internal detail fields ────────────────────────────────
                    "alert_label":    alert,
                    "phone_detected": phone_alert,
                    "drowsy":         drowsy_alert,
                    "distracted":     distracted_alert,
                    "face_detected":  face_detected,
                    "eyes_detected":  eyes_open,
                    "ear":            round(ear_value, 3),
                    "perclos":        round(perclos, 3),
                    "yaw":            round(yaw_value, 1),
                    "pitch":          round(pitch_value, 1),
                    "gaze":           round(gaze_offset, 3),
                    "fps":            round(fps, 1),
                    "timestamp":      datetime.now().isoformat(),
                    "bus_id":         self.bus_id,
                }

        if self._cap:
            self._cap.release()

    # ─── Visualiser ──────────────────────────────────────────────────────────

    def _draw(self, frame,
              phone_boxes, face_box, pose_pts_2d,
              alert, phone_alert, drowsy_alert, distracted_alert,
              face_detected, eyes_open,
              ear, yaw, pitch, fps,
              lm, W, H,
              perclos=0.0, gaze_offset=0.0):

        alert_color = C.get(alert, (200, 200, 200))

        # ── phone boxes ───────────────────────────────────────────────────────
        for (x1, y1, x2, y2, conf) in phone_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), C["phone_detected"], 3)
            cv2.putText(frame, f"PHONE {conf:.0%}",
                        (x1, max(y1 - 8, 12)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, C["phone_detected"], 2)

        # ── face bounding box (now stored as x1,y1,x2,y2) ────────────────────
        if face_box is not None:
            fx1, fy1, fx2, fy2 = face_box
            face_col = C["eye_open"] if eyes_open else C["eye_closed"]
            cv2.rectangle(frame, (fx1, fy1), (fx2, fy2), face_col, 2)

        # ── eye contours + iris dots (MediaPipe only) ─────────────────────────
        if lm is not None:
            eye_col = C["eye_open"] if eyes_open else C["eye_closed"]
            self._draw_eye_contour(frame, lm, LEFT_EYE_CONTOUR,  W, H, eye_col)
            self._draw_eye_contour(frame, lm, RIGHT_EYE_CONTOUR, W, H, eye_col)

            # Iris dots — bright cyan for open, orange for closed/drowsy
            iris_col = (0, 255, 220) if eyes_open else (0, 140, 255)
            if len(lm) > RIGHT_IRIS_CENTER:
                for idx in (LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER):
                    ix = int(lm[idx].x * W)
                    iy = int(lm[idx].y * H)
                    cv2.circle(frame, (ix, iy), 4, iris_col, -1)
                    cv2.circle(frame, (ix, iy), 4, (0, 0, 0),  1)   # outline

            # Gaze direction arrow from nose bridge
            if pose_pts_2d is not None:
                nose_pt = tuple(pose_pts_2d[0].astype(int))
                gx = int(gaze_offset * 100)     # scale fraction → pixels
                gaze_end = (nose_pt[0] + gx, nose_pt[1])
                cv2.arrowedLine(frame, nose_pt, gaze_end, (0, 220, 255), 2, tipLength=0.4)

        # ── head pose direction arrow (from nose, yaw + pitch combined) ───────
        if pose_pts_2d is not None and len(pose_pts_2d) >= 1:
            nose_2d = tuple(pose_pts_2d[0].astype(int))
            dx = int(np.sin(np.radians(yaw))   * 55)
            dy = int(np.sin(np.radians(pitch))  * 55)
            cv2.arrowedLine(frame, nose_2d,
                            (nose_2d[0] + dx, nose_2d[1] + dy),
                            alert_color, 2, tipLength=0.35)

        # ── flashing alert border ─────────────────────────────────────────────
        if alert != "focused":
            b = 8
            cv2.rectangle(frame, (b, b), (W - b, H - b), alert_color, b)
            # Second inner border for visibility
            cv2.rectangle(frame, (b + 4, b + 4), (W - b - 4, H - b - 4),
                          alert_color, 1)

        # ── status panel (top-left) ───────────────────────────────────────────
        panel_h = 175
        ov = frame.copy()
        cv2.rectangle(ov, (0, 0), (310, panel_h), C["panel_bg"], -1)
        cv2.addWeighted(ov, 0.75, frame, 0.25, 0, frame)

        labels = {
            "focused":        "FOCUSED",
            "phone_detected": "! PHONE DETECTED !",
            "drowsy":         "! DROWSY !",
            "distracted":     "! DISTRACTED !",
        }
        cv2.putText(frame, f"DRIVER CAM  [{self.bus_id}]",
                    (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 180, 180), 1)
        cv2.putText(frame, labels.get(alert, alert.upper()),
                    (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.72, alert_color, 2)

        face_txt = "Face: DETECTED" if face_detected else "Face: NOT FOUND"
        cv2.putText(frame, face_txt, (10, 78),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46,
                    C["eye_open"] if face_detected else (0, 60, 255), 1)

        eye_txt = f"Eyes: {'OPEN' if eyes_open else 'CLOSED'}  EAR={ear:.3f}"
        cv2.putText(frame, eye_txt, (10, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46,
                    C["eye_open"] if eyes_open else C["eye_closed"], 1)

        # PERCLOS bar
        pct_lbl = f"PERCLOS: {perclos:.0%}"
        pct_col = (0, 200, 80) if perclos < 0.20 else (0, 140, 255) if perclos < 0.35 else (0, 0, 220)
        cv2.putText(frame, pct_lbl, (10, 122),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, pct_col, 1)
        # Small progress bar for PERCLOS
        bar_w = int(np.clip(perclos / 0.5, 0, 1) * 130)
        cv2.rectangle(frame, (10, 128), (140, 134), (40, 40, 40), -1)
        cv2.rectangle(frame, (10, 128), (10 + bar_w, 134), pct_col, -1)

        gaze_txt = f"Gaze: {gaze_offset:+.2f}"
        gaze_col = (0, 200, 80) if abs(gaze_offset) < IRIS_GAZE_LIMIT else (0, 80, 255)
        cv2.putText(frame, gaze_txt, (10, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, gaze_col, 1)

        pose_txt = f"Yaw={yaw:+.0f}  Pitch={pitch:+.0f}"
        cv2.putText(frame, pose_txt, (10, 170),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160, 160, 160), 1)

        # FPS — bottom-left
        cv2.putText(frame, f"FPS {fps:.1f}", (10, H - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (100, 100, 100), 1)

        return frame


# =============================================================================
#  CLI  —  standalone test
# =============================================================================

def main():
    ap = argparse.ArgumentParser(description="Driver monitor — standalone test")
    ap.add_argument("--source",  default=0, help="Camera index or video path")
    ap.add_argument("--bus-id",  default="TEST", help="Bus label")
    args = ap.parse_args()

    src = args.source
    try:
        src = int(src)
    except (ValueError, TypeError):
        pass

    mon = DriverMonitor(source=src, bus_id=args.bus_id)
    mon.start()
    print(f"Driver monitor running (MediaPipe={'YES' if MEDIAPIPE_OK else 'NO (Haar fallback)'})")
    print("Press ESC to quit\n")

    while True:
        jpeg, status = mon.get_latest()
        if jpeg:
            arr   = np.frombuffer(jpeg, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            cv2.imshow(f"Driver Monitor  [{args.bus_id}]", frame)

        print(f"\r  {status['alert']:20s}  "
              f"Face:{'Y' if status['face_detected'] else 'N'}  "
              f"Eyes:{'Y' if status['eyes_detected'] else 'N'}  "
              f"EAR:{status['ear']:.3f}  "
              f"Yaw:{status['yaw']:+.0f}  "
              f"Pitch:{status['pitch']:+.0f}  "
              f"Phone:{'Y' if status['phone_detected'] else 'N'}  "
              f"FPS:{status['fps']:.1f}",
              end="", flush=True)

        if (cv2.waitKey(1) & 0xFF) == 27:
            break

    mon.stop()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
