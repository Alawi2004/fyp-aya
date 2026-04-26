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
 
DEFAULT_MODEL        = "yolov8n.pt"   # yolov8n (fast/accurate), yolov8s, yolov8m
CONF_THRESH          = 0.45          # Confidence threshold (0.45 = good balance)
IOU_THRESH           = 0.50          # IOU threshold for NMS (0.50 = balanced)
FRAME_W              = 640           # Frame width (640 = fast processing)
FRAME_H              = 480           # Frame height (480 = real-time speed)

# Door zone as fraction of frame WIDTH (vertical trigger lines)
ZONE_LEFT_FRAC       = 0.30    # left  boundary of door zone  (30% from left)
ZONE_RIGHT_FRAC      = 0.70    # right boundary of door zone  (70% from left)
ZONE_BUFFER          = 0.08    # Buffer zone to avoid false positives at boundaries

# Direction convention
# True  -> left-to-right = ENTER (street is on the left side of the frame)
# False -> right-to-left = ENTER (street is on the right side of the frame)
ENTER_IS_LEFT_TO_RIGHT = True

# Trajectory / smoothing for better accuracy
HISTORY_LEN          = 30      # History for tracking
SMOOTH_LEN           = 8       # Smoothing for position estimation
MIN_CROSS_SPEED      = 0.3     # Minimum speed to count crossing (reduced for slow pedestrians)
REENTRY_COOLDOWN     = 60      # Cooldown to prevent double-counting

# Video quality settings
VIDEO_FPS            = 15      # Capture at 15 FPS for speed
JPEG_QUALITY         = 75      # JPEG compression quality (75 = good quality & fast)

LOG_FILE             = "passenger_log.csv"

# Advanced accuracy options
USE_HALF_PRECISION   = False   # Use FP16 for faster inference (disable on CPU)
DEVICE               = "cpu"   # "cpu" or 0 (GPU) - use CPU if no GPU available
MAX_DET              = 300     # Maximum detections per frame
AGNOSTIC_NMS         = True    # Class-agnostic NMS for better people detection
# ─────────────────────────────────────────────────────────────────────────────
 
 
# =====================================================================
#  DATA STRUCTURES
# =====================================================================
 
