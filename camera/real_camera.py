"""
=============================================================================
 BUS PASSENGER COUNTING SYSTEM  —  Professional Grade  (Vertical Zone)
=============================================================================

 Camera orientation (top-of-door, downward-facing)
 ───────────────────────────────────────────────────
 The camera looks straight down at the door threshold.
 Passengers walk LEFT ↔ RIGHT across the frame.

 Frame layout (bird's-eye view through the camera):

   ┌──────────╥──────────────╥──────────┐
   │          ║              ║          │
   │ OUTSIDE  ║  DOOR ZONE   ║  INSIDE  │
   │ (street) ║              ║  (bus)   │
   │          ║              ║          │
   └──────────╨──────────────╨──────────┘
              ↑              ↑
         ZONE_LEFT       ZONE_RIGHT
      (left trigger)  (right trigger)

   • Moving LEFT → RIGHT (outside → inside)  =  ENTER  (+1)
   • Moving RIGHT → LEFT (inside → outside)  =  EXIT   (-1)
   • Flip ENTER_IS_LEFT_TO_RIGHT=False if your door is mirrored.

 Install
 ────────
   pip install ultralytics opencv-python-headless numpy

 Run
 ────
   python bus_counter_pro.py                        # webcam
   python bus_counter_pro.py --source door_cam.mp4  # video file
   python bus_counter_pro.py --model yolov8n.pt     # fast CPU mode
   python bus_counter_pro.py --no-show              # headless / server

=============================================================================
"""

import cv2
import numpy as np
import csv
import time
import argparse
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from ultralytics import YOLO


# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG  —  only this block needs editing for normal tuning
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_MODEL        = "yolov8n.pt"   # yolov8n (fast on CPU) / yolov8m (better GPU)
CONF_THRESH          = 0.30
IOU_THRESH           = 0.45
FRAME_W              = 640
FRAME_H              = 480

# ── Camera mode ───────────────────────────────────────────────────────────────
# "top_down" : camera mounted ABOVE the door, looking down.
#              People walk LEFT ↔ RIGHT — uses vertical zone lines.
# "frontal"  : laptop / face-height camera pointing at people.
#              People walk TOWARD / AWAY — uses a horizontal counting line.
CAMERA_MODE          = "frontal"

# top_down settings (vertical zone lines)
ZONE_LEFT_FRAC       = 0.35
ZONE_RIGHT_FRAC      = 0.65
ENTER_IS_LEFT_TO_RIGHT = True

# frontal settings (horizontal counting line)
# Place the laptop so the bus door threshold falls at ~50 % of the frame height.
ZONE_Y_FRAC          = 0.50    # counting line at 50 % of frame height
ZONE_BAND_FRAC       = 0.08    # ± 8 % band around the line = "in zone"
ENTER_IS_BOTTOM_TO_TOP = True  # person walks UP in frame (away from cam) = ENTER

# Trajectory / smoothing
HISTORY_LEN          = 20
SMOOTH_LEN           = 5       # slightly more responsive for frontal mode
MIN_CROSS_SPEED      = 1.5     # px/frame — lower for frontal (slower approach)
REENTRY_COOLDOWN     = 30      # frames cooldown (lower for demo testing)

LOG_FILE             = "passenger_log.csv"

# ─────────────────────────────────────────────────────────────────────────────


# =====================================================================
#  DATA STRUCTURES
# =====================================================================

@dataclass
class TrackState:
    """Per-person state maintained across frames."""
    tid: int

    # X-centroid history (used by top_down mode)
    history:   deque = field(default_factory=lambda: deque(maxlen=HISTORY_LEN))
    # Y-centroid history (used by frontal mode)
    y_history: deque = field(default_factory=lambda: deque(maxlen=HISTORY_LEN))

    zone_state:         str = "unknown"
    counted_state:      str = "unknown"
    last_counted_frame: int = -999
    frames_missing:     int = 0

    @property
    def smooth_cx(self) -> Optional[float]:
        if not self.history:
            return None
        pts = list(self.history)[-SMOOTH_LEN:]
        return float(np.mean(pts))

    @property
    def velocity_x(self) -> Optional[float]:
        if len(self.history) < 3:
            return None
        pts = list(self.history)
        diffs = [pts[i] - pts[i - 1] for i in range(1, min(len(pts), 6))]
        return float(np.mean(diffs))

    @property
    def smooth_cy(self) -> Optional[float]:
        if not self.y_history:
            return None
        pts = list(self.y_history)[-SMOOTH_LEN:]
        return float(np.mean(pts))

    @property
    def velocity_y(self) -> Optional[float]:
        if len(self.y_history) < 3:
            return None
        pts = list(self.y_history)
        diffs = [pts[i] - pts[i - 1] for i in range(1, min(len(pts), 6))]
        return float(np.mean(diffs))


