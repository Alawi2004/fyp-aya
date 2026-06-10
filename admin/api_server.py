# api_server.py
# ─────────────────────────────────────────────────────────────
#  FastAPI server that:
#    1. Runs the bus counter vision pipeline in a background thread
#    2. Exposes REST endpoints for counts / events / status
#    3. Streams the annotated camera feed to the browser via WebSocket
#
#  Requirements:
#    pip install fastapi uvicorn ultralytics opencv-python-headless numpy websockets
#
#  Run:
#    python api_server.py                        # webcam
#    python api_server.py --source door_cam.mp4  # video file
#    python api_server.py --no-show              # no local OpenCV window
#
#  Endpoints:
#    GET  /api/status          → { running, fps, time }
#    GET  /api/counter         → { entered, exited, on_bus, fps, last_event }
#    GET  /api/events?limit=50 → list of events
#    POST /api/counter/reset   → reset counts
#    WS   /ws/video            → MJPEG frames as binary WebSocket messages
# ─────────────────────────────────────────────────────────────

import threading
import time
import asyncio
import argparse
from collections import deque
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from bus_counter_pro import (
    Detector, TrackerMemory, PassengerCounter, EventLogger,
    draw_scene,
    DEFAULT_MODEL, FRAME_W, FRAME_H,
    ZONE_LEFT_FRAC, ZONE_RIGHT_FRAC,
    ENTER_IS_LEFT_TO_RIGHT, LOG_FILE,
    USE_HALF_PRECISION, DEVICE, CONF_THRESH, IOU_THRESH,
    HISTORY_LEN, SMOOTH_LEN, MIN_CROSS_SPEED, REENTRY_COOLDOWN,
    VIDEO_FPS, JPEG_QUALITY,
)

