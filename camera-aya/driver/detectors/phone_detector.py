"""
Phone detection – two complementary strategies:

Strategy 1 – YOLO (every YOLO_SKIP_FRAMES)
  Pass A: full frame at PHONE_CONF_THRESHOLD (catches phone in hand / lap).
  Pass B: expanded face+ear ROI at PHONE_CONF_THRESHOLD_NEAR_FACE (much lower
          threshold) to catch the phone when it is partially occluded by the
          driver's face or hair while held to the ear.

Strategy 2 – MediaPipe Hands (every frame, lightweight)
  If a palm/wrist centre lands in the "ear zone" beside the face, flag it as
  possible phone usage even when the phone itself is completely hidden.  This
  is the most reliable way to detect "phone on ear" scenarios.

phone_detected is True when EITHER strategy fires.

Uses MediaPipe HandLandmarker (Tasks API) — compatible with mediapipe >= 0.10.14
and Python 3.13 (no mp.solutions dependency).
"""
import csv
import os
import time
import urllib.request
import cv2
import numpy as np
import mediapipe as mp
from config import Config

_MODELS_DIR = os.path.dirname(os.path.abspath(__file__))
_HAND_MODEL = os.path.join(_MODELS_DIR, "hand_landmarker.task")
_HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)


def _ensure_model(path, url):
    if not os.path.isfile(path):
        print(f"[PhoneDetector] Downloading model → {os.path.basename(path)} …")
        urllib.request.urlretrieve(url, path)
        print(f"[PhoneDetector] Model saved to {path}")


def _overlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2):
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def _iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter
    return inter / max(union, 1)


def _deduplicate(boxes, thresh=0.45):
    kept = []
    for box in boxes:
        if not any(_iou(box, k) > thresh for k in kept):
            kept.append(box)
    return kept


