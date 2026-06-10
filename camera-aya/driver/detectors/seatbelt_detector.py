"""
Seatbelt detection — two modes:

Primary (recommended for deployment):
    Drop a custom YOLOv8 weights file named "seatbelt.pt" into this directory.
    Train with a labelled seatbelt dataset (e.g. Roboflow "Seatbelt Detection"
    public dataset).  The model must have exactly one class: seatbelt (index 0).

Fallback (no model file present):
    Hough-line heuristic — detects the diagonal strap crossing the driver's
    torso using Canny edges + probabilistic Hough transform.  Works reasonably
    well in controlled lighting; less reliable than a trained model.

In both modes the detector skips frames to stay within the real-time budget
(controlled by Config.YOLO_SKIP_FRAMES, same cadence as phone detection).

Returns
-------
detect(frame, face_box) -> (seatbelt_on: bool, confidence: float)

    seatbelt_on  – True  = strap visible / detected
                   False = no strap found → driver may not be wearing it
    confidence   – [0, 1] float; meaningful only when seatbelt_on is True
"""
import os
import cv2
import numpy as np
from config import Config

_MODELS_DIR    = os.path.dirname(os.path.abspath(__file__))
_SEATBELT_MODEL = os.path.join(_MODELS_DIR, "seatbelt.pt")

# Heuristic tuning
_HOUGH_THRESHOLD   = 60      # minimum votes for a Hough line
_MIN_LINE_RATIO    = 0.25    # line must span ≥ 25 % of ROI height
_DIAGONAL_MIN_DEG  = 15      # |angle from horizontal| accepted as diagonal
_DIAGONAL_MAX_DEG  = 75
_NEEDED_LINES      = 1       # how many qualifying lines = "strap found"


class SeatbeltDetector:

    def __init__(self):
        self._yolo = None
        if os.path.isfile(_SEATBELT_MODEL):
            try:
                from ultralytics import YOLO
                self._yolo = YOLO(_SEATBELT_MODEL)
                print("[SeatbeltDetector] Custom model seatbelt.pt loaded.")
            except Exception as e:
                print(f"[SeatbeltDetector] Failed to load seatbelt.pt – "
                      f"falling back to heuristic. ({e})")
        else:
            print("[SeatbeltDetector] seatbelt.pt not found – "
                  "using Hough-line heuristic (add seatbelt.pt for better accuracy).")

        self._frame_counter = 0
        self._last_result   = (True, 1.0)   # optimistic startup assumption

    # ── public ────────────────────────────────────────────────────────────────

    def detect(self, frame, face_box=None) -> tuple:
        """Return (seatbelt_on: bool, confidence: float)."""
        self._frame_counter += 1
        if self._frame_counter % Config.YOLO_SKIP_FRAMES != 0:
            return self._last_result

        if self._yolo is not None:
            result = self._yolo_detect(frame)
        else:
            result = self._heuristic_detect(frame, face_box)

        self._last_result = result
        return result

    # ── YOLO path ─────────────────────────────────────────────────────────────

    def _yolo_detect(self, frame) -> tuple:
        for r in self._yolo(
            frame, verbose=False,
            conf=Config.SEATBELT_CONF_THRESHOLD,
            classes=[0],
        ):
            for box in r.boxes:
                return True, float(box.conf[0])
        return False, 0.0

    # ── Hough-line heuristic ──────────────────────────────────────────────────

    def _heuristic_detect(self, frame, face_box) -> tuple:
        """
        Looks for a diagonal strap line in the torso ROI (below the face).

        Seatbelt geometry: a roughly 15-75° diagonal band running from the
        driver's left shoulder (or B-pillar) across the chest to the buckle
        near the right hip (or vice versa for right-hand-drive vehicles).
        """
        h, w = frame.shape[:2]

        # ── Define torso ROI ──────────────────────────────────────────────────
        if face_box is not None:
            _, _, _, fy2 = face_box
            y1 = max(0, fy2)
        else:
            y1 = h // 3

        y2 = int(h * 0.88)
        if y2 - y1 < 30:
            return False, 0.0

        roi = frame[y1:y2, :]

        # ── Edge detection ────────────────────────────────────────────────────
        gray  = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blur  = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 40, 120)

        # ── Probabilistic Hough lines ─────────────────────────────────────────
        roi_h = roi.shape[0]
        min_len = int(roi_h * _MIN_LINE_RATIO)
        lines = cv2.HoughLinesP(
            edges,
            rho=1, theta=np.pi / 180,
            threshold=_HOUGH_THRESHOLD,
            minLineLength=min_len,
            maxLineGap=25,
        )

        if lines is None:
            return False, 0.0

        diagonal_lines = []
        for line in lines:
            x1l, y1l, x2l, y2l = line[0]
            if x2l == x1l:
                continue
            angle_deg = abs(np.degrees(np.arctan2(y2l - y1l, x2l - x1l)))
            if _DIAGONAL_MIN_DEG <= angle_deg <= _DIAGONAL_MAX_DEG:
                length = np.hypot(x2l - x1l, y2l - y1l)
                diagonal_lines.append((length, angle_deg))

        if len(diagonal_lines) < _NEEDED_LINES:
            return False, 0.0

        # Confidence proportional to total diagonal edge coverage
        total_len  = sum(l for l, _ in diagonal_lines)
        diag_span  = np.sqrt(w**2 + roi_h**2)
        confidence = min(1.0, total_len / max(diag_span, 1.0))
        return True, round(confidence, 3)
