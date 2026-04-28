"""
Wraps YOLOv8 + ByteTrack to return a clean list of tracked persons per frame.

ByteTrack is bundled with ultralytics — no separate install needed.
Calling model.track(..., persist=True) keeps tracker state across frames so
the same physical person gets the same track ID throughout their crossing.
"""
from ultralytics import YOLO
from config import Config


class PeopleTracker:
    def __init__(self):
        self.model = YOLO(Config.YOLO_MODEL)
        print(f"[PeopleTracker] Loaded {Config.YOLO_MODEL}")

    def track(self, frame) -> list[tuple]:
        """
        Run detection + tracking on one frame.

        Returns list of (track_id, x1, y1, x2, y2, confidence).
        Only persons (class 0) are returned; untracked detections are skipped.
        """
        results = self.model.track(
            frame,
            persist=True,
            tracker=Config.TRACKER,
            classes=[Config.PERSON_CLASS_ID],
            conf=Config.DETECTION_CONF,
            verbose=False,
        )

        tracks = []
        if not results or results[0].boxes is None:
            return tracks

        boxes = results[0].boxes
        if boxes.id is None:
            return tracks           # tracker has not yet assigned IDs

        for box in boxes:
            track_id = int(box.id[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            tracks.append((track_id, x1, y1, x2, y2, conf))

        return tracks