# ─────────────────────────────────────────────────────────────
#  App
# ─────────────────────────────────────────────────────────────
app = FastAPI(title="Bus Passenger Counter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  Shared state
# ─────────────────────────────────────────────────────────────
class SharedState:
    def __init__(self):
        self.lock        = threading.Lock()
        self.entered     = 0
        self.exited      = 0
        self.on_bus      = 0
        self.fps         = 0.0
        self.running     = False
        self.paused      = False  # Pause detection
        self.camera_on   = True   # Actually shut down camera hardware
        self.last_event  = None
        self.events      = deque(maxlen=200)
        # Latest JPEG frame bytes for WebSocket streaming
        self.latest_frame: bytes | None = None
        # Reference to video capture object for cleanup
        self.cap_ref     = None

state = SharedState()

def open_capture(source):
    """Open webcam indexes with DirectShow on Windows to avoid MSMF frame drops."""
    if isinstance(source, int):
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
        backend = "DirectShow"
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(source)
            backend = "default"
    else:
        cap = cv2.VideoCapture(source)
        backend = "default"
    return cap, backend

# ─────────────────────────────────────────────────────────────
#  WebSocket connection manager
# ─────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.active.append(ws)
        print(f"[WS] Client connected  total={len(self.active)}")

    async def disconnect(self, ws: WebSocket):
        async with self.lock:
            if ws in self.active:
                self.active.remove(ws)
        print(f"[WS] Client disconnected  total={len(self.active)}")

    async def broadcast(self, data: bytes):
        async with self.lock:
            dead = []
            for ws in self.active:
                try:
                    await ws.send_bytes(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active.remove(ws)

manager = ConnectionManager()

# ─────────────────────────────────────────────────────────────
#  Counter + frame capture thread
# ─────────────────────────────────────────────────────────────
def counter_thread(source, model_path: str, show: bool):
    zone_left  = int(FRAME_W * ZONE_LEFT_FRAC)
    zone_right = int(FRAME_W * ZONE_RIGHT_FRAC)

    detector = Detector(model_path)
    memory   = TrackerMemory()
    counter  = PassengerCounter(zone_left, zone_right,
                                enter_is_ltr=ENTER_IS_LEFT_TO_RIGHT)
    logger   = EventLogger(LOG_FILE)

    cap = None
    fps_buf   = deque(maxlen=30)
    t_prev    = time.perf_counter()
    frame_idx = 0

    with state.lock:
        state.running = True
        state.cap_ref = None

    print(f"[Counter] Started — source={source}  model={model_path}")

    while True:
        # Check if camera should be on/off
        with state.lock:
            should_run = state.camera_on
        
        if not should_run:
            # Camera is OFF - close capture and wait
            if cap is not None:
                cap.release()
                cap = None
                print("[Camera] Closed (turned OFF)")
            time.sleep(0.5)  # Check every 500ms
            continue

        # Camera is ON - make sure we have an open capture
        if cap is None:
            cap, backend = open_capture(source)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FPS, VIDEO_FPS)
            cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
            
            if not cap.isOpened():
                print(f"[ERROR] Cannot open video source: {source}")
                print("[HINT] Close other camera apps, then try --source 1 if this is an external webcam.")
                cap = None
                time.sleep(1)
                continue
            
            print(f"[Camera] Opened source={source} backend={backend}")
            with state.lock:
                state.cap_ref = cap

        # Capture and process frame
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str) and Path(source).is_file():
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            print("[ERROR] Failed to read frame")
            print("[HINT] On Windows this is often camera-in-use, permission denied, wrong --source index, or MSMF/backend trouble.")
            cap.release()
            cap = None
            time.sleep(0.5)
            continue

        frame_idx += 1

        # Check if paused
        with state.lock:
            is_paused = state.paused

        # Process frame
        if is_paused:
            detections = []
            events = []
            time.sleep(0.01)
        else:
            try:
                detections = detector.detect(frame)
                all_tracks = memory.update(detections)
                events     = counter.process(all_tracks, frame_idx)
                logger.log(events)
            except Exception as e:
                print(f"[ERROR] Detection error: {e}")
                detections = []
                events = []

        t_now = time.perf_counter()
        fps_buf.append(1.0 / max(t_now - t_prev, 1e-6))
        t_prev = t_now
        current_fps = round(float(np.mean(fps_buf)), 1)

        # Draw visualization
        if is_paused:
            vis = frame.copy()
            cv2.putText(vis, "PAUSED", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
        else:
            vis = draw_scene(
                frame.copy(), detections, memory.all_tracks(),
                counter, zone_left, zone_right, current_fps,
            )

        # Encode to JPEG
        ok, buf = cv2.imencode(
            ".jpg", vis,
            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY],
        )
        if ok:
            with state.lock:
                state.latest_frame = buf.tobytes()

        # Update state only when camera is running and not paused
        if not is_paused:
            with state.lock:
                state.entered = counter.entered
                state.exited  = counter.exited
                state.on_bus  = counter.on_bus
                state.fps     = current_fps
                for evt in events:
                    state.events.append(evt)
                    state.last_event = evt

        # Optional local OpenCV window
        if show:
            cv2.imshow("Bus Counter  [ESC=quit  R=reset]", vis)
            key = cv2.waitKey(1) & 0xFF
            if key == 27:
                break
            elif key == ord('r'):
                counter.reset()

    cap.release()
    if show:
        cv2.destroyAllWindows()
    logger.close()

    with state.lock:
        state.running = False

    print(f"[Counter] Stopped — Entered:{counter.entered}  Exited:{counter.exited}")


# ─────────────────────────────────────────────────────────────
#  WebSocket frame broadcaster task (runs in asyncio event loop)
# ─────────────────────────────────────────────────────────────
async def frame_broadcaster():
    """
    Reads the latest JPEG frame from shared state ~25 times/sec
    and broadcasts it to all connected WebSocket clients.
    """
    TARGET_FPS = 25
    interval   = 1.0 / TARGET_FPS

    while True:
        await asyncio.sleep(interval)

        if not manager.active:
            continue

        with state.lock:
            frame_bytes = state.latest_frame

        if frame_bytes:
            await manager.broadcast(frame_bytes)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(frame_broadcaster())


# ─────────────────────────────────────────────────────────────
#  WebSocket endpoint
# ─────────────────────────────────────────────────────────────
@app.websocket("/ws/video")
async def video_ws(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Keep connection alive; frames are pushed by broadcaster
        while True:
            await ws.receive_text()   # client can send "ping" to keep alive
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)


# ─────────────────────────────────────────────────────────────
#  REST endpoints
# ─────────────────────────────────────────────────────────────
@app.get("/api/status")
def get_status():
    with state.lock:
        return {
            "running": state.running,
            "fps":     state.fps,
            "time":    datetime.now().isoformat(timespec="seconds"),
        }


@app.get("/api/counter")
def get_counter():
    with state.lock:
        return {
            "entered":    state.entered,
            "exited":     state.exited,
            "on_bus":     state.on_bus,
            "fps":        state.fps,
            "last_event": state.last_event,
        }


