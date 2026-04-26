"""
=============================================================================
 LIVE WEBCAM TEST  —  Passenger Counter + Driver Monitor
=============================================================================

 Run this FIRST before starting the full server.
 It opens your laptop camera and shows you exactly what each system sees.

 PASSENGER COUNTER SETUP:
   Position your laptop at the SIDE of a doorway or corridor entrance,
   rotated so the camera looks ACROSS the doorway (not through it).
   People walking through the door will cross left → right in the frame.

        [Laptop sideways]
             │  ←── camera looks this way
   OUTSIDE   │   INSIDE
   ══════════╪══════════
     person walks → → →

 DRIVER MONITOR SETUP:
   Just sit in front of the laptop normally.
   The camera should see your full face clearly.

 Controls:
   Q  — quit
   R  — reset passenger counts
   D  — toggle driver monitor mode
   P  — toggle passenger counter mode
   ← → arrow keys  — adjust zone boundaries
=============================================================================
"""

import cv2
import numpy as np
import time
import sys
from collections import deque
from datetime import datetime
from pathlib import Path

# ── optional imports ──────────────────────────────────────────────────────────
try:
    from ultralytics import YOLO
    YOLO_OK = True
except ImportError:
    YOLO_OK = False
    print("[WARN] ultralytics not installed — install with: pip install ultralytics")

try:
    import mediapipe as mp
    _MP = mp.solutions.face_mesh
    MP_OK = True
except ImportError:
    MP_OK = False
    print("[WARN] mediapipe not installed — install with: pip install mediapipe")

# ── CONFIG ────────────────────────────────────────────────────────────────────
CAMERA_INDEX   = 0
FRAME_W        = 640
FRAME_H        = 480

# Passenger zone (adjustable with ← → keys)
ZONE_LEFT_PCT  = 35    # % of frame width
ZONE_RIGHT_PCT = 65

CONF_THRESH    = 0.28
MIN_SPEED      = 1.5   # px/frame — lower than server for slow laptop-cam movement
COOLDOWN       = 20    # frames before same person can be counted again
HISTORY        = 20
SMOOTH         = 4

# Driver thresholds (same as driver_monitor.py tuned values)
EAR_THRESH     = 0.20
EAR_FRAMES     = 18
PHONE_CONF     = 0.38
PHONE_CLASS    = 67
YAW_LIMIT      = 30
PITCH_LIMIT    = -18

LEFT_EYE_IDX   = [33,  160, 158, 133, 153, 144]
RIGHT_EYE_IDX  = [362, 385, 387, 263, 373, 380]
LEFT_EYE_CTR   = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
RIGHT_EYE_CTR  = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]
POSE_IDX       = [1, 152, 33, 263, 61, 291]
POSE_3D        = np.array([
    [0.0, 0.0, 0.0], [0.0, -63.6, -12.5],
    [-43.3, 32.7, -26.0], [43.3, 32.7, -26.0],
    [-28.9, -28.9, -24.1], [28.9, -28.9, -24.1],
], dtype=np.float64)


# ── preprocessing ─────────────────────────────────────────────────────────────

