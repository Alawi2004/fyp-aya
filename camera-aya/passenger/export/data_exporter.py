"""
Data export layer.

Two outputs:
  1. JSON file  – written periodically; any dashboard can poll it.
  2. CSV log    – one row per entry/exit event for simple audit trail.

JSON schema (live_data.json)
────────────────────────────
{
  "session_id":         int,
  "timestamp":          ISO-8601 string,
  "entries":            int,
  "exits":              int,
  "current_passengers": int,
  "capacity":           int,
  "occupancy_pct":      float,
  "fps":                float,
  "session_start":      ISO-8601 string,
  "recent_events":      [ {"time": "HH:MM:SS", "type": "entry"|"exit",
                            "track_id": int, "count": int}, … ]
}

Dashboard / backend integration
────────────────────────────────
  • Poll GET /status on api/server.py  (Flask, run separately)
  • OR read logs/live_data.json directly from any process on the same machine
  • OR INSERT the events table rows into any remote DB (PostgreSQL, MySQL, …)
    by pointing db_manager.py at a SQLAlchemy URL instead of sqlite3.
"""
import csv
import json
import os
from datetime import datetime
from config import Config


class DataExporter:
    def __init__(
        self,
        json_path: str = Config.EXPORT_JSON,
        csv_path:  str = Config.LOG_FILE,
    ):
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        self._json_path = json_path
        self._csv_path  = csv_path

        # Open CSV (append so logs survive restarts)
        csv_exists = os.path.isfile(csv_path)
        self._csv_fh  = open(csv_path, "a", newline="", encoding="utf-8")
        self._csv_out = csv.writer(self._csv_fh)
        if not csv_exists:
            self._csv_out.writerow(
                ["timestamp", "event_type", "track_id",
                 "total_entries", "total_exits", "current_count"]
            )
            self._csv_fh.flush()

    # ── JSON export ───────────────────────────────────────────────────────────

    def write_json(
        self,
        session_id:    int,
        entries:       int,
        exits:         int,
        current_count: int,
        session_start: str,
        recent_events: list[dict],
        fps:           float = 0.0,
    ):
        occupancy = round(current_count / max(Config.BUS_CAPACITY, 1) * 100, 1)
        payload = {
            "session_id":         session_id,
            "timestamp":          datetime.now().isoformat(),
            "entries":            entries,
            "exits":              exits,
            "current_passengers": current_count,
            "capacity":           Config.BUS_CAPACITY,
            "occupancy_pct":      occupancy,
            "fps":                round(fps, 1),
            "session_start":      session_start,
            "recent_events":      recent_events[-10:],   # last 10
        }
        with open(self._json_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)

    # ── CSV log ───────────────────────────────────────────────────────────────

    def log_event(
        self,
        event_type:    str,
        track_id:      int,
        total_entries: int,
        total_exits:   int,
        current_count: int,
    ):
        self._csv_out.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            event_type, track_id,
            total_entries, total_exits, current_count,
        ])
        self._csv_fh.flush()

    def close(self):
        self._csv_fh.close()
