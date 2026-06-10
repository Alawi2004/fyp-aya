"""
Driver Monitoring System – main entry point.

Run:
    python main.py

Controls:
    Q   – quit
    S   – save a screenshot
    P   – toggle phone detection on / off
"""
import time
import cv2
from collections import deque

from config import Config
from detectors.face_detector import FaceDetector
from detectors.eye_detector import EyeDetector
from detectors.gaze_estimator import GazeEstimator
from detectors.phone_detector import PhoneDetector
from alerts.alert_manager import AlertManager
from logger.distraction_logger import DistractionLogger
from utils.drawing import (
    draw_status_panel,
    draw_alerts,
    draw_phone_boxes,
    draw_gaze_arrow,
    draw_face_box,
    draw_fps,
    draw_event_log,
)


def main():
    # ── initialise subsystems ─────────────────────────────────────────────────
    cap = cv2.VideoCapture(Config.CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  Config.FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, Config.FRAME_HEIGHT)

    if not cap.isOpened():
        raise RuntimeError(
            f"Cannot open camera index {Config.CAMERA_INDEX}. "
            "Check your camera connection or change Config.CAMERA_INDEX."
        )

    face_detector  = FaceDetector()
    eye_detector   = EyeDetector()
    gaze_estimator = GazeEstimator()
    phone_detector = PhoneDetector()
    alert_manager  = AlertManager()
    logger         = DistractionLogger(Config.LOG_FILE)

    # ── runtime state ─────────────────────────────────────────────────────────
    phone_enabled  = True
    fps_history    = deque(maxlen=30)
    recent_events  = deque(maxlen=5)   # last N entries shown in HUD
    prev_time      = time.time()
    screenshot_idx = 0

    print("=" * 60)
    print("  Driver Monitoring System  –  press Q to quit")
    print(f"  Log file : {Config.LOG_FILE}")
    print("=" * 60)

    # ── main loop ─────────────────────────────────────────────────────────────
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to read frame – retrying …")
            time.sleep(0.05)
            continue

        frame = cv2.flip(frame, 1)          # mirror so left/right feel natural
        h, w  = frame.shape[:2]
        now   = time.time()

        # FPS
        fps_history.append(1.0 / max(now - prev_time, 1e-6))
        prev_time = now
        fps = sum(fps_history) / len(fps_history)

        # ── detection ─────────────────────────────────────────────────────────
        face_results = face_detector.detect(frame)
        face_found   = bool(
            face_results and face_results.multi_face_landmarks
        )

        ear          = 0.30         # default (eyes assumed open when no face)
        eyes_closed  = False
        gaze         = "unknown"
        face_box     = None

        if face_found:
            landmarks = face_results.multi_face_landmarks[0]

            # Eye state
            _, _, ear, eyes_closed = eye_detector.compute(landmarks, w, h)
            eye_detector.draw(frame, landmarks, w, h, eyes_closed)

            # Gaze
            gaze     = gaze_estimator.estimate(landmarks, w, h, frame)

            # Face bounding box
            face_box = face_detector.get_face_box(landmarks, w, h)
            draw_face_box(frame, face_box, gaze)
            draw_gaze_arrow(frame, gaze, face_box)

        # Phone
        phone_near, phone_boxes = (False, [])
        if phone_enabled:
            phone_near, phone_boxes = phone_detector.detect(frame, face_box)
            if phone_boxes:
                draw_phone_boxes(frame, phone_boxes)

        # ── alerts ────────────────────────────────────────────────────────────
        alerts = alert_manager.update(
            face_detected=face_found,
            eyes_closed=eyes_closed,
            gaze=gaze,
            phone_near=phone_near,
            now=now,
        )

        for alert in alerts:
            if alert["new_log"]:
                from datetime import datetime
                ts = datetime.now().strftime("%H:%M:%S")
                logger.log(alert["type"], alert["duration"])
                recent_events.appendleft((ts, alert["type"], alert["duration"]))

        # ── draw HUD ──────────────────────────────────────────────────────────
        draw_status_panel(frame, face_found, eyes_closed, gaze, phone_near, ear)
        draw_alerts(frame, alerts)
        draw_fps(frame, fps)
        draw_event_log(frame, list(recent_events))

        cv2.imshow("Driver Monitoring System", frame)

        # ── key handling ──────────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            fname = f"screenshot_{screenshot_idx:03d}.png"
            cv2.imwrite(fname, frame)
            print(f"[Screenshot] saved → {fname}")
            screenshot_idx += 1
        elif key == ord('p'):
            phone_enabled = not phone_enabled
            state = "ON" if phone_enabled else "OFF"
            print(f"[PhoneDetector] toggled {state}")

    # ── cleanup ───────────────────────────────────────────────────────────────
    cap.release()
    face_detector.close()
    phone_detector.close()
    cv2.destroyAllWindows()
    logger.close()
    print(f"\nSession ended.  Log saved → {Config.LOG_FILE}")


if __name__ == "__main__":
    main()
