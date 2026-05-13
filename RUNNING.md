# How to Run Everything

Quick reference for starting every service in this project.
Add new services to the matching section when they are created.

---

## Prerequisites

Make sure these are installed before running anything:

- **Node.js** v18+ and **npm**
- **Python** 3.10+ (3.13 works)
- **Expo Go** app on your phone (for the mobile app)

Install all dependencies once after cloning:

```bash
# Node dependencies
cd backend   && npm install && cd ..
cd admin     && npm install && cd ..
cd staff     && npm install && cd ..
cd frontend  && npm install && cd ..

# Python dependencies
pip install fastapi uvicorn flask opencv-python numpy ultralytics "mediapipe>=0.10.30"
```

---

## Services

### 1. Backend API
> Node.js + Express — REST API for all data

```bash
cd backend
npm run dev
```

- URL: http://localhost:4000
- Health check: http://localhost:4000/
- Requires: `backend/.env` with a valid `SQL_CONNECTION_STRING` (Azure SQL)

---

### 2. Admin Dashboard
> React + Vite — web dashboard for administrators

```bash
cd admin
npm run dev
```

- URL: http://localhost:5173
- Runs in mock-data mode by default (`VITE_FRONTEND_ONLY=true` in `admin/.env`)
- To connect to the real backend: set `VITE_FRONTEND_ONLY=false` in `admin/.env`
- **Camera page** auto-connects to `camera-aya` server at `localhost:9000` — start it for live feeds
  - Passenger counter and driver status are polled from the camera server in real time
  - Falls back to demo/simulation automatically if the camera server is offline
  - Driver camera: shows server stream if available, then webcam fallback (3 s delay), then placeholder

---

### 3. Staff Portal
> React + Vite — web interface for staff (wallet top-ups, user management)

```bash
cd staff
npm run dev
```

- URL: http://localhost:5174
- Runs in mock-data mode by default (`VITE_FRONTEND_ONLY=true` in `staff/.env`)
- To connect to the real backend: set `VITE_FRONTEND_ONLY=false` in `staff/.env`

---

### 4. Mobile App (Passenger & Driver)
> React Native + Expo — iOS / Android app

```bash
cd frontend
npm start
```

- Scan the QR code with **Expo Go** on your phone
- Or press `w` to open in the browser, `a` for Android emulator, `i` for iOS simulator
- Runs in mock-data mode by default (`EXPO_PUBLIC_FRONTEND_ONLY=true` in `frontend/.env`)
- To connect to the real backend: set `EXPO_PUBLIC_FRONTEND_ONLY=false` and `EXPO_PUBLIC_API_URL=http://<your-machine-ip>:4000/api`

---

### 5. Camera Server (camera-aya)
> Python + FastAPI — unified AI camera server (passenger counting + driver monitoring)

```bash
cd camera-aya
python server.py
```

- URL: http://localhost:9000
- Health check: http://localhost:9000/api/health
- WebSocket streams: `ws://localhost:9000/ws/bus/{bus_id}/passenger` and `/driver`
- Buses are loaded from `camera-aya/buses_config.json` on startup
- Custom port: `python server.py --port 9000`
- Custom config: `python server.py --buses-config buses_config.json`
- On first run, YOLOv8 weights (`yolov8n.pt`) are downloaded automatically (~6 MB)

Run passenger counter standalone:
```bash
cd camera-aya/passenger
python main.py
```

Run driver monitor standalone:
```bash
cd camera-aya/driver
python main.py
```

---

## Running Everything at Once

Open 5 separate terminals and run one command per terminal:

| Terminal | Command |
|----------|---------|
| 1 | `cd backend && npm run dev` |
| 2 | `cd admin && npm run dev` |
| 3 | `cd staff && npm run dev` |
| 4 | `cd frontend && npm start` |
| 5 | `cd camera-aya && python server.py` |

---

## Environment Files

Each service has a `.env` file. The key one to fill in is the backend:

**`backend/.env`**
```
PORT=4000
SQL_CONNECTION_STRING=Server=<server>.database.windows.net,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=true;TrustServerCertificate=false;
```

**`admin/.env`** — toggle mock vs real backend
```
VITE_API_URL=http://localhost:4000/api
VITE_FRONTEND_ONLY=true
```

**`staff/.env`** — toggle mock vs real backend
```
VITE_API_URL=http://localhost:4000/api
VITE_FRONTEND_ONLY=true
```

**`frontend/.env`** — toggle mock vs real backend
```
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_FRONTEND_ONLY=true
```

---

## Ports at a Glance

| Service | Port |
|---------|------|
| Backend API | 4000 |
| Admin Dashboard | 5173 |
| Staff Portal | 5174 |
| Camera Server | 9000 |
| Mobile App | Expo QR (varies) |
