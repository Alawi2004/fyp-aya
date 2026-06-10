# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FYP-AYA is a Smart Transportation System with five services: a Node.js/Express backend, a React Native/Expo mobile app (passenger + driver), a React/Vite admin dashboard, a React/Vite staff portal, and a Python/FastAPI camera AI server.

## Development Commands

### Install dependencies (one-time after cloning)
```bash
cd backend   && npm install && cd ..
cd admin     && npm install && cd ..
cd staff     && npm install && cd ..
cd frontend  && npm install && cd ..

# Python camera server
pip install fastapi uvicorn flask opencv-python numpy ultralytics "mediapipe>=0.10.30"
```

### Run each service (separate terminals)

| Service | Command | URL |
|---------|---------|-----|
| Backend API | `cd backend && npm run dev` | http://localhost:4000 |
| Admin Dashboard | `cd admin && npm run dev` | http://localhost:5173 |
| Staff Portal | `cd staff && npm run dev` | http://localhost:5174 |
| Mobile App | `cd frontend && npm start` | Expo QR code |
| Camera Server | `cd camera-aya && python server.py` | http://localhost:9000 |

### Backend-specific
```bash
cd backend
npm run dev      # dev with nodemon
npm start        # production
npm test         # vitest
npm run lint     # ESLint
```

Health checks: `GET /api/test` and `GET /api/db-test`

### Camera server options
```bash
python server.py --port 9000 --buses-config buses_config.json

# Standalone modules
cd camera-aya/passenger && python main.py
cd camera-aya/driver    && python main.py
```

## Architecture

### Backend (`backend/src/`)
- **`app.js`** — Express app setup (middleware, route registration)
- **`server.js`** — HTTP server + WebSocket attach + geofencing startup
- **`db/db.js`** — Azure SQL connection pool (`mssql`)
- **`middleware/auth.middleware.js`** — JWT validation
- **`middleware/permissions.middleware.js`** — Role-based access control
- **`services/gps.stream.service.js`** — WebSocket GPS stream at `/gps-stream`
- **`services/geofencing.service.js`** — Server-side geofencing engine
- **`services/fcm.service.js`** — Firebase push notifications
- **`ml/`** — Delay and demand predictors
- **`modules/eta/`** — ETA prediction via OSRM + historical data
- Routes follow `routes/*.routes.js` → `controllers/*.controller.js` pattern

### Mobile App (`frontend/`)
- React Native 0.81.5 + Expo 54
- Navigation: React Navigation (drawer + tabs + stack)
- Passenger and driver flows share the same codebase; user role determines which screens are shown

### Admin Dashboard (`admin/`) and Staff Portal (`staff/`)
- React 19 + Vite + Tailwind CSS
- Admin uses Leaflet for maps, connects to camera server at `localhost:9000` for live feeds
- Both default to mock data mode (`VITE_FRONTEND_ONLY=true`); set to `false` to use live backend

### Camera Server (`camera-aya/`)
- FastAPI + Uvicorn, unified server exposing both passenger counter and driver monitor
- YOLOv8 for object detection (`yolov8n.pt` auto-downloaded on first run, ~6 MB)
- MediaPipe for driver face/eye/gaze/phone/seatbelt detection
- WebSocket streams: `ws://localhost:9000/ws/bus/{bus_id}/passenger` and `/driver`
- Bus configurations loaded from `camera-aya/buses_config.json`

### Database
- Azure SQL Server — 14 tables + 2 views
- Key tables: `users`, `drivers`, `vehicles`, `routes`, `stops`, `trips`, `tickets`, `gps_logs`, `passenger_counts`, `ratings`, `wallet`, `notifications`
- Views: `view_trip_vehicle`, `view_passenger_load`
- Schema: `DatabaseSchema.sql`; seed data: `seed_azure.sql`

## Environment Variables

**`backend/.env`** (required — service won't start without DB connection):
```
PORT=4000
SQL_CONNECTION_STRING=Server=<server>.database.windows.net,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=true;TrustServerCertificate=false;
JWT_SECRET=...
```

**`admin/.env`** and **`staff/.env`**:
```
VITE_API_URL=http://localhost:4000/api
VITE_FRONTEND_ONLY=true   # set false to use real backend
```

**`frontend/.env`**:
```
EXPO_PUBLIC_API_URL=http://<machine-ip>:4000/api
EXPO_PUBLIC_FRONTEND_ONLY=true   # set false + use machine IP for real backend
```

## Key Conventions

- Backend uses ES modules (`import`/`export`), Express 5.x
- All routes are prefixed `/api/`
- Auth header: `Authorization: Bearer <jwt>`
- Redis is used for caching (optional — backend degrades gracefully if Redis is unavailable)
- Swagger docs available at `http://localhost:4000/api-docs` (see `backend/src/docs/swagger.js`)
- Frontend and web apps all have a `FRONTEND_ONLY` flag to run without a backend connection — useful for UI work
