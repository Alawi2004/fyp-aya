"""
Bus Passenger Counter – main entry point.

How counting works
──────────────────
The camera is mounted on the wall BESIDE the bus door, looking horizontally
across the doorway.  Two VERTICAL lines divide the frame into three zones:

    OUTSIDE  │ Line A │ ← DOOR ZONE → │ Line B │  INSIDE BUS
             ←──────── 35 % ──────────────────── 65 % ──────→

State machine per tracked person (ByteTrack ID):

    OUTSIDE → [cross Line A] → ZONE → [cross Line B] → INSIDE  = ENTRY ✓
    INSIDE  → [cross Line B] → ZONE → [cross Line A] → OUTSIDE = EXIT  ✓

Backing out of the zone does NOT trigger a count.
Appearing directly inside the bus does NOT count as an entry.
Jumping from OUTSIDE to INSIDE without the zone is ignored (tracker error).

Run:
    python main.py

Controls:
    Q  – quit
    R  – reset counters  (start a new trip)
    S  – save screenshot to logs/
"""
import time
import cv2
from collections import deque
from datetime import datetime

from config import Config
from counter.people_tracker import PeopleTracker
from counter.line_counter import LineCounter
from database.db_manager import DBManager
from export.data_exporter import DataExporter
from utils.drawing import (
    draw_zone_backgrounds,
    draw_counting_lines,
    draw_tracks,
    draw_stats_panel,
    draw_recent_events,
    draw_crossing_flash,
)


def main():
    # ── camera ────────────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(Config.CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  Config.FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, Config.FRAME_HEIGHT)

    if not cap.isOpened():
        raise RuntimeError(
            f"Cannot open camera {Config.CAMERA_INDEX}. "
            "Check connection or change Config.CAMERA_INDEX."
        )

    ret, probe = cap.read()
    if not ret:
        raise RuntimeError("Camera opened but could not read first frame.")
    frame_h, frame_w = probe.shape[:2]

    # ── subsystems ────────────────────────────────────────────────────────────
    tracker      = PeopleTracker()
    line_counter = LineCounter(frame_w=frame_w, frame_h=frame_h)
    db           = DBManager(Config.DB_FILE)
    exporter     = DataExporter(Config.EXPORT_JSON, Config.LOG_FILE)
    session_start = datetime.now().isoformat()

    # ── runtime state ─────────────────────────────────────────────────────────
    fps_buf            = deque(maxlen=30)
    recent_events: list[dict] = []
    prev_time          = time.time()
    last_export_time   = 0.0
    last_snapshot_time = 0.0
    screenshot_idx     = 0

    print("=" * 60)
    print("  Bus Passenger Counter – Q quit  R reset  S screenshot")
    print(f"  Orientation : {Config.LINE_ORIENTATION}")
    print(f"  Direction   : {Config.ENTRY_DIRECTION}")
    print(f"  Line A      : {int(Config.LINE_A_POSITION * 100)} %  "
          f"Line B : {int(Config.LINE_B_POSITION * 100)} %")
    print(f"  Log  → {Config.LOG_FILE}")
    print(f"  DB   → {Config.DB_FILE}")
    print("=" * 60)

    # ── main loop ─────────────────────────────────────────────────────────────
    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        now = time.time()
        fps_buf.append(1.0 / max(now - prev_time, 1e-6))
        prev_time = now
        fps = sum(fps_buf) / len(fps_buf)

        # ── detection + tracking ──────────────────────────────────────────────
        tracks     = tracker.track(frame)
        active_ids = []

        for (track_id, x1, y1, x2, y2, conf) in tracks:
            active_ids.append(track_id)
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            event = line_counter.update(track_id, cx, cy, now)

            if event:
                count = line_counter.current_count
                db.log_event(event, track_id, count)
                exporter.log_event(
                    event, track_id,
                    line_counter.total_entries,
                    line_counter.total_exits,
                    count,
                )
                recent_events.insert(0, {
                    "time":     datetime.now().strftime("%H:%M:%S"),
                    "type":     event,
                    "track_id": track_id,
                    "count":    count,
                })
                recent_events = recent_events[:6]

                tag = "ENTRY ▶" if event == "entry" else "◀ EXIT"
                print(f"  [{datetime.now().strftime('%H:%M:%S')}]  "
                      f"{tag}  ID #{track_id:4d}  |  on bus: {count}")

        line_counter.cleanup_stale_tracks(active_ids)

        # ── periodic writes ───────────────────────────────────────────────────
        if now - last_export_time >= Config.EXPORT_INTERVAL_SECS:
            exporter.write_json(
                session_id    = db.session_id,
                entries       = line_counter.total_entries,
                exits         = line_counter.total_exits,
                current_count = line_counter.current_count,
                session_start = session_start,
                recent_events = recent_events,
                fps           = fps,
            )
            last_export_time = now

        if now - last_snapshot_time >= Config.SNAPSHOT_INTERVAL_SECS:
            db.save_snapshot(
                line_counter.total_entries,
                line_counter.total_exits,
                line_counter.current_count,
            )
            last_snapshot_time = now

        # ── draw ─────────────────────────────────────────────────────────────
        draw_zone_backgrounds(frame, line_counter)
        draw_crossing_flash(frame, line_counter, now)
        draw_counting_lines(frame, line_counter, now)
        draw_tracks(frame, tracks, line_counter)
        draw_stats_panel(frame, line_counter, fps, now)
        draw_recent_events(frame, recent_events)

        cv2.imshow("Bus Passenger Counter", frame)

        # ── key handling ──────────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        elif key == ord('r'):
            line_counter.reset()
            recent_events.clear()
            session_start = datetime.now().isoformat()
            print("[Counter] Reset – new trip started.")
        elif key == ord('s'):
            fname = f"logs/screenshot_{screenshot_idx:03d}.png"
            cv2.imwrite(fname, frame)
            print(f"[Screenshot] → {fname}")
            screenshot_idx += 1

    # ── cleanup ───────────────────────────────────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()
    db.close_session(line_counter.total_entries, line_counter.total_exits)
    exporter.close()
    print(f"\nSession ended  |  entries={line_counter.total_entries}"
          f"  exits={line_counter.total_exits}"
          f"  on_bus={line_counter.current_count}")


if __name__ == "__main__":
    main()