class PhoneDetector:
    def __init__(self):
        # ── YOLO ──────────────────────────────────────────────────────────────
        try:
            from ultralytics import YOLO
            self.model    = YOLO(Config.YOLO_MODEL)
            self._yolo_ok = True
            print("[PhoneDetector] YOLOv8 loaded.")
        except Exception as e:
            print(f"[PhoneDetector] YOLO unavailable – phone object detection "
                  f"disabled. ({e})")
            self._yolo_ok = False

        # ── MediaPipe HandLandmarker (Tasks API) ──────────────────────────────
        _ensure_model(_HAND_MODEL, _HAND_MODEL_URL)
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=_HAND_MODEL),
            num_hands=2,
            min_hand_detection_confidence=Config.HAND_DETECT_CONFIDENCE,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._hands = mp.tasks.vision.HandLandmarker.create_from_options(options)

        self._frame_counter = 0
        self._last_boxes    = []
        self._last_detected = False

        # ── Confidence / false-positive logging ───────────────────────────────
        # Logs every YOLO hit and hand-at-ear trigger to a CSV so you can
        # review confidence distributions and tune thresholds post-hoc.
        # Set Config.PHONE_LOG_DETECTIONS = False to disable.
        self._log_path   = getattr(Config, "PHONE_DETECTION_LOG", "phone_detections.csv")
        self._log_enabled = getattr(Config, "PHONE_LOG_DETECTIONS", True)
        self._log_file   = None
        self._log_writer = None
        if self._log_enabled:
            self._log_file   = open(self._log_path, "w", newline="")
            self._log_writer = csv.writer(self._log_file)
            self._log_writer.writerow(
                ["wall_time", "frame", "strategy", "confidence",
                 "near_face", "final_detected"]
            )

        # running counters for in-session false-positive estimate
        self._total_frames   = 0
        self._yolo_hits      = 0    # frames where YOLO fired
        self._hand_hits      = 0    # frames where hand-at-ear fired
        self._confirmed_hits = 0    # frames where final detected=True

    # ── public ────────────────────────────────────────────────────────────────

    def detect(self, frame, face_box=None):
        """
        Returns (phone_detected: bool, boxes: list[tuple(x1,y1,x2,y2)]).

        `boxes` are YOLO phone rectangles.  When detection fires only via the
        hand-at-ear path there are no boxes, but phone_detected is still True.
        """
        h, w = frame.shape[:2]
        self._total_frames += 1

        # Strategy 2: hand at ear (every frame)
        hand_at_ear = self._hand_at_ear(frame, face_box, w, h)
        if hand_at_ear:
            self._hand_hits += 1
            self._log_row("hand_ear", 1.0, face_box is not None, None)

        # Strategy 1: YOLO (every N frames)
        self._frame_counter += 1
        ran_yolo = False
        if self._yolo_ok and self._frame_counter % Config.YOLO_SKIP_FRAMES == 0:
            self._last_boxes, yolo_confs = self._run_yolo_with_conf(frame, face_box, w, h)
            ran_yolo = True
            if self._last_boxes:
                self._yolo_hits += 1
                for conf in yolo_confs:
                    self._log_row("yolo", conf, face_box is not None, None)

        yolo_near = self._is_near_driver(self._last_boxes, face_box, w, h)

        detected = yolo_near or hand_at_ear
        if detected:
            self._confirmed_hits += 1
        if ran_yolo or hand_at_ear:
            self._log_row(
                "final", 1.0 if detected else 0.0,
                face_box is not None, detected,
            )

        self._last_detected = detected
        return detected, self._last_boxes

    def detection_stats(self) -> dict:
        """Return accumulated session detection statistics."""
        return {
            "total_frames":   self._total_frames,
            "yolo_hits":      self._yolo_hits,
            "hand_hits":      self._hand_hits,
            "confirmed_hits": self._confirmed_hits,
            "yolo_fire_rate": round(self._yolo_hits / max(self._total_frames, 1), 4),
            "hand_fire_rate": round(self._hand_hits / max(self._total_frames, 1), 4),
        }

    def close(self):
        self._hands.close()
        if self._log_file:
            self._log_file.flush()
            self._log_file.close()
            self._log_file = None

    # ── YOLO helpers ──────────────────────────────────────────────────────────

    def _run_yolo_with_conf(self, frame, face_box, w, h):
        """Returns (boxes, confidences). Replaces old _run_yolo."""
        boxes  = []
        confs  = []

        # Pass A – full frame, normal threshold
        for r in self.model(
            frame, verbose=False,
            conf=Config.PHONE_CONF_THRESHOLD,
            classes=[Config.PHONE_CLASS_ID],
        ):
            for box in r.boxes:
                boxes.append(tuple(map(int, box.xyxy[0])))
                confs.append(float(box.conf[0]))

        # Pass B – expanded face+ear ROI, lower threshold
        if face_box is not None:
            fx1, fy1, fx2, fy2 = face_box
            fw = fx2 - fx1
            rx1 = max(0, fx1 - fw)
            rx2 = min(w, fx2 + fw)
            roi = frame[fy1:fy2, rx1:rx2]
            if roi.size > 0:
                for r in self.model(
                    roi, verbose=False,
                    conf=Config.PHONE_CONF_THRESHOLD_NEAR_FACE,
                    classes=[Config.PHONE_CLASS_ID],
                ):
                    for box in r.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        boxes.append((x1 + rx1, y1 + fy1,
                                      x2 + rx1, y2 + fy1))
                        confs.append(float(box.conf[0]))

        deduped = _deduplicate(boxes)
        # Keep confs aligned after dedup (best effort — take first-seen conf)
        kept_confs = confs[:len(deduped)]
        return deduped, kept_confs

    def _log_row(self, strategy: str, confidence: float,
                 near_face: bool, final_detected):
        if not self._log_enabled or self._log_writer is None:
            return
        self._log_writer.writerow([
            round(time.time(), 3),
            self._frame_counter,
            strategy,
            round(confidence, 4),
            int(near_face),
            "" if final_detected is None else int(final_detected),
        ])

    def _is_near_driver(self, boxes, face_box, w, h):
        if not boxes:
            return False
        if face_box is None:
            return True

        fx1, fy1, fx2, fy2 = face_box
        fw, fh = fx2 - fx1, fy2 - fy1
        f = Config.PHONE_PROXIMITY_FACTOR
        pfx1 = fx1 - int(fw * (f - 1) / 2)
        pfx2 = fx2 + int(fw * (f - 1) / 2)
        pfy1 = fy1 - int(fh * (f - 1) / 2)
        pfy2 = fy2 + int(fh * (f - 1) / 2)

        for (bx1, by1, bx2, by2) in boxes:
            if _overlap(pfx1, pfy1, pfx2, pfy2, bx1, by1, bx2, by2):
                return True
            if by2 > h // 2:
                return True
        return False

    # ── hand-at-ear detection (Tasks API) ────────────────────────────────────

    def _hand_at_ear(self, frame, face_box, w, h):
        """
        Returns True when a palm centre sits inside the ear zone.

        Ear zone definition (all relative to face bounding box):
          x: face_x1 - HAND_EAR_X_EXTEND * fw  …  face_x2 + HAND_EAR_X_EXTEND * fw
          y: face_y1 - TOP_EXTEND * fh           …  face_y2 + BOT_EXTEND * fh
        """
        if face_box is None:
            return False

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = self._hands.detect(mp_image)

        if not results.hand_landmarks:
            return False

        fx1, fy1, fx2, fy2 = face_box
        fw = fx2 - fx1
        fh = fy2 - fy1

        zx1 = fx1 - int(Config.HAND_EAR_X_EXTEND   * fw)
        zx2 = fx2 + int(Config.HAND_EAR_X_EXTEND   * fw)
        zy1 = fy1 - int(Config.HAND_EAR_Y_TOP_EXTEND * fh)
        zy2 = fy2 + int(Config.HAND_EAR_Y_BOT_EXTEND * fh)

        for hand_lm in results.hand_landmarks:
            # Wrist (0) + middle-finger MCP (9) → stable palm centre
            wrist = hand_lm[0]
            palm  = hand_lm[9]
            hcx = int(((wrist.x + palm.x) / 2) * w)
            hcy = int(((wrist.y + palm.y) / 2) * h)

            if zx1 <= hcx <= zx2 and zy1 <= hcy <= zy2:
                return True

        return False