@dataclass
class TrackState:
    """
    Per-person state maintained across frames.
 
    history stores the X-centroid (horizontal position) each frame.
    All counting logic operates on X, not Y, because passengers
    walk horizontally through the door in the top-down camera view.
    """
    tid: int
 
    # X-centroid history (horizontal movement = direction of travel)
    history: deque = field(default_factory=lambda: deque(maxlen=HISTORY_LEN))
 
    # Confidence score history for better tracking
    conf_history: deque = field(default_factory=lambda: deque(maxlen=HISTORY_LEN))
 
    # Which region the person currently occupies:
    #   "outside"  - left of zone  (street side)
    #   "in_zone"  - inside the door zone  (transitioning)
    #   "inside"   - right of zone (bus interior)
    zone_state:     str = "unknown"
    counted_state:  str = "unknown"   # last zone state a count was fired for
    last_counted_frame: int = -999    # cooldown anchor frame
    frames_missing: int = 0           # frames not seen (occlusion tolerance)
 
    @property
    def smooth_cx(self) -> Optional[float]:
        """Smoothed X-centroid (weighted mean of recent samples)."""
        if not self.history:
            return None
        pts = list(self.history)[-SMOOTH_LEN:]
        confs = list(self.conf_history)[-SMOOTH_LEN:]
        
        # Confidence-weighted average for more robust tracking
        if len(confs) < len(pts):
            confs.extend([1.0] * (len(pts) - len(confs)))
        
        total_conf = sum(confs)
        if total_conf == 0:
            return float(np.mean(pts))
        
        weighted_sum = sum(p * c for p, c in zip(pts, confs))
        return weighted_sum / total_conf
 
    @property
    def velocity_x(self) -> Optional[float]:
        """
        Mean horizontal velocity over recent frames (px/frame).
        Positive = moving right (outside->inside if ENTER_IS_LEFT_TO_RIGHT).
        Negative = moving left  (inside->outside).
        Uses Kalman-like smoothing for stability.
        """
        if len(self.history) < 3:
            return None
        pts = list(self.history)
        # Use last 8 frames for velocity calculation
        n = min(8, len(pts))
        if n < 2:
            return None
        
        # Linear regression for more stable velocity estimate
        x_vals = np.arange(n)
        y_vals = np.array(pts[-n:])
        coeffs = np.polyfit(x_vals, y_vals, 1)
        return float(coeffs[0])  # slope = velocity
 
 
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
        # Load model on specified device
        self.model.to(DEVICE)
        print(f"[Detector] Model loaded on device: {DEVICE}")
 
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
            device=DEVICE,          # use configured device
            half=USE_HALF_PRECISION,  # use FP16 for speed
            max_det=MAX_DET,        # limit detections
            agnostic_nms=AGNOSTIC_NMS,  # agnostic NMS
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
        Appends X-centroid and confidence to each track's history.
        Ages out long-missing tracks.
        Returns list of all currently alive TrackStates.
        """
        seen_ids: set[int] = set()
 
        for det in detections:
            tid = det["tid"]
            # X-centroid — the horizontal axis is what we count on
            cx = (det["x1"] + det["x2"]) // 2
            conf = det.get("conf", 1.0)
            seen_ids.add(tid)
 
            if tid not in self._tracks:
                self._tracks[tid] = TrackState(tid=tid)
 
            ts = self._tracks[tid]
            ts.history.append(cx)
            ts.conf_history.append(conf)
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
    Counts passengers crossing the vertical door zone.
 
    State machine per track:
 
        "outside" --enters zone--> "in_zone" --exits right--> "inside"  (+1 ENTER)
        "inside"  --enters zone--> "in_zone" --exits left --> "outside" (+1 EXIT)
 
    A count only fires after the person FULLY exits the zone on the
    destination side.  Someone who enters the zone then retreats back
    does NOT generate a count.
 
    Speed gate: if the person barely moves (standing in the doorway),
    velocity < MIN_CROSS_SPEED so no spurious count fires.
 
    Cooldown gate: once counted, the same tid cannot count again for
    REENTRY_COOLDOWN frames to handle brief boundary oscillation.
    """
 
    def __init__(self, zone_left: int, zone_right: int,
                 enter_is_ltr: bool = True):
        self.zone_left    = zone_left
        self.zone_right   = zone_right
        self.enter_is_ltr = enter_is_ltr   # left->right = entering bus
        self.entered      = 0
        self.exited       = 0
 
    @property
    def on_bus(self) -> int:
        return max(self.entered - self.exited, 0)
 
    def _region(self, cx: float) -> str:
        """Map an X pixel position to a named region."""
        if cx < self.zone_left:
            return "left_side"
        elif cx > self.zone_right:
            return "right_side"
        else:
            return "in_zone"
 
    def _to_semantic(self, geo: str) -> str:
        """
        Translate geometric side to semantic region based on camera config.
        "left_side"  -> "outside" (if enter_is_ltr) or "inside"
        "right_side" -> "inside"  (if enter_is_ltr) or "outside"
        """
        if self.enter_is_ltr:
            return {"left_side": "outside", "right_side": "inside"}.get(geo, geo)
        else:
            return {"left_side": "inside", "right_side": "outside"}.get(geo, geo)
 
    def process(self, tracks: list[TrackState], frame_idx: int) -> list[dict]:
        """
        Evaluate every track.  Returns list of count events fired this frame.
        """
        events = []
        
        # Debug: log number of tracks every 30 frames
        if frame_idx % 30 == 0 and len(tracks) > 0:
            print(f"[Counter] Frame {frame_idx}: {len(tracks)} active tracks")
 
        for ts in tracks:
            cx = ts.smooth_cx
            if cx is None:
                continue
 
            # Filter by minimum average confidence for better accuracy
            avg_conf = np.mean(list(ts.conf_history)) if ts.conf_history else 1.0
            if avg_conf < (CONF_THRESH * 0.5):  # More lenient confidence threshold
                continue
 
            geo = self._region(cx)
            sem = self._to_semantic(geo) if geo != "in_zone" else "in_zone"
 
            # First appearance: initialise without counting
            if ts.zone_state == "unknown":
                ts.zone_state    = sem
                ts.counted_state = sem
                continue
 
            prev_state    = ts.zone_state
            ts.zone_state = sem
 
            # Only evaluate when LEAVING the zone (not entering it)
            if prev_state != "in_zone" or sem == "in_zone":
                continue
 
            # Speed gate: only reject if essentially stationary
            vel = ts.velocity_x
            if vel is not None and abs(vel) < 0.05:  # Only filter if not moving (standing still)
                continue
 
            # Cooldown gate: prevent rapid re-counting of the same person
            if (frame_idx - ts.last_counted_frame) <= REENTRY_COOLDOWN:
                continue
 
            # Fire count
            if sem == "inside" and ts.counted_state != "inside":
                self.entered += 1
                ts.counted_state      = "inside"
                ts.last_counted_frame = frame_idx
                evt = self._make_event(ts.tid, "ENTER", frame_idx, avg_conf)
                events.append(evt)
                print(f"  > ENTER  tid={ts.tid:<4}  conf={avg_conf:.2f}  on_bus={self.on_bus}")
 
            elif sem == "outside" and ts.counted_state != "outside":
                self.exited += 1
                ts.counted_state      = "outside"
                ts.last_counted_frame = frame_idx
                evt = self._make_event(ts.tid, "EXIT", frame_idx, avg_conf)
                events.append(evt)
                print(f"  < EXIT   tid={ts.tid:<4}  conf={avg_conf:.2f}  on_bus={self.on_bus}")
 
        return events
 
    def _make_event(self, tid: int, etype: str, frame_idx: int, confidence: float = 1.0) -> dict:
        return {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "frame":     frame_idx,
            "tid":       tid,
            "event":     etype,
            "on_bus":    self.on_bus,
            "confidence": round(confidence, 3),
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
 
    FIELDS = ["timestamp", "frame", "tid", "event", "on_bus", "confidence"]
 
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
               fps: float) -> np.ndarray:
    """
    Renders:
      1. Translucent vertical door-zone rectangle
      2. Two vertical trigger lines with OUTSIDE / INSIDE labels
      3. Per-person bounding box + ID label + horizontal trajectory trail
      4. Velocity direction arrow on each centroid
      5. Stats panel (top-right corner)
    """
    H, W = frame.shape[:2]
 
    # 1. Door zone overlay (vertical band)
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
 
    # Enter direction arrow at bottom
    arrow_y = H - 16
    cv2.arrowedLine(frame,
                    (zone_left - 10, arrow_y),
                    (zone_right + 10, arrow_y),
                    C_INSIDE, 1, tipLength=0.15)
    cv2.putText(frame, "ENTER -->",
                (zone_left + 4, arrow_y - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, C_INSIDE, 1)
 
    # 2. Bounding boxes, IDs, X-trajectory trails
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
 
        label = f"#{ts.tid}  {ts.zone_state}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 1)
 
        # Horizontal trajectory dots (X history, fixed Y at box centre)
        cy_fixed = (y1 + y2) // 2
        pts = list(ts.history)
        if len(pts) > 2:
            for i in range(1, len(pts)):
                alpha = i / len(pts)
                c = tuple(int(v * alpha) for v in C_TRAJ)
                cv2.circle(frame, (int(pts[i]), cy_fixed), 2, c, -1)
 
        # Velocity arrow on centroid
        vel = ts.velocity_x
        if vel is not None and abs(vel) > MIN_CROSS_SPEED:
            cx_now     = int(ts.smooth_cx)
            arrow_len  = int(np.clip(vel * 3, -40, 40))
            cv2.arrowedLine(frame,
                            (cx_now, cy_fixed),
                            (cx_now + arrow_len, cy_fixed),
                            color, 2, tipLength=0.4)
 
    # 3. Stats panel — top-right corner
    pw, ph = 200, 100
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
    cv2.putText(frame, f"FPS {fps:.1f}",
                (px + 10, ph - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (140, 140, 140), 1)
 
    return frame
 
 
# =====================================================================
#  MAIN LOOP
# =====================================================================
 
def run(source, model_path: str = DEFAULT_MODEL, show: bool = True):
    zone_left  = int(FRAME_W * ZONE_LEFT_FRAC)
    zone_right = int(FRAME_W * ZONE_RIGHT_FRAC)
 
    detector = Detector(model_path)
    memory   = TrackerMemory()
    counter  = PassengerCounter(zone_left, zone_right,
                                enter_is_ltr=ENTER_IS_LEFT_TO_RIGHT)
    logger   = EventLogger(LOG_FILE)
 
    cap = cv2.VideoCapture(source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # no stale-frame lag
 
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")
 
    print("\n──────────────────────────────────────────────────────")
    print("  Bus Passenger Counter  —  Vertical Zone Edition")
    print(f"  Model     : {model_path}")
    print(f"  Zone X    : {zone_left}–{zone_right} px")
    print(f"  Direction : {'LEFT->RIGHT = ENTER' if ENTER_IS_LEFT_TO_RIGHT else 'RIGHT->LEFT = ENTER'}")
    print(f"  Log       : {LOG_FILE}")
    print("  Keys      : ESC = quit   |   R = reset counts")
    print("──────────────────────────────────────────────────────\n")
 
    frame_idx = 0
    fps_buf   = deque(maxlen=30)
    t_prev    = time.perf_counter()
 
    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str) and Path(source).is_file():
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break
 
        frame_idx += 1
 
        # Step 1: detect people + assign ByteTrack IDs
        detections = detector.detect(frame)
 
        # Step 2: update per-track state (X-centroid history)
        all_tracks = memory.update(detections)
 
        # Step 3: evaluate zone crossings, fire count events
        events = counter.process(all_tracks, frame_idx)
 
        # Step 4: log to CSV
        logger.log(events)
 
        # Step 5: FPS
        t_now   = time.perf_counter()
        fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
        t_prev  = t_now
        fps     = float(np.mean(fps_buf))
 
        # Step 6: render
        if show:
            frame = draw_scene(frame, detections, memory.all_tracks(),
                               counter, zone_left, zone_right, fps)
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