"""
Lightweight Flask API server – run this SEPARATELY from main.py.

    python api/server.py

Endpoints
─────────
GET /status          → live passenger counts (reads live_data.json)
GET /session         → current session info from SQLite
GET /events?limit=20 → recent crossing events from SQLite
GET /sessions        → all historical sessions from SQLite
GET /health          → simple liveness check

Integration guide
─────────────────
1. React / Vue dashboard
       fetch("http://<bus-device-ip>:5050/status")
       Poll every 5 seconds for live counts.

2. Node.js / Express backend
       axios.get("http://localhost:5050/events?limit=100")

3. Direct SQLite access (same machine)
       Just read logs/passenger_data.db with any SQLite client.

4. PostgreSQL / MySQL migration
       Replace sqlite3 in db_manager.py with SQLAlchemy + your DB URL.
       All API endpoints stay the same; only the ORM layer changes.

5. MQTT / WebSocket (for real-time dashboards)
       After each crossing in main.py, publish to an MQTT topic:
           mqtt_client.publish("bus/counter", json.dumps(payload))
       The dashboard subscribes and updates instantly.
"""
import json
import os
import sys

# Make project root importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flask import Flask, jsonify, abort
from config import Config
from database.db_manager import DBManager

app = Flask(__name__)
_db = DBManager()   # connects to same DB file as main.py


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/status")
def status():
    """Read the JSON file written by the main process (fastest, no DB query)."""
    path = Config.EXPORT_JSON
    if not os.path.isfile(path):
        abort(503, description="No data yet – main.py may not be running.")
    with open(path, encoding="utf-8") as fh:
        return jsonify(json.load(fh))


@app.get("/session")
def session():
    return jsonify(_db.get_current_session())


@app.get("/events")
def events():
    from flask import request
    limit = int(request.args.get("limit", 20))
    return jsonify(_db.get_recent_events(limit))


@app.get("/sessions")
def sessions():
    return jsonify(_db.get_all_sessions())


if __name__ == "__main__":
    print(f"API server → http://{Config.API_HOST}:{Config.API_PORT}")
    app.run(host=Config.API_HOST, port=Config.API_PORT, debug=False)
