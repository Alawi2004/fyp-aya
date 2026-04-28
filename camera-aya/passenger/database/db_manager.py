"""
SQLite persistence layer.

Schema
──────
sessions  – one row per program run (start → end).
events    – one row per entry/exit crossing event.
snapshots – periodic row with aggregate counts (for trend analysis).

This database is the source of truth consumed by api/server.py and any
external dashboard or backend that wants historical data.
"""
import sqlite3
import os
from datetime import datetime
from config import Config


_DDL = """
CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time    TEXT    NOT NULL,
    end_time      TEXT,
    total_entries INTEGER DEFAULT 0,
    total_exits   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    timestamp       TEXT    NOT NULL,
    event_type      TEXT    NOT NULL,   -- 'entry' | 'exit'
    track_id        INTEGER,
    passenger_count INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);

CREATE TABLE IF NOT EXISTS snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    timestamp       TEXT    NOT NULL,
    entries         INTEGER,
    exits           INTEGER,
    current_count   INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);
"""


class DBManager:
    def __init__(self, db_path: str = Config.DB_FILE):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_DDL)
        self._conn.commit()
        self.session_id = self._open_session()
        print(f"[DB] Session {self.session_id} opened  →  {db_path}")

    # ── session lifecycle ──────────────────────────────────────────────────────

    def _open_session(self) -> int:
        cur = self._conn.execute(
            "INSERT INTO sessions (start_time) VALUES (?)",
            (datetime.now().isoformat(),),
        )
        self._conn.commit()
        return cur.lastrowid

    def close_session(self, total_entries: int, total_exits: int):
        self._conn.execute(
            "UPDATE sessions SET end_time=?, total_entries=?, total_exits=? WHERE id=?",
            (datetime.now().isoformat(), total_entries, total_exits, self.session_id),
        )
        self._conn.commit()
        self._conn.close()
        print(f"[DB] Session {self.session_id} closed  "
              f"(entries={total_entries}, exits={total_exits})")

    # ── write helpers ──────────────────────────────────────────────────────────

    def log_event(self, event_type: str, track_id: int, passenger_count: int):
        self._conn.execute(
            "INSERT INTO events (session_id, timestamp, event_type, track_id, passenger_count) "
            "VALUES (?, ?, ?, ?, ?)",
            (self.session_id, datetime.now().isoformat(),
             event_type, track_id, passenger_count),
        )
        self._conn.commit()

    def save_snapshot(self, entries: int, exits: int, current_count: int):
        self._conn.execute(
            "INSERT INTO snapshots (session_id, timestamp, entries, exits, current_count) "
            "VALUES (?, ?, ?, ?, ?)",
            (self.session_id, datetime.now().isoformat(),
             entries, exits, current_count),
        )
        self._conn.commit()

    # ── read helpers (used by api/server.py) ──────────────────────────────────

    def get_current_session(self) -> dict:
        row = self._conn.execute(
            "SELECT * FROM sessions WHERE id=?", (self.session_id,)
        ).fetchone()
        return dict(row) if row else {}

    def get_recent_events(self, limit: int = 20) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM events WHERE session_id=? ORDER BY id DESC LIMIT ?",
            (self.session_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_all_sessions(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM sessions ORDER BY id DESC"
        ).fetchall()
        return [dict(r) for r in rows]
