"""
Driver-monitor accuracy evaluation script.
==========================================

Runs the full detection pipeline on a video file and measures:
  • Drowsiness (EAR-based instantaneous + PERCLOS)
  • Phone detection
  • Seatbelt detection
  • Gaze direction

If you supply a ground-truth CSV the script computes precision, recall, and F1
for each class.  Without annotations it produces a statistics summary and a
per-frame prediction CSV that you can label afterwards.

Usage
-----
  # No annotations – just collect predictions
  python evaluate.py --video test_clip.mp4

  # With ground-truth annotations
  python evaluate.py --video test_clip.mp4 --annotations labels.csv

  # Also save an annotated output video
  python evaluate.py --video test_clip.mp4 --output-video results.mp4

Ground-truth CSV format (one row per frame, 0-indexed):
  frame,drowsy,phone,seatbelt_on
  0,0,0,1
  1,0,0,1
  ...

Columns:
  frame        – 0-based frame index
  drowsy       – 1 = driver is drowsy, 0 = alert
  phone        – 1 = phone in use, 0 = none
  seatbelt_on  – 1 = seatbelt worn, 0 = not worn
"""

import argparse
import csv
import os
import sys
import time
import types

import cv2
import numpy as np

# ── Path / config bootstrap (mirrors server.py) ───────────────────────────────

_HERE         = os.path.dirname(os.path.abspath(__file__))
_DRIVER_DIR   = os.path.join(_HERE, "driver")
_PASSENGER_DIR = os.path.join(_HERE, "passenger")

_YOLO_PATH = os.path.join(_DRIVER_DIR, "yolov8n.pt")
if not os.path.isfile(_YOLO_PATH):
    _YOLO_PATH = os.path.join(_HERE, "yolov8n.pt")
if not os.path.isfile(_YOLO_PATH):
    _YOLO_PATH = "yolov8n.pt"

_cfg_mod = types.ModuleType("config")

class _Config:
    CAMERA_INDEX                   = 0
    FRAME_WIDTH                    = 1280
    FRAME_HEIGHT                   = 720
    YOLO_MODEL                     = _YOLO_PATH
    PERSON_CLASS_ID                = 0
    DETECTION_CONF                 = 0.50
    TRACKER                        = "bytetrack.yaml"
    LINE_ORIENTATION               = "vertical"
    LINE_A_POSITION                = 0.35
    LINE_B_POSITION                = 0.65
    ENTRY_DIRECTION                = "left_to_right"
    LINE_FLASH_SECS                = 0.7
    BUS_CAPACITY                   = 50
    DB_FILE                        = "logs/eval_data.db"
    LOG_FILE                       = "logs/eval_log.csv"
    EXPORT_JSON                    = "logs/eval_live.json"
    EXPORT_INTERVAL_SECS           = 5
    SNAPSHOT_INTERVAL_SECS         = 30
    API_HOST                       = "0.0.0.0"
    API_PORT                       = 5050
    EAR_THRESHOLD                  = 0.22
    EYE_CLOSED_ALERT_SECS          = 2.0
    GAZE_AWAY_ALERT_SECS           = 3.0
    LOOK_DOWN_ALERT_SECS           = 2.0
    PHONE_ALERT_SECS               = 1.5
    NO_FACE_ALERT_SECS             = 3.0
    DROWSY_ALERT_SECS              = 0.0
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
    PERCLOS_WINDOW_SECS            = 60.0
    PERCLOS_DROWSY_THRESHOLD       = 0.15
    SEATBELT_MODEL                 = "seatbelt.pt"
    SEATBELT_CONF_THRESHOLD        = 0.40
    SEATBELT_OFF_ALERT_SECS        = 2.0
    PHONE_LOG_DETECTIONS           = False   # disabled during eval to reduce I/O
    PHONE_DETECTION_LOG            = "eval_phone_log.csv"

_cfg_mod.Config = _Config
sys.modules["config"] = _cfg_mod

sys.path.insert(0, _DRIVER_DIR)

from detectors.face_detector     import FaceDetector
from detectors.eye_detector      import EyeDetector, PERCLOSTracker
from detectors.gaze_estimator    import GazeEstimator
from detectors.phone_detector    import PhoneDetector
from detectors.seatbelt_detector import SeatbeltDetector

sys.path.remove(_DRIVER_DIR)
sys.modules["config"] = _cfg_mod