@app.get("/api/events")
def get_events(limit: int = 50):
    with state.lock:
        evts = list(state.events)
    return list(reversed(evts))[:limit]


class ResetBody(BaseModel):
    confirm: bool = True

class CameraConfigBody(BaseModel):
    conf_threshold: float = None
    iou_threshold: float = None
    frame_width: int = None
    frame_height: int = None
    zone_left_frac: float = None
    zone_right_frac: float = None

@app.post("/api/counter/reset")
def reset_counter(body: ResetBody):
    if not body.confirm:
        return {"ok": False, "msg": "Send confirm=true to reset"}
    with state.lock:
        state.entered    = 0
        state.exited     = 0
        state.on_bus     = 0
        state.last_event = None
        state.events.clear()
    return {"ok": True, "msg": "Counts reset"}

@app.post("/api/camera/pause")
def pause_camera():
    """Pause camera processing (stops counting but keeps video stream)"""
    with state.lock:
        state.paused = True
    print("[Camera] Detection paused")
    return {"ok": True, "msg": "Detection paused", "paused": True}

@app.post("/api/camera/resume")
def resume_camera():
    """Resume camera processing"""
    with state.lock:
        state.paused = False
    print("[Camera] Detection resumed")
    return {"ok": True, "msg": "Detection resumed", "paused": False}

@app.post("/api/camera/off")
def camera_off():
    """Turn camera OFF - completely closes hardware"""
    with state.lock:
        state.camera_on = False
    print("[Camera] Turned OFF (closing hardware)")
    return {"ok": True, "msg": "Camera off - hardware closed", "camera_on": False}

@app.post("/api/camera/on")
def camera_on_endpoint():
    """Turn camera ON - opens hardware"""
    with state.lock:
        state.camera_on = True
    print("[Camera] Turned ON (opening hardware)")
    return {"ok": True, "msg": "Camera on - hardware opened", "camera_on": True}

@app.get("/api/camera/status")
def camera_status():
    """Get camera status"""
    with state.lock:
        paused = state.paused
        running = state.running
        camera_on = state.camera_on
    return {"running": running, "paused": paused, "camera_on": camera_on}

@app.get("/api/config")
def get_config():
    """Get current camera configuration"""
    return {
        "conf_threshold": CONF_THRESH,
        "iou_threshold": IOU_THRESH,
        "frame_width": FRAME_W,
        "frame_height": FRAME_H,
        "zone_left_frac": ZONE_LEFT_FRAC,
        "zone_right_frac": ZONE_RIGHT_FRAC,
        "history_len": HISTORY_LEN,
        "smooth_len": SMOOTH_LEN,
        "min_cross_speed": MIN_CROSS_SPEED,
        "reentry_cooldown": REENTRY_COOLDOWN,
        "model": DEFAULT_MODEL,
    }

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    with state.lock:
        is_running = state.running
    return {
        "status": "healthy" if is_running else "initializing",
        "running": is_running,
        "fps": state.fps,
        "on_bus": state.on_bus,
    }


# ─────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Bus counter — FastAPI + WebSocket video")
    ap.add_argument("--source",  default=0, help="Video source: 0=webcam, or path to video file")
    ap.add_argument("--model",   default=DEFAULT_MODEL, help="YOLOv8 model to use")
    ap.add_argument("--no-show", action="store_true", help="Don't show OpenCV window")
    ap.add_argument("--port",    type=int, default=8000, help="API server port")
    ap.add_argument("--host",    default="0.0.0.0", help="API server host")
    args = ap.parse_args()

    src = args.source
    try:
        src = int(src)
    except (ValueError, TypeError):
        pass

    print(f"\n{'='*60}")
    print(f"  🚍 Bus Passenger Counter API Server")
    print(f"  Model: {args.model}")
    print(f"  Source: {src}")
    print(f"  FP16: {USE_HALF_PRECISION}")
    print(f"  Device: {DEVICE}")
    print(f"{'='*60}\n")

    t = threading.Thread(
        target=counter_thread,
        args=(src, args.model, not args.no_show),
        daemon=True,
    )
    t.start()

    print(f"\n  🌐 REST API  →  http://localhost:{args.port}/api/counter")
    print(f"  🎥 Video WS  →  ws://localhost:{args.port}/ws/video")
    print(f"  📊 Config    →  http://localhost:{args.port}/api/config")
    print(f"  💚 Health    →  http://localhost:{args.port}/api/health\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