# =====================================================================
#  MODULE 1 — DETECTOR
#  Thin wrapper around YOLOv8 + ByteTrack.
# =====================================================================

class Detector:
    """
    Runs YOLOv8 inference on every frame and returns person detections
    with stable ByteTrack IDs.

    Swap tracker="bytetrack.yaml" -> "botsort.yaml" for appearance-based
    re-ID (BotSORT), which handles re-entry after long occlusions better
    but requires ~2x more GPU memory.
    """

    def __init__(self, model_path: str):
        print(f"[Detector] Loading {model_path} ...")
        self.model = YOLO(model_path)

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Returns a list of dicts, one per detected person:
            { tid, x1, y1, x2, y2, conf }
        """
        results = self.model.track(
            frame,
            persist=True,           # keeps ByteTrack state between frames
            conf=CONF_THRESH,
            iou=IOU_THRESH,
            classes=[0],            # class 0 = person only
            tracker="bytetrack.yaml",
            verbose=False,
        )

        detections = []
        boxes = results[0].boxes
        if boxes.id is None:
            return detections

        for box in boxes:
            tid  = int(box.id[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append(dict(tid=tid, x1=x1, y1=y1, x2=x2, y2=y2, conf=conf))

        return detections


# =====================================================================
#  MODULE 2 — TRACKER MEMORY
#  Keeps TrackState objects alive across frames, tolerates occlusions.
# =====================================================================

class TrackerMemory:
    """
    Manages one TrackState per track ID.

    Tracks that disappear (occlusion, leaving frame) are kept for
    MAX_MISSING_FRAMES before being deleted, so a brief occlusion
    (two people overlapping) does not reset the track state and
    cause a spurious re-count when the person reappears.
    """

    MAX_MISSING_FRAMES = 15

    def __init__(self):
        self._tracks: dict[int, TrackState] = {}

    def update(self, detections: list[dict]) -> list[TrackState]:
        """
        Ingest this frame's detections.
        Appends X-centroid to each track's history.
        Ages out long-missing tracks.
        Returns list of all currently alive TrackStates.
        """
        seen_ids: set[int] = set()

        for det in detections:
            tid = det["tid"]
            cx  = (det["x1"] + det["x2"]) // 2
            cy  = (det["y1"] + det["y2"]) // 2
            seen_ids.add(tid)

            if tid not in self._tracks:
                self._tracks[tid] = TrackState(tid=tid)

            ts = self._tracks[tid]
            ts.history.append(cx)
            ts.y_history.append(cy)
            ts.frames_missing = 0

        # Age unseen tracks; delete after threshold
        stale = []
        for tid, ts in self._tracks.items():
            if tid not in seen_ids:
                ts.frames_missing += 1
                if ts.frames_missing > self.MAX_MISSING_FRAMES:
                    stale.append(tid)
        for tid in stale:
            del self._tracks[tid]

        return list(self._tracks.values())

    def all_tracks(self) -> dict[int, TrackState]:
        return self._tracks


# =====================================================================
#  MODULE 3 — COUNTER
#  Two vertical-line zone logic with direction + anti-double-count.
# =====================================================================

class PassengerCounter:
    """
    Counts passengers in two modes:

    top_down  — camera above the door, people walk LEFT↔RIGHT.
                Uses two vertical zone lines + X-centroid tracking.

    frontal   — laptop / face-height camera, people walk toward/away.
                Uses one horizontal counting line + Y-centroid tracking.
                bottom→top movement = ENTER (walking away from camera into bus).
    """

    def __init__(self,
                 # top_down params
                 zone_left: int = 0, zone_right: int = 640,
                 enter_is_ltr: bool = True,
                 # frontal params
                 mode: str = "top_down",
                 zone_y: int = 240, zone_band: int = 38,
                 enter_is_btt: bool = True):
        self.mode         = mode
        # top_down
        self.zone_left    = zone_left
        self.zone_right   = zone_right
        self.enter_is_ltr = enter_is_ltr
        # frontal
        self.zone_y       = zone_y        # Y pixel of the counting line
        self.zone_band    = zone_band     # ± px around the line = "in zone"
        self.enter_is_btt = enter_is_btt  # bottom→top = ENTER
        # counters
        self.entered      = 0
        self.exited       = 0

    @property
    def on_bus(self) -> int:
        return max(self.entered - self.exited, 0)

    # ── top_down helpers ──────────────────────────────────────────────

    def _region_x(self, cx: float) -> str:
        if cx < self.zone_left:
            return "left_side"
        elif cx > self.zone_right:
            return "right_side"
        return "in_zone"

    def _to_semantic_x(self, geo: str) -> str:
        if self.enter_is_ltr:
            return {"left_side": "outside", "right_side": "inside"}.get(geo, geo)
        return {"left_side": "inside", "right_side": "outside"}.get(geo, geo)

    # ── frontal helpers ───────────────────────────────────────────────

    def _region_y(self, cy: float) -> str:
        """above line = 'above', below = 'below', within band = 'in_zone'."""
        if cy < self.zone_y - self.zone_band:
            return "above"
        elif cy > self.zone_y + self.zone_band:
            return "below"
        return "in_zone"

    def _to_semantic_y(self, geo: str) -> str:
        """Map 'above'/'below' to 'inside'/'outside' based on direction config."""
        if self.enter_is_btt:
            # walking UP (decreasing Y) → entering bus → above line = inside
            return {"above": "inside", "below": "outside"}.get(geo, geo)
        return {"above": "outside", "below": "inside"}.get(geo, geo)

    # ── main process ──────────────────────────────────────────────────

    def process(self, tracks: list[TrackState], frame_idx: int) -> list[dict]:
        if self.mode == "frontal":
            return self._process_frontal(tracks, frame_idx)
        return self._process_top_down(tracks, frame_idx)

    def _process_top_down(self, tracks: list[TrackState], frame_idx: int) -> list[dict]:
        events = []
        for ts in tracks:
            cx = ts.smooth_cx
            if cx is None:
                continue
            geo = self._region_x(cx)
            sem = self._to_semantic_x(geo) if geo != "in_zone" else "in_zone"

            if ts.zone_state == "unknown":
                ts.zone_state    = sem
                ts.counted_state = sem
                continue

            prev_state    = ts.zone_state
            ts.zone_state = sem

            if prev_state != "in_zone" or sem == "in_zone":
                continue

            vel = ts.velocity_x
            if vel is not None and abs(vel) < MIN_CROSS_SPEED:
                continue
            if (frame_idx - ts.last_counted_frame) <= REENTRY_COOLDOWN:
                continue

            events.extend(self._fire(ts, sem, frame_idx))
        return events

    def _process_frontal(self, tracks: list[TrackState], frame_idx: int) -> list[dict]:
        events = []
        for ts in tracks:
            cy = ts.smooth_cy
            if cy is None:
                continue
            geo = self._region_y(cy)
            sem = self._to_semantic_y(geo) if geo != "in_zone" else "in_zone"

            if ts.zone_state == "unknown":
                ts.zone_state    = sem
                ts.counted_state = sem
                continue

            prev_state    = ts.zone_state
            ts.zone_state = sem

            # Only fire when leaving the transition band
            if prev_state != "in_zone" or sem == "in_zone":
                continue

            vel = ts.velocity_y
            if vel is not None and abs(vel) < MIN_CROSS_SPEED:
                continue
            if (frame_idx - ts.last_counted_frame) <= REENTRY_COOLDOWN:
                continue

            events.extend(self._fire(ts, sem, frame_idx))
        return events

    def _fire(self, ts: TrackState, sem: str, frame_idx: int) -> list[dict]:
        events = []
        if sem == "inside" and ts.counted_state != "inside":
            self.entered += 1
            ts.counted_state      = "inside"
            ts.last_counted_frame = frame_idx
            events.append(self._make_event(ts.tid, "ENTER", frame_idx))
            print(f"  > ENTER  tid={ts.tid:<4}  on_bus={self.on_bus}")
        elif sem == "outside" and ts.counted_state != "outside":
            self.exited += 1
            ts.counted_state      = "outside"
            ts.last_counted_frame = frame_idx
            events.append(self._make_event(ts.tid, "EXIT", frame_idx))
            print(f"  < EXIT   tid={ts.tid:<4}  on_bus={self.on_bus}")
        return events

    def _make_event(self, tid: int, etype: str, frame_idx: int) -> dict:
        return {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "frame":     frame_idx,
            "tid":       tid,
            "event":     etype,
            "on_bus":    self.on_bus,
        }

    def reset(self):
        self.entered = 0
        self.exited  = 0
        print("[Counter] counts reset")


# =====================================================================
#  MODULE 4 — LOGGER
# =====================================================================

class EventLogger:
    """Appends every count event to a CSV for offline analytics."""

    FIELDS = ["timestamp", "frame", "tid", "event", "on_bus"]

    def __init__(self, path: str):
        self.path    = path
        self._file   = open(path, "w", newline="", buffering=1)
        self._writer = csv.DictWriter(self._file, fieldnames=self.FIELDS)
        self._writer.writeheader()
        print(f"[Logger] Logging to {path}")

    def log(self, events: list[dict]):
        for evt in events:
            self._writer.writerow(evt)

    def close(self):
        self._file.close()


# =====================================================================
#  MODULE 5 — VISUALIZER
# =====================================================================

C_ZONE_FILL  = (0,   55,  0)       # translucent green door zone
C_LINE_LEFT  = (0,   210, 80)      # left  vertical line  (green)
C_LINE_RIGHT = (0,   120, 255)     # right vertical line  (blue)
C_OUTSIDE    = (255, 200, 0)       # bounding box — outside (street)
C_INSIDE     = (0,   255, 120)     # bounding box — inside  (bus)
C_IN_ZONE    = (0,   210, 255)     # bounding box — in zone
C_TRAJ       = (160, 160, 160)     # trajectory colour
C_PANEL_BG   = (10,  10,  10)


def draw_scene(frame: np.ndarray,
               detections: list[dict],
               all_tracks: dict[int, TrackState],
               counter: PassengerCounter,
               zone_left: int, zone_right: int,
               fps: float,
               event_log: list = None,
               flash_event: str = None) -> np.ndarray:
    """Render detection overlay for top_down or frontal camera mode."""
    H, W = frame.shape[:2]

    # ── Flash border on ENTER/EXIT event ─────────────────────────────
    if flash_event == "ENTER":
        cv2.rectangle(frame, (0, 0), (W - 1, H - 1), (0, 255, 80), 6)
    elif flash_event == "EXIT":
        cv2.rectangle(frame, (0, 0), (W - 1, H - 1), (0, 100, 255), 6)

    if counter.mode == "frontal":
        _draw_frontal_zones(frame, counter, H, W)
    else:
        _draw_top_down_zones(frame, zone_left, zone_right, H)

    # ── Bounding boxes + trajectory trails ───────────────────────────
    det_by_tid = {d["tid"]: d for d in detections}

    for ts in all_tracks.values():
        if ts.frames_missing > 0:
            continue
        det = det_by_tid.get(ts.tid)
        if det is None:
            continue

        color = {
            "outside": C_OUTSIDE,
            "inside":  C_INSIDE,
            "in_zone": C_IN_ZONE,
        }.get(ts.zone_state, (200, 200, 200))

        x1, y1, x2, y2 = det["x1"], det["y1"], det["x2"], det["y2"]
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        label = f"#{ts.tid} {ts.zone_state}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 1)

        cx_box = (x1 + x2) // 2
        cy_box = (y1 + y2) // 2

        if counter.mode == "frontal":
            # Vertical trajectory trail (Y history)
            y_pts = list(ts.y_history)
            if len(y_pts) > 2:
                for i in range(1, len(y_pts)):
                    alpha = i / len(y_pts)
                    c = tuple(int(v * alpha) for v in C_TRAJ)
                    cv2.circle(frame, (cx_box, int(y_pts[i])), 2, c, -1)
            # Vertical velocity arrow
            vel = ts.velocity_y
            if vel is not None and abs(vel) > MIN_CROSS_SPEED:
                arr_len = int(np.clip(vel * 3, -45, 45))
                cv2.arrowedLine(frame,
                                (cx_box, cy_box),
                                (cx_box, cy_box + arr_len),
                                color, 2, tipLength=0.4)
        else:
            # Horizontal trajectory trail (X history)
            x_pts = list(ts.history)
            if len(x_pts) > 2:
                for i in range(1, len(x_pts)):
                    alpha = i / len(x_pts)
                    c = tuple(int(v * alpha) for v in C_TRAJ)
                    cv2.circle(frame, (int(x_pts[i]), cy_box), 2, c, -1)
            vel = ts.velocity_x
            if vel is not None and abs(vel) > MIN_CROSS_SPEED:
                arr_len = int(np.clip(vel * 3, -40, 40))
                cx_now  = int(ts.smooth_cx)
                cv2.arrowedLine(frame,
                                (cx_now, cy_box),
                                (cx_now + arr_len, cy_box),
                                color, 2, tipLength=0.4)

    # ── Stats panel (top-right) ───────────────────────────────────────
    pw, ph = 210, 110
    px = W - pw
    ov2 = frame.copy()
    cv2.rectangle(ov2, (px, 0), (W, ph), C_PANEL_BG, -1)
    cv2.addWeighted(ov2, 0.65, frame, 0.35, 0, frame)

    cv2.putText(frame, f"ON BUS : {counter.on_bus}",
                (px + 10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, C_INSIDE, 2)
    cv2.putText(frame, f"Entered: {counter.entered}",
                (px + 10, 56), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 1)
    cv2.putText(frame, f"Exited : {counter.exited}",
                (px + 10, 78), cv2.FONT_HERSHEY_SIMPLEX, 0.6, C_LINE_RIGHT, 1)
    mode_label = "FRONTAL" if counter.mode == "frontal" else "TOP-DOWN"
    cv2.putText(frame, f"FPS {fps:.1f}  [{mode_label}]",
                (px + 10, ph - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (140, 140, 140), 1)

    return frame


def _draw_top_down_zones(frame, zone_left, zone_right, H):
    """Vertical zone lines for top-down door camera."""
    overlay = frame.copy()
    cv2.rectangle(overlay, (zone_left, 0), (zone_right, H), C_ZONE_FILL, -1)
    cv2.addWeighted(overlay, 0.18, frame, 0.82, 0, frame)

    cv2.line(frame, (zone_left,  0), (zone_left,  H), C_LINE_LEFT,  2)
    cv2.line(frame, (zone_right, 0), (zone_right, H), C_LINE_RIGHT, 2)

    cv2.putText(frame, "OUTSIDE",
                (max(zone_left - 72, 2), H // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, C_LINE_LEFT, 1)
    cv2.putText(frame, "INSIDE",
                (zone_right + 6, H // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, C_LINE_RIGHT, 1)
    cv2.putText(frame, "DOOR ZONE",
                ((zone_left + zone_right) // 2 - 38, H // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)

    arrow_y = H - 16
    cv2.arrowedLine(frame, (zone_left - 10, arrow_y), (zone_right + 10, arrow_y),
                    C_INSIDE, 1, tipLength=0.15)
    cv2.putText(frame, "ENTER -->", (zone_left + 4, arrow_y - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, C_INSIDE, 1)


def _draw_frontal_zones(frame, counter: "PassengerCounter", H, W):
    """Horizontal counting line for frontal (laptop) camera."""
    zy   = counter.zone_y
    band = counter.zone_band

    # Transition band — translucent yellow
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, zy - band), (W, zy + band), (0, 80, 80), -1)
    cv2.addWeighted(overlay, 0.20, frame, 0.80, 0, frame)

    # Counting line — dashed cyan
    dash = 20
    for x in range(0, W, dash * 2):
        cv2.line(frame, (x, zy), (min(x + dash, W), zy), (0, 220, 220), 2)

    # Band edges
    cv2.line(frame, (0, zy - band), (W, zy - band), (0, 140, 140), 1)
    cv2.line(frame, (0, zy + band), (W, zy + band), (0, 140, 140), 1)

    # Labels
    inside_y  = zy - band - 12 if counter.enter_is_btt else zy + band + 18
    outside_y = zy + band + 18 if counter.enter_is_btt else zy - band - 12
    cv2.putText(frame, "INSIDE (bus)",   (8, inside_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, C_INSIDE,  1)
    cv2.putText(frame, "OUTSIDE (door)", (8, outside_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, C_OUTSIDE, 1)

    # Direction arrow
    arrow_x = W - 80
    if counter.enter_is_btt:
        cv2.arrowedLine(frame, (arrow_x, zy + 40), (arrow_x, zy - 40),
                        C_INSIDE, 2, tipLength=0.25)
        cv2.putText(frame, "ENTER", (arrow_x - 22, zy + 58),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, C_INSIDE, 1)
    else:
        cv2.arrowedLine(frame, (arrow_x, zy - 40), (arrow_x, zy + 40),
                        C_INSIDE, 2, tipLength=0.25)
        cv2.putText(frame, "ENTER", (arrow_x - 22, zy - 48),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, C_INSIDE, 1)


# =====================================================================
#  MAIN LOOP
# =====================================================================

def run(source, model_path: str = DEFAULT_MODEL, show: bool = True):
    zone_left  = int(FRAME_W * ZONE_LEFT_FRAC)
    zone_right = int(FRAME_W * ZONE_RIGHT_FRAC)
    zone_y     = int(FRAME_H * ZONE_Y_FRAC)
    zone_band  = int(FRAME_H * ZONE_BAND_FRAC)

    detector = Detector(model_path)
    memory   = TrackerMemory()

    if CAMERA_MODE == "frontal":
        counter = PassengerCounter(
            mode        = "frontal",
            zone_y      = zone_y,
            zone_band   = zone_band,
            enter_is_btt= ENTER_IS_BOTTOM_TO_TOP,
        )
    else:
        counter = PassengerCounter(
            zone_left   = zone_left,
            zone_right  = zone_right,
            enter_is_ltr= ENTER_IS_LEFT_TO_RIGHT,
            mode        = "top_down",
        )

    logger = EventLogger(LOG_FILE)

    cap = cv2.VideoCapture(source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    print("\n──────────────────────────────────────────────────────")
    print("  Bus Passenger Counter")
    print(f"  Mode      : {CAMERA_MODE.upper()}")
    print(f"  Model     : {model_path}")
    if CAMERA_MODE == "frontal":
        print(f"  Line Y    : {zone_y} px  (band ±{zone_band} px)")
        print(f"  Direction : {'UP = ENTER' if ENTER_IS_BOTTOM_TO_TOP else 'DOWN = ENTER'}")
    else:
        print(f"  Zone X    : {zone_left}–{zone_right} px")
        print(f"  Direction : {'LEFT->RIGHT = ENTER' if ENTER_IS_LEFT_TO_RIGHT else 'RIGHT->LEFT = ENTER'}")
    print(f"  Log       : {LOG_FILE}")
    print("  Keys      : ESC = quit   |   R = reset counts")
    print("──────────────────────────────────────────────────────\n")

    frame_idx  = 0
    fps_buf    = deque(maxlen=30)
    t_prev     = time.perf_counter()
    flash_evt  = None
    flash_ttl  = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str) and Path(source).is_file():
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break

        frame_idx += 1

        detections = detector.detect(frame)
        all_tracks = memory.update(detections)
        events     = counter.process(all_tracks, frame_idx)
        logger.log(events)

        if events:
            flash_evt = events[-1]["event"]
            flash_ttl = 8   # frames to show border

        t_now = time.perf_counter()
        fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
        t_prev = t_now
        fps    = float(np.mean(fps_buf))

        if show:
            cur_flash = flash_evt if flash_ttl > 0 else None
            flash_ttl = max(flash_ttl - 1, 0)

            frame = draw_scene(frame, detections, memory.all_tracks(),
                               counter, zone_left, zone_right, fps,
                               event_log=events, flash_event=cur_flash)
            cv2.imshow("Bus Counter  [ESC=quit  R=reset]", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == 27:
                break
            elif key == ord('r'):
                counter.reset()

    cap.release()
    if show:
        cv2.destroyAllWindows()
    logger.close()

    print(f"\nFinal — Entered: {counter.entered}  "
          f"Exited: {counter.exited}  On bus: {counter.on_bus}")


# =====================================================================
#  CLI
# =====================================================================

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Bus passenger counter — vertical zone")
    ap.add_argument("--source",  default=0,
                    help="Camera index (0,1,...) or path to a video file")
    ap.add_argument("--model",   default=DEFAULT_MODEL,
                    help="YOLOv8 weights  (yolov8n/s/m/l.pt)")
    ap.add_argument("--no-show", action="store_true",
                    help="Headless mode — no OpenCV window")
    args = ap.parse_args()

    src = args.source
    try:
        src = int(src)
    except (ValueError, TypeError):
        pass

    run(source=src, model_path=args.model, show=not args.no_show)