# ── Metrics helpers ───────────────────────────────────────────────────────────

def _precision_recall_f1(tp, fp, fn):
    precision = tp / max(tp + fp, 1)
    recall    = tp / max(tp + fn, 1)
    f1        = (2 * precision * recall) / max(precision + recall, 1e-9)
    return precision, recall, f1


def _print_metric(label, tp, fp, fn, total):
    p, r, f = _precision_recall_f1(tp, fp, fn)
    tn = total - tp - fp - fn
    acc = (tp + tn) / max(total, 1)
    print(f"  {label:<18}  P={p:.3f}  R={r:.3f}  F1={f:.3f}  Acc={acc:.3f}"
          f"  (TP={tp} FP={fp} FN={fn} TN={tn})")


# ── Main ──────────────────────────────────────────────────────────────────────

def evaluate(video_path: str,
             annotations_path: str | None,
             output_video: str | None,
             max_frames: int = 0):

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        sys.exit(f"[evaluate] Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_video    = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"[evaluate] Video : {video_path}")
    print(f"[evaluate] Frames: {total_frames}  FPS: {fps_video:.1f}  "
          f"Size: {width}x{height}")

    # ── Ground-truth annotations ──────────────────────────────────────────────
    gt: dict[int, dict] = {}
    if annotations_path:
        with open(annotations_path, newline="") as f:
            for row in csv.DictReader(f):
                idx = int(row["frame"])
                gt[idx] = {
                    "drowsy":      int(row.get("drowsy",      0)),
                    "phone":       int(row.get("phone",       0)),
                    "seatbelt_on": int(row.get("seatbelt_on", 1)),
                }
        print(f"[evaluate] Loaded {len(gt)} annotated frames from {annotations_path}")
    else:
        print("[evaluate] No annotations – running in prediction-only mode.")

    # ── Detectors ─────────────────────────────────────────────────────────────
    face_det     = FaceDetector()
    eye_det      = EyeDetector()
    perclos      = PERCLOSTracker()
    gaze_est     = GazeEstimator()
    phone_det    = PhoneDetector()
    seatbelt_det = SeatbeltDetector()

    # ── Output video writer ───────────────────────────────────────────────────
    writer = None
    if output_video:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_video, fourcc, fps_video, (width, height))

    # ── Prediction CSV ────────────────────────────────────────────────────────
    pred_csv_path = os.path.splitext(video_path)[0] + "_eval_predictions.csv"
    pred_file  = open(pred_csv_path, "w", newline="")
    pred_writer = csv.writer(pred_file)
    pred_writer.writerow([
        "frame", "face_detected", "ear", "eyes_closed",
        "perclos", "perclos_drowsy",
        "gaze", "phone_detected", "seatbelt_on",
    ])

    # ── Metric counters ───────────────────────────────────────────────────────
    counts = {
        "drowsy":      {"tp": 0, "fp": 0, "fn": 0},
        "phone":       {"tp": 0, "fp": 0, "fn": 0},
        "seatbelt_off":{"tp": 0, "fp": 0, "fn": 0},
    }

    # ── Process frames ────────────────────────────────────────────────────────
    frame_idx  = 0
    t0         = time.perf_counter()
    processed  = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if max_frames and frame_idx >= max_frames:
            break

        now = frame_idx / fps_video

        # Detections
        face_res   = face_det.detect(frame)
        face_found = bool(face_res and face_res.multi_face_landmarks)

        ear_val        = 0.30
        eyes_closed_v  = False
        perclos_val    = 0.0
        perclos_drowsy = False
        gaze_val       = "unknown"
        face_box       = None

        if face_found:
            lm = face_res.multi_face_landmarks[0]
            h, w = frame.shape[:2]
            _, _, ear_val, eyes_closed_v = eye_det.compute(lm, w, h)
            perclos_val, perclos_drowsy  = perclos.update(now, ear_val)
            gaze_val                     = gaze_est.estimate(lm, w, h, frame)
            face_box                     = face_det.get_face_box(lm, w, h)

        phone_detected, phone_boxes = phone_det.detect(frame, face_box)
        seatbelt_on, _              = seatbelt_det.detect(frame, face_box)

        # Write prediction row
        pred_writer.writerow([
            frame_idx, int(face_found), round(ear_val, 4),
            int(eyes_closed_v),
            perclos_val, int(perclos_drowsy),
            gaze_val, int(phone_detected), int(seatbelt_on),
        ])

        # Metric counting
        if frame_idx in gt:
            row_gt = gt[frame_idx]

            pred_drowsy   = int(perclos_drowsy or eyes_closed_v)
            pred_phone    = int(phone_detected)
            pred_sb_off   = int(not seatbelt_on)

            for key, pred, label_key, invert in [
                ("drowsy",       pred_drowsy, "drowsy",      False),
                ("phone",        pred_phone,  "phone",       False),
                ("seatbelt_off", pred_sb_off, "seatbelt_on", True),
            ]:
                gt_val = row_gt[label_key]
                if invert:
                    gt_val = 1 - gt_val
                if pred == 1 and gt_val == 1:
                    counts[key]["tp"] += 1
                elif pred == 1 and gt_val == 0:
                    counts[key]["fp"] += 1
                elif pred == 0 and gt_val == 1:
                    counts[key]["fn"] += 1

        # Annotate output video
        if writer is not None:
            h_f, w_f = frame.shape[:2]
            label = (f"F{frame_idx} | EAR:{ear_val:.2f} | "
                     f"PERCLOS:{perclos_val:.2f} | "
                     f"Phone:{'Y' if phone_detected else 'N'} | "
                     f"Belt:{'Y' if seatbelt_on else 'N'}")
            cv2.putText(frame, label, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            if perclos_drowsy:
                cv2.putText(frame, "DROWSY (PERCLOS)", (10, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            if phone_detected and phone_boxes:
                for (x1, y1, x2, y2) in phone_boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            writer.write(frame)

        frame_idx += 1
        processed += 1

        if processed % 100 == 0:
            elapsed = time.perf_counter() - t0
            print(f"  Frame {frame_idx}/{total_frames}  "
                  f"({processed / elapsed:.1f} fps processing)")

    # ── Cleanup ───────────────────────────────────────────────────────────────
    cap.release()
    if writer:
        writer.release()
    pred_file.close()
    face_det.close()
    phone_det.close()

    elapsed_total = time.perf_counter() - t0

    # ── Report ────────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print(f"  Evaluation complete")
    print(f"  Frames processed : {processed}")
    print(f"  Wall-clock time  : {elapsed_total:.1f} s  "
          f"({processed / max(elapsed_total, 0.001):.1f} fps)")
    print(f"  Predictions CSV  : {pred_csv_path}")

    phone_stats = phone_det.detection_stats()
    print()
    print("  Phone detector session stats:")
    print(f"    YOLO fire rate : {phone_stats['yolo_fire_rate']:.3f}  "
          f"({phone_stats['yolo_hits']} hits / {phone_stats['total_frames']} frames)")
    print(f"    Hand fire rate : {phone_stats['hand_fire_rate']:.3f}  "
          f"({phone_stats['hand_hits']} hits)")
    print(f"    Confirmed rate : "
          f"{phone_stats['confirmed_hits'] / max(phone_stats['total_frames'],1):.3f}")

    if gt:
        total_annotated = len(gt)
        print()
        print(f"  Detection metrics  (annotated frames: {total_annotated})")
        print("-" * 60)
        for key, label in [
            ("drowsy",       "Drowsy (EAR+PERCLOS)"),
            ("phone",        "Phone detected"),
            ("seatbelt_off", "Seatbelt off"),
        ]:
            c = counts[key]
            _print_metric(label, c["tp"], c["fp"], c["fn"], total_annotated)
    else:
        print()
        print("  (No ground-truth annotations – metrics not computed.)")
        print("  Label the predictions CSV and re-run with --annotations to get metrics.")

    print("=" * 60)


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evaluate driver monitor accuracy on a test video.")
    parser.add_argument("--video",        required=True,
                        help="Path to test video file (mp4, avi, …)")
    parser.add_argument("--annotations",  default=None,
                        help="CSV file with per-frame ground-truth labels")
    parser.add_argument("--output-video", default=None,
                        help="Save annotated output video to this path")
    parser.add_argument("--max-frames",   type=int, default=0,
                        help="Stop after N frames (0 = entire video)")
    args = parser.parse_args()

    evaluate(
        video_path=args.video,
        annotations_path=args.annotations,
        output_video=args.output_video,
        max_frames=args.max_frames,
    )
