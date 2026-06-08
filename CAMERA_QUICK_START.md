# 🚀 Camera System - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Install Camera Dependencies

**Option A: Using pip (Recommended for Windows)**
```bash
cd admin
pip install -r requirements.txt
```

**Option B: Manual installation**
```bash
pip install ultralytics opencv-python-headless numpy fastapi uvicorn websockets pydantic
```

### Step 2: Verify Downloads

YOLOv8 model downloads automatically on first run (~40MB).

```bash
# Optional: Pre-download model
python -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"
```

---

## 🎬 Running the System

### Terminal 1: Start Camera API Server

```bash
cd admin
python api_server.py --source 0 --port 8000
```

**Expected output:**
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
```

**Available options:**
```bash
python api_server.py --help

# Examples:
python api_server.py --source 0 --port 8000          # Webcam
python api_server.py --source video.mp4 --port 8000  # Video file
python api_server.py --source 0 --port 8000 --device cpu  # CPU only
python api_server.py --source 0 --no-show            # No OpenCV window
```

### Terminal 2: Start Admin Dashboard (in separate terminal)

```bash
cd admin
npm run dev
```

**Open in browser:** http://localhost:5173

### Terminal 3: Start Backend (if using database features)

```bash
cd backend
npm run dev
```

---

## 📊 Access Points

Once everything is running:

| Component | URL | Purpose |
|-----------|-----|---------|
| **Admin Dashboard** | http://localhost:5173 | View camera feed + counts |
| **Camera API** | http://localhost:8000/api/counter | Get JSON data |
| **Video Stream** | ws://localhost:8000/ws/video | Live video frames |
| **Config Endpoint** | http://localhost:8000/api/config | Camera settings |
| **Health Check** | http://localhost:8000/api/health | System status |

---

## 🎯 Using the Passenger Counter

### In Admin Dashboard

1. **Start all three terminals** (API Server, Dashboard, Backend)
2. **Open** http://localhost:5173
3. **Click** "🎥 Passenger Counter" in sidebar
4. **View:**
   - 📹 Live camera feed
   - 📊 Real-time counts (On Bus, Entered, Exited)
   - 📈 FPS performance
   - 📋 Recent events with timestamps
   - ⚙️ Camera configuration

### Controls

- **Reset Counter** - Clear all counts (button on top right)
- **Show All Events** - Toggle detailed event log
- **Live Indicator** - Shows connection status (green = connected)

---

## 🔧 Tuning for Better Accuracy

Edit `bus_counter_pro.py` CONFIG section:

### For Better Detection:
```python
# Detection thresholds (higher = fewer false positives)
CONF_THRESH          = 0.55          # Increase from 0.50
IOU_THRESH           = 0.60          # Increase from 0.55
FRAME_W              = 1920          # Increase from 1280
FRAME_H              = 1080          # Increase from 720
```

### For Faster Speed:
```python
# Use faster model
DEFAULT_MODEL        = "yolov8s.pt"  # Smaller/faster
USE_HALF_PRECISION   = True          # Use FP16
```

### For CPU-Only Operation:
```python
DEVICE               = "cpu"
DEFAULT_MODEL        = "yolov8n.pt"  # Nano model
FRAME_W              = 640
FRAME_H              = 480
```

**After editing, restart the API server to apply changes.**

---

## 🧪 Testing the API

### Test 1: Get Current Counts
```bash
curl http://localhost:8000/api/counter
```

### Test 2: Get Events
```bash
curl http://localhost:8000/api/events?limit=10
```

### Test 3: Reset Counts
```bash
curl -X POST http://localhost:8000/api/counter/reset \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

### Test 4: Check Health
```bash
curl http://localhost:8000/api/health
```

---

## 📊 Monitoring Logs

### Terminal Output (API Server)
Shows real-time detections:
```
  > ENTER  tid=12    conf=0.95  on_bus=4
  < EXIT   tid=5     conf=0.91  on_bus=3
```

### CSV Log (`passenger_log.csv`)
Contains all historical events:
```csv
timestamp,frame,tid,event,on_bus,confidence
2024-04-12T10:30:45,1234,12,ENTER,4,0.95
2024-04-12T10:30:48,1245,5,EXIT,3,0.91
```

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| **No camera feed in dashboard** | Check if WebSocket can connect: Open DevTools → Network → Look for `/ws/video` |
| **"Failed to fetch counter data"** | Verify API server running: `http://localhost:8000/api/counter` in browser |
| **Low FPS (<15)** | Use smaller model: `yolov8n.pt` or reduce frame size |
| **Counts seem wrong** | Tune CONF_THRESH and zone boundaries in config |
| **Port 8000 already in use** | Run: `python api_server.py --port 8001` |
| **CUDA out of memory** | Use: `python api_server.py --device cpu` |
| **Model download stuck** | Manually download: `python -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"` |

---

## 🚀 Production Setup

For deployment:

1. **Use environment variables**
```bash
export API_PORT=8000
export CAMERA_SOURCE="rtsp://camera-ip/stream"
export MODEL="yolov8m.pt"
python api_server.py --source $CAMERA_SOURCE --port $API_PORT
```

2. **Use system service** (Linux/macOS)
```bash
# Install as systemd service or use supervisor
```

3. **Docker (Optional)**
```bash
docker build -t bus-counter .
docker run --gpus all -p 8000:8000 bus-counter
```

4. **Remote Camera Stream**
```bash
# RTSP stream
python api_server.py --source "rtsp://192.168.1.100:554/stream"

# HTTP stream
python api_server.py --source "http://192.168.1.100:8080/video"
```

---

## 📚 Full Documentation

Detailed information available in:
- **[CAMERA_SETUP.md](./CAMERA_SETUP.md)** - Complete camera guide
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - System integration
- **[QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md)** - Setup verification

---

## 📝 API Response Examples

### Counter Endpoint
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

### Events Endpoint
```json
[
  {
    "timestamp": "2024-04-12T10:30:45",
    "frame": 1852,
    "tid": 12,
    "event": "ENTER",
    "on_bus": 4,
    "confidence": 0.95
  }
]
```

### Config Endpoint
```json
{
  "conf_threshold": 0.5,
  "iou_threshold": 0.55,
  "frame_width": 1280,
  "frame_height": 720,
  "zone_left_frac": 0.3,
  "zone_right_frac": 0.7,
  "history_len": 30,
  "smooth_len": 10,
  "model": "yolov8m.pt"
}
```

---

✅ **Ready to go!** Start the three terminals and open http://localhost:5173

Last Updated: April 2026