def preprocess(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    out = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return cv2.bilateralFilter(out, d=5, sigmaColor=35, sigmaSpace=35)


# ── EAR ───────────────────────────────────────────────────────────────────────

def ear(lm, idx, W, H):
    pts = np.array([[lm[i].x * W, lm[i].y * H] for i in idx], dtype=np.float64)
    A = np.linalg.norm(pts[1] - pts[5])
    B = np.linalg.norm(pts[2] - pts[4])
    C = np.linalg.norm(pts[0] - pts[3])
    return (A + B) / (2.0 * C + 1e-6)


# ── head pose ─────────────────────────────────────────────────────────────────

def head_pose(lm, W, H):
    pts2d = np.array([[lm[i].x * W, lm[i].y * H] for i in POSE_IDX], dtype=np.float64)
    f = float(W)
    cam = np.array([[f,0,W/2],[0,f,H/2],[0,0,1]], dtype=np.float64)
    ok, rvec, _ = cv2.solvePnP(POSE_3D, pts2d, cam, np.zeros((4,1)), flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok: return 0.0, 0.0
    rmat, _ = cv2.Rodrigues(rvec)
    angles, *_ = cv2.RQDecomp3x3(rmat)
    pitch, yaw, _ = angles
    return float(yaw), float(pitch)


# ── draw eye contour ──────────────────────────────────────────────────────────

def draw_eye(frame, lm, idx, W, H, color):
    pts = np.array([[int(lm[i].x * W), int(lm[i].y * H)] for i in idx], np.int32)
    cv2.polylines(frame, [pts], True, color, 1)


# ── zone region ───────────────────────────────────────────────────────────────

def zone_of(cx, zl, zr):
    if cx < zl: return 'outside'
    if cx > zr: return 'inside'
    return 'door'


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*60)
    print(" LIVE WEBCAM TEST")
    print("="*60)
    print(f" Camera:  index {CAMERA_INDEX}")
    print(f" YOLO:    {'available' if YOLO_OK else 'NOT installed'}")
    print(f" MediaPipe: {'available' if MP_OK else 'NOT installed'}")
    print()
    print(" Controls:  Q=quit  R=reset counts  D=driver mode  P=passenger mode")
    print("            LEFT/RIGHT arrows = move zone boundaries")
    print("="*60 + "\n")

    # Open camera (DirectShow on Windows for low latency)
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 1)
    cap.set(cv2.CAP_PROP_AUTOFOCUS,     1)

    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera {CAMERA_INDEX}")
        print("  → Try changing CAMERA_INDEX at the top of this file to 1 or 2")
        sys.exit(1)

    print("[OK] Camera opened")

    # Load models
    yolo = None
    if YOLO_OK:
        try:
            yolo = YOLO("yolov8n.pt")
            print("[OK] YOLOv8n loaded (passenger + phone detection)")
        except Exception as e:
            print(f"[WARN] YOLO load failed: {e}")

    face_mesh = None
    if MP_OK:
        face_mesh = _MP.FaceMesh(
            max_num_faces=1, refine_landmarks=True,
            min_detection_confidence=0.5, min_tracking_confidence=0.45,
            static_image_mode=False,
        )
        print("[OK] MediaPipe Face Mesh loaded (driver monitoring)")

    # ── state ─────────────────────────────────────────────────────────────────
    zone_left_pct  = ZONE_LEFT_PCT
    zone_right_pct = ZONE_RIGHT_PCT

    entered  = 0
    exited   = 0
    tracks   = {}   # tid → { history, zone, counted, last_frame, missing }

    ear_low   = 0
    no_face   = 0
    phone_cnt = 0
    vote_buf  = deque(maxlen=12)

    mode = 'both'   # 'passenger' | 'driver' | 'both'
    frame_idx = 0
    fps_buf   = deque(maxlen=30)
    t_prev    = time.perf_counter()
    flash_until = 0
    flash_type  = None

    print("\n[READY] Window opening — position camera and press any key to begin\n")

    while True:
        ret, raw = cap.read()
        if not ret or raw is None:
            continue

        frame_idx += 1
        frame = preprocess(raw.copy())
        H, W  = frame.shape[:2]

        t_now = time.perf_counter()
        fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
        t_prev = t_now
        fps = float(np.mean(fps_buf))

        zl = int(W * zone_left_pct  / 100)
        zr = int(W * zone_right_pct / 100)

        # ── PASSENGER COUNTER ─────────────────────────────────────────────────
        if mode in ('passenger', 'both') and yolo is not None:
            results = yolo.track(frame, persist=True, conf=CONF_THRESH,
                                  classes=[0], tracker="bytetrack.yaml", verbose=False)
            boxes = results[0].boxes
            detections = []
            if boxes.id is not None:
                for box in boxes:
                    tid  = int(box.id[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    detections.append({'tid': tid, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'conf': conf})

            seen = set()
            for d in detections:
                tid = d['tid']
                cx  = (d['x1'] + d['x2']) // 2
                seen.add(tid)

                if tid not in tracks:
                    tracks[tid] = {
                        'history': deque(maxlen=HISTORY),
                        'zone': 'unknown', 'counted': 'unknown',
                        'last_frame': -999, 'missing': 0,
                    }

                t = tracks[tid]
                t['history'].append(cx)
                t['missing'] = 0

                # smooth cx
                pts  = list(t['history'])
                scx  = float(np.mean(pts[-SMOOTH:]))
                new_zone = zone_of(scx, zl, zr)
                prev_zone = t['zone']
                t['zone'] = new_zone

                if prev_zone == 'unknown':
                    t['counted'] = new_zone; continue
                if prev_zone == new_zone: continue
                if prev_zone != 'door' and new_zone == 'door': continue

                # velocity check
                if len(pts) >= 3:
                    vel = float(np.mean([pts[i] - pts[i-1] for i in range(1, min(len(pts), 6))]))
                    if abs(vel) < MIN_SPEED: continue

                # cooldown
                if (frame_idx - t['last_frame']) <= COOLDOWN: continue

                if new_zone == 'inside' and t['counted'] != 'inside':
                    entered += 1
                    t['counted'] = 'inside'
                    t['last_frame'] = frame_idx
                    flash_until = frame_idx + 20
                    flash_type  = 'ENTER'
                    print(f"[ENTER] #{tid}  entered={entered}  exited={exited}  on_bus={max(entered-exited,0)}")
                elif new_zone == 'outside' and t['counted'] != 'outside':
                    exited += 1
                    t['counted'] = 'outside'
                    t['last_frame'] = frame_idx
                    flash_until = frame_idx + 20
                    flash_type  = 'EXIT'
                    print(f"[EXIT]  #{tid}  entered={entered}  exited={exited}  on_bus={max(entered-exited,0)}")

            # age out missing tracks
            for tid in list(tracks):
                if tid not in seen:
                    tracks[tid]['missing'] += 1
                    if tracks[tid]['missing'] > 15:
                        del tracks[tid]

            # draw zone overlay
            ov = frame.copy()
            cv2.rectangle(ov, (0,   0), (zl,  H), (0, 140, 255), -1)
            cv2.rectangle(ov, (zl,  0), (zr,  H), (0, 200, 100), -1)
            cv2.rectangle(ov, (zr,  0), (W,   H), (0, 100, 200), -1)
            cv2.addWeighted(ov, 0.12, frame, 0.88, 0, frame)

            # Detection boundary lines
            cv2.line(frame, (zl, 0), (zl, H), (0, 255, 80),  2)
            cv2.line(frame, (zr, 0), (zr, H), (0, 200, 255), 2)

            # Tick marks on lines
            for y in range(10, H, 28):
                cv2.line(frame, (zl-5, y), (zl+5, y), (0, 255, 80),  1)
                cv2.line(frame, (zr-5, y), (zr+5, y), (0, 200, 255), 1)

            # Zone labels
            def label(txt, x, col):
                cv2.putText(frame, txt, (x, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, col, 2)
            label('OUTSIDE',   max(zl//2-35, 2),          (0, 200, 255))
            label('DOOR ZONE', (zl+zr)//2-42,             (200, 255, 200))
            label('INSIDE',    zr + (W-zr)//2 - 30,       (100, 255, 100))

            # Direction arrows
            cv2.arrowedLine(frame, (zl+8,  H//2), (zl+40, H//2), (100, 255, 100), 2, tipLength=0.4)
            cv2.arrowedLine(frame, (zl-8,  H//2), (zl-40, H//2), (0, 100, 255),   2, tipLength=0.4)

            # Draw detections
            det_map = {d['tid']: d for d in detections}
            for tid, t in tracks.items():
                if t['missing'] > 0: continue
                d = det_map.get(tid)
                if not d: continue
                col = {'outside': (0,200,255), 'inside': (100,255,100), 'door': (0,255,200)}.get(t['zone'], (200,200,200))
                cv2.rectangle(frame, (d['x1'], d['y1']), (d['x2'], d['y2']), col, 2)
                # Corner brackets
                cl = 12
                for (px, py) in [(d['x1'], d['y1']), (d['x2'], d['y1']), (d['x1'], d['y2']), (d['x2'], d['y2'])]:
                    sx = 1 if px == d['x1'] else -1
                    sy = 1 if py == d['y1'] else -1
                    cv2.line(frame, (px, py), (px + sx*cl, py), col, 2)
                    cv2.line(frame, (px, py), (px, py + sy*cl), col, 2)
                # Label
                cv2.putText(frame, f'#{tid} {t["zone"].upper()[:3]}',
                            (d['x1'], d['y1']-6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, col, 1)

            # Flash border on event
            if frame_idx <= flash_until:
                bc = (100, 255, 100) if flash_type == 'ENTER' else (0, 80, 255)
                cv2.rectangle(frame, (4, 4), (W-4, H-4), bc, 6)

        # ── DRIVER MONITOR ────────────────────────────────────────────────────
        alert_label = 'FOCUSED'
        alert_col   = (0, 200, 80)

        if mode in ('driver', 'both') and face_mesh is not None:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_res = face_mesh.process(rgb)

            face_detected = False

            if mp_res.multi_face_landmarks:
                face_detected = True
                no_face = 0
                lm = mp_res.multi_face_landmarks[0].landmark

                left_ear  = ear(lm, LEFT_EYE_IDX,  W, H)
                right_ear = ear(lm, RIGHT_EYE_IDX, W, H)
                avg_ear   = (left_ear + right_ear) / 2.0
                eyes_open = avg_ear >= EAR_THRESH

                yaw, pitch = head_pose(lm, W, H)

                # Eye contours
                eye_col = (0, 230, 80) if eyes_open else (0, 60, 255)
                draw_eye(frame, lm, LEFT_EYE_CTR,  W, H, eye_col)
                draw_eye(frame, lm, RIGHT_EYE_CTR, W, H, eye_col)

                # Iris dots
                iris_col = (0, 255, 220) if eyes_open else (0, 140, 255)
                for idx in (468, 473):
                    if len(lm) > idx:
                        ix = int(lm[idx].x * W)
                        iy = int(lm[idx].y * H)
                        cv2.circle(frame, (ix, iy), 4, iris_col, -1)
                        cv2.circle(frame, (ix, iy), 4, (0, 0, 0), 1)

                # Head direction arrow from nose
                nx = int(lm[1].x * W)
                ny = int(lm[1].y * H)
                dx = int(np.sin(np.radians(yaw))   * 50)
                dy = int(np.sin(np.radians(pitch))  * 50)
                cv2.arrowedLine(frame, (nx, ny), (nx+dx, ny+dy), (0, 220, 255), 2, tipLength=0.35)

                # Drowsy counter
                if eyes_open:
                    ear_low = max(0, ear_low - 1)
                else:
                    ear_low += 1

                # Alert logic
                drowsy      = ear_low >= EAR_FRAMES
                distracted  = (abs(yaw) > YAW_LIMIT or pitch < PITCH_LIMIT)

                # Phone check
                phone_box = None
                if yolo is not None:
                    ph_res = yolo(frame, classes=[PHONE_CLASS], conf=PHONE_CONF, verbose=False)
                    for box in ph_res[0].boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cy_f = ((y1 + y2) / 2) / H
                        if cy_f <= 0.85:
                            phone_cnt += 1
                            phone_box = (x1, y1, x2, y2, float(box.conf[0]))
                            break
                    else:
                        phone_cnt = max(0, phone_cnt - 1)

                phone_alert = phone_cnt >= PHONE_FRAMES if 'PHONE_FRAMES' in dir() else phone_cnt >= 3

                raw_alert = ('phone_detected' if phone_alert else
                             'drowsy'         if drowsy else
                             'distracted'     if distracted else 'focused')

                vote_buf.append(raw_alert)
                from collections import Counter
                final_alert = Counter(vote_buf).most_common(1)[0][0]

                COLORS = {
                    'focused':        (0,   200,  80),
                    'phone_detected': (0,   0,   220),
                    'drowsy':         (0,   140, 255),
                    'distracted':     (180,  0,  255),
                }
                alert_col   = COLORS.get(final_alert, (200, 200, 200))
                alert_label = {
                    'focused':        'FOCUSED',
                    'phone_detected': '! PHONE DETECTED !',
                    'drowsy':         '! DROWSY !',
                    'distracted':     '! DISTRACTED !',
                }.get(final_alert, final_alert.upper())

                # Face bounding box
                xs = [lm[i].x * W for i in range(468)]
                ys = [lm[i].y * H for i in range(468)]
                fx1, fy1, fx2, fy2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                cv2.rectangle(frame, (fx1, fy1), (fx2, fy2), alert_col, 2)

                # Corner brackets on face box
                cl = 14
                for (px, py) in [(fx1,fy1),(fx2,fy1),(fx1,fy2),(fx2,fy2)]:
                    sx = 1 if px==fx1 else -1
                    sy = 1 if py==fy1 else -1
                    cv2.line(frame,(px,py),(px+sx*cl,py),alert_col,3)
                    cv2.line(frame,(px,py),(px,py+sy*cl),alert_col,3)

                # Phone box
                if phone_box:
                    px1,py1,px2,py2,pc = phone_box
                    cv2.rectangle(frame,(px1,py1),(px2,py2),(0,0,220),3)
                    cv2.putText(frame, f'PHONE {pc:.0%}', (px1, py1-8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,220), 2)

                # EAR / pose info
                cv2.putText(frame, f'EAR:{avg_ear:.3f}  Yaw:{yaw:+.0f}  Pitch:{pitch:+.0f}',
                            (10, H - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160, 160, 160), 1)

                # Alert border
                if final_alert != 'focused':
                    cv2.rectangle(frame, (6,6), (W-6, H-6), alert_col, 7)
                    cv2.rectangle(frame, (10,10),(W-10,H-10), alert_col, 1)

            else:
                no_face += 1
                if no_face >= 25:
                    alert_label = '! DISTRACTED !'
                    alert_col   = (180, 0, 255)
                    cv2.putText(frame, 'FACE NOT DETECTED', (W//2-90, H//2),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,80,255), 2)

        # ── HUD panels ────────────────────────────────────────────────────────

        # Top-left: driver status
        if mode in ('driver', 'both'):
            ov = frame.copy()
            cv2.rectangle(ov, (0, 0), (260, 60), (10, 10, 10), -1)
            cv2.addWeighted(ov, 0.72, frame, 0.28, 0, frame)
            cv2.putText(frame, 'DRIVER CAM', (10, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160,160,160), 1)
            cv2.putText(frame, alert_label, (10, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.75, alert_col, 2)

        # Top-right: passenger counter
        if mode in ('passenger', 'both'):
            on_bus = max(entered - exited, 0)
            ov = frame.copy()
            pw, ph = 185, 100
            cv2.rectangle(ov, (W-pw, 0), (W, ph), (10,10,10), -1)
            cv2.addWeighted(ov, 0.72, frame, 0.28, 0, frame)
            cv2.putText(frame, 'PASSENGER CAM', (W-pw+6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (160,160,160), 1)
            cv2.putText(frame, f'ON BUS: {on_bus}', (W-pw+6, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (100,255,100), 2)
            cv2.putText(frame, f'Entered: {entered}', (W-pw+6, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,200,80), 1)
            cv2.putText(frame, f'Exited : {exited}',  (W-pw+6, 82), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (80,120,255), 1)
            cv2.putText(frame, f'Zones: {zone_left_pct}% | {zone_right_pct}%  FPS:{fps:.0f}',
                        (W-pw+6, 96), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (100,100,100), 1)

        # Bottom bar: controls hint
        ov = frame.copy()
        cv2.rectangle(ov, (0, H-22), (W, H), (10,10,10), -1)
        cv2.addWeighted(ov, 0.65, frame, 0.35, 0, frame)
        cv2.putText(frame, 'Q=quit  R=reset  D=driver  P=passenger  ← →=adjust zones',
                    (8, H-6), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (160,160,160), 1)

        cv2.imshow('Live Test — Passenger Counter + Driver Monitor', frame)

        # ── keyboard ──────────────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:
            break
        elif key == ord('r'):
            entered = exited = 0
            tracks.clear()
            print("[RESET] Passenger counts reset")
        elif key == ord('d'):
            mode = 'driver' if mode != 'driver' else 'both'
            print(f"[MODE] {mode}")
        elif key == ord('p'):
            mode = 'passenger' if mode != 'passenger' else 'both'
            print(f"[MODE] {mode}")
        elif key == 81 or key == 2:   # left arrow
            zone_left_pct  = max(10, zone_left_pct  - 2)
            zone_right_pct = max(zone_left_pct + 15, zone_right_pct)
            print(f"[ZONES] left={zone_left_pct}%  right={zone_right_pct}%")
        elif key == 83 or key == 3:   # right arrow
            zone_right_pct = min(90, zone_right_pct + 2)
            zone_left_pct  = min(zone_right_pct - 15, zone_left_pct)
            print(f"[ZONES] left={zone_left_pct}%  right={zone_right_pct}%")

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nFinal counts — Entered: {entered}  Exited: {exited}  On bus: {max(entered-exited,0)}")


if __name__ == '__main__':
    main()
