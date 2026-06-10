# 📸 Bus Passenger Counter - Camera Setup Guide

## Overview

The bus passenger counter uses **YOLOv8** for accurate person detection and **ByteTrack** for reliable tracking across frames. It provides real-time counting of passengers entering and exiting the bus through a video stream with WebSocket support for the admin dashboard.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│           Camera / Video Source                     │
│        (Webcam or Video File)                       │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│     bus_counter_pro.py (YOLOv8 + ByteTrack)        │
│  - Person Detection                                 │
│  - Multi-object Tracking                           │
│  - Zone-based Counting Logic                       │
│  - Confidence Filtering                            │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│     api_server.py (FastAPI + WebSocket)            │
│  - REST API Endpoints                              │
│  - Real-time Video Stream (WebSocket)             │
│  - Count Data Broadcasting                         │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    REST API    WebSocket    Browser
   (Port 8000)  (Live Video)  Dashboard
```

---

## Installation & Dependencies

### 1. Install Python Dependencies

```bash
pip install ultralytics opencv-python-headless numpy fastapi uvicorn websockets
```

Or install from requirements:

```bash
pip install -r requirements.txt
```

### 2. Model Download

YOLOv8 models are automatically downloaded on first run. Available models:

- **yolov8n.pt** - Nano (fastest, less accurate)
- **yolov8s.pt** - Small (balanced)
- **yolov8m.pt** - Medium (recommended, better accuracy)
- **yolov8l.pt** - Large (slowest, most accurate)

The default is `yolov8m.pt` (medium - good balance).

---

## Configuration

Edit the CONFIG section in `bus_counter_pro.py` to tune accuracy:

```python
# Detection Parameters
CONF_THRESH          = 0.50          # Confidence threshold (0.0-1.0)
IOU_THRESH           = 0.55          # NMS IOU threshold
FRAME_W              = 1280          # Frame width
FRAME_H              = 720           # Frame height

# Zone Configuration (as fraction of frame width)
ZONE_LEFT_FRAC       = 0.30          # Left boundary of door zone
ZONE_RIGHT_FRAC      = 0.70          # Right boundary of door zone

# Tracking Parameters
HISTORY_LEN          = 30            # Frames of history per track
SMOOTH_LEN           = 10            # Smoothing window
MIN_CROSS_SPEED      = 1.5           # Minimum crossing speed (px/frame)
REENTRY_COOLDOWN     = 60            # Frames before same person can count again

# Hardware
USE_HALF_PRECISION   = True          # Use FP16 for faster inference
DEVICE               = 0             # GPU device (0 for first GPU, "cpu" for CPU)
```

### Tuning Tips for Better Accuracy

| Parameter | Issue | Solution |
|-----------|-------|----------|
| **CONF_THRESH too low** | False positives, extra counts | Increase to 0.50-0.60 |
| **CONF_THRESH too high** | Missing people, under-counting | Decrease to 0.40-0.45 |
| **Zone too small** | People miss transitions | Widen ZONE_LEFT_FRAC / ZONE_RIGHT_FRAC |
| **Frame resolution low** | Blurry detections | Increase FRAME_W and FRAME_H |
| **MIN_CROSS_SPEED too high** | Stationary people not counted | Lower to 1.0-1.5 |
| **Jittery tracking** | People counted multiple times | Increase HISTORY_LEN and SMOOTH_LEN |

---

## Starting the System

### Terminal 1: Start Camera Server

```bash
cd admin

# Option 1: Webcam (default)
python api_server.py --port 8000

# Option 2: Video File
python api_server.py --source door_cam.mp4 --port 8000

# Option 3: CPU Only (slower but no GPU needed)
python api_server.py --source 0 --port 8000 --device cpu

# Option 4: With OpenCV window display
python api_server.py --source 0
# Remove --no-show flag to see local window
```

**Expected Output**:
```
============================================================
  🚍 Bus Passenger Counter API Server
  Model: yolov8m.pt
  Source: 0
  FP16: True
  Device: 0
============================================================

  🌐 REST API  →  http://localhost:8000/api/counter
  🎥 Video WS  →  ws://localhost:8000/ws/video
  📊 Config    →  http://localhost:8000/api/config
  💚 Health    →  http://localhost:8000/api/health

INFO:     Application startup complete [to quit: CTRL+C]
```

### Terminal 2: Start Admin Dashboard

```bash
cd admin
npm run dev
```

Then open **http://localhost:5173** → Navigate to **🎥 Passenger Counter**

---

## API Endpoints

### 1. **GET /api/counter** - Current Counts
```json
{
  "entered": 42,
  "exited": 38,
  "on_bus": 4,
  "fps": 28.5,
  "last_event": {
    "timestamp": "2024-04-12T10:30:45",
    "frame": 1852,
    "tid": 12,
    "event": "ENTER",
    "on_bus": 4,
    "confidence": 0.95
  }
}
```

### 2. **GET /api/events?limit=50** - Event History
```json
[
  {
    "timestamp": "2024-04-12T10:30:45",
    "frame": 1852,
    "tid": 12,
    "event": "ENTER",
    "on_bus": 4,
    "confidence": 0.95
  },
  ...
]
```

### 3. **POST /api/counter/reset** - Reset Counts
```bash
curl -X POST http://localhost:8000/api/counter/reset \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

Response:
```json
{
  "ok": true,
  "msg": "Counts reset"
}
```

### 4. **GET /api/config** - Camera Configuration
```json
{
  "conf_threshold": 0.5,
  "iou_threshold": 0.55,
  "frame_width": 1280,
  "frame_height": 720,
  "history_len": 30,
  "smooth_len": 10,
  "model": "yolov8m.pt"
}
```

