"""
Distraction event logger.

Writes a CSV file with one row per distraction event that crossed its alert
threshold.  Columns: timestamp, event_type, duration_seconds.
"""
import csv
import os
from datetime import datetime
from config import Config


class DistractionLogger:
    _HEADER = ["timestamp", "event_type", "duration_seconds"]

    def __init__(self, path: str = Config.LOG_FILE):
        self._path = path
        file_exists = os.path.isfile(path)
        self._fh  = open(path, "a", newline="", encoding="utf-8")
        self._csv = csv.writer(self._fh)
        if not file_exists:
            self._csv.writerow(self._HEADER)
            self._fh.flush()

    def log(self, event_type: str, duration: float):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._csv.writerow([ts, event_type, f"{duration:.2f}"])
        self._fh.flush()

    def close(self):
        self._fh.close()