### 5. **GET /api/health** - System Health
```json
{
  "status": "healthy",
  "running": true,
  "fps": 28.5,
  "on_bus": 4
}
```

### 6. **WebSocket /ws/video** - Live Video Stream
Streams JPEG frames at ~25 FPS to connected clients.

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/video');
ws.binaryType = 'arraybuffer';

ws.onmessage = (event) => {
  const blob = new Blob([event.data], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  // Display frame
  document.getElementById('camera').src = url;
};
```

---

## Counting Logic Explained

### 1. **Person Detection**
- YOLOv8 detects all persons in frame
- Confidence filtering: Only detections > CONF_THRESH

### 2. **Multi-Object Tracking**
- ByteTrack assigns consistent IDs across frames
- Handles brief occlusions (people overlapping)
- Tracks person's X-coordinate (horizontal position)

### 3. **Zone-Based Counting**
```
OUTSIDE      DOOR ZONE      INSIDE
  │             │              │
  ├────────┬─────┼─────┬────────┤
  │        │     │     │        │
  Street   Boundary   Boundary  Bus
```

### 4. **State Machine per Person**
```
outside → entering zone → inside (COUNT +1 ENTER)
inside → entering zone → outside (COUNT +1 EXIT)
```

### 5. **Anti-Double-Count Mechanisms**
- **Speed Gate**: Reject stationary people (velocity < MIN_CROSS_SPEED)
- **Cooldown Gate**: Same person can't count within REENTRY_COOLDOWN frames
- **Confidence Filtering**: Average confidence must be > threshold
- **Smoothing**: Use averaged position, not jittery detections

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| **API won't start** | Port 8000 in use | Change with `--port 9000` |
| **0% of people detected** | Model not loading | Download manually: `from ultralytics import YOLO; YOLO('yolov8m.pt')` |
| **Low FPS (<10)** | GPU memory issue | Use smaller model: `yolov8s.pt` or CPU: `--device cpu` |
| **Dashboard can't see video** | WebSocket connection failed | Check firewall, use `http://localhost:8000/ws/video` |
| **Over-counting** | Zone too large or threshold too low | Increase CONF_THRESH, shrink zone |
| **Under-counting** | Zone too small or threshold too high | Decrease CONF_THRESH, widen zone |
| **Jittery tracking IDs** | Insufficient history | Increase HISTORY_LEN and SMOOTH_LEN |
| **People stand in doorway** | Not counted as crossing | Increase MIN_CROSS_SPEED slightly |

---

## Performance Optimization

### For Better Accuracy:
```python
# Increase detection quality
CONF_THRESH          = 0.55          # Higher = fewer false positives
IOU_THRESH           = 0.60
FRAME_W              = 1920          # Higher resolution
FRAME_H              = 1080
USE_HALF_PRECISION   = False         # Full precision (slower but more accurate)
```

### For Better Speed:
```python
# Prioritize speed over accuracy
DEFAULT_MODEL        = "yolov8n.pt"  # Use nano model
CONF_THRESH          = 0.40          # Lower threshold = faster
FRAME_W              = 640           # Lower resolution
FRAME_H              = 480
USE_HALF_PRECISION   = True          # Use FP16
```

### For CPU-Only (No GPU):
```python
DEVICE               = "cpu"
DEFAULT_MODEL        = "yolov8n.pt"  # Use nano model
USE_HALF_PRECISION   = False         # FP16 not supported on CPU
FRAME_W              = 640
FRAME_H              = 480
```

---

## Log File

Every event is logged to `passenger_log.csv`:

```csv
timestamp,frame,tid,event,on_bus,confidence
2024-04-12T10:30:45,1234,5,ENTER,1,0.95
2024-04-12T10:30:46,1238,6,ENTER,2,0.92
2024-04-12T10:30:48,1245,5,EXIT,1,0.94
```

---

## Example: Real-Time Monitoring

### Python Client
```python
import requests
import time

API = "http://localhost:8000/api"

while True:
    data = requests.get(f"{API}/counter").json()
    print(f"On Bus: {data['on_bus']} | FPS: {data['fps']:.1f}")
    time.sleep(1)
```

### JavaScript Client
```javascript
setInterval(async () => {
  const res = await fetch('http://localhost:8000/api/counter');
  const data = await res.json();
  console.log(`On Bus: ${data.on_bus} | FPS: ${data.fps.toFixed(1)}`);
}, 1000);
```

---

## Advanced: Using Different Trackers

### ByteTrack (Default)
```python
tracker="bytetrack.yaml"  # Fast, lightweight
```

### BotSORT (Better occlusion handling)
```python
tracker="botsort.yaml"    # Slower, better re-ID after occlusions
```

Swap in `bus_counter_pro.py` line 130:
```python
results = self.model.track(
    frame,
    tracker="botsort.yaml",  # ← Change here
    ...
)
```

---

## Next Steps

1. ✅ **Start API Server** - `python api_server.py`
2. ✅ **Open Admin Dashboard** - http://localhost:5173
3. ✅ **Navigate to Camera Page** - Click "Passenger Counter"
4. ✅ **Monitor Live Feed** - Watch video stream and counts
5. ✅ **Tune Configuration** - Adjust thresholds for better accuracy
6. ✅ **Export Data** - Download `passenger_log.csv` for analysis

---

## Support Documentation

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Full system integration
- **[DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md)** - Database details
- **Bus Counter Code** - [bus_counter_pro.py](./admin/bus_counter_pro.py)
- **API Server** - [api_server.py](./admin/api_server.py)

---

Last Updated: April 2026
