# FYP - Smart Transportation System
## Database & API Integration Guide

### 📋 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure SQL Database                            │
│                  (fypdatabase on fypserver)                      │
└─────────────────────────────────────────────────────────────────┘
                              ▲
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         │                    │                    │
    ┌────▼─────┐        ┌────▼─────┐        ┌────▼─────┐
    │ Backend   │        │ Frontend  │        │  Admin   │
    │ (Node.js) │        │ (React)   │        │Dashboard │
    │ Port 4000 │        │ Port 3000 │        │Port 5173 │
    └──────────┘        └──────────┘        └──────────┘
```

### 🔧 Configuration Files

#### 1. **Backend** (`.env`)
```bash
# Location: backend/.env
PORT=4000
NODE_ENV=development
SQL_CONNECTION_STRING="Server=tcp:fypserver.database.windows.net,1433;Database=fypdatabase;User ID=CloudSA8b6c9cb7;Password=aya20062006_;Encrypt=true;TrustServerCertificate=true;Connection Timeout=30;"
JWT_SECRET=supersecret123
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

#### 2. **Frontend** (`.env`)
```bash
# Location: frontend/.env
VITE_API_URL=http://localhost:4000/api
VITE_API_TIMEOUT=15000
```

#### 3. **Admin Dashboard** (`.env`)
```bash
# Location: admin/.env
VITE_API_URL=http://localhost:4000/api
VITE_BUS_COUNTER_API=http://localhost:8000/api
VITE_PORT=5173
```

---

### 📊 Database Schema Overview

The system uses 14 main tables with the following key relationships:

#### Core Entities
- **users**: All system users (passengers, drivers, admins)
- **drivers**: Driver-specific data (extends users)
- **vehicles**: Bus/van information and capacity
- **routes**: Bus route definitions
- **stops**: Individual stops with GPS coordinates

#### Trip & Operational Data
- **trips**: Individual trips linking vehicle, driver, and route
- **gps_logs**: Real-time GPS position tracking
- **passenger_counts**: AI-detected or QR-scanned passenger counts
- **eta_predictions**: Estimated arrival time predictions

#### User Interactions
- **tickets**: Booking information for passengers
- **notifications**: System notifications (delays, arrivals, etc.)
- **ratings**: Passenger ratings and reviews

#### Important Views
- **view_trip_vehicle**: Comprehensive trip details with vehicle info
- **view_passenger_load**: Current bus capacity vs. actual passengers

---

### 🚀 Getting Started

#### 1. **Start Backend Server**
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:4000
# Health check: http://localhost:4000/api/test
# DB test: http://localhost:4000/api/db-test
```

#### 2. **Start Frontend Application**
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
# Connects to backend at http://localhost:4000/api
```

#### 3. **Start Admin Dashboard**
```bash
cd admin
npm install
npm run dev
# Admin runs on http://localhost:5173
# Connects to backend at http://localhost:4000/api
```

---

### 📡 API Endpoints Available

#### Trips
```
GET    /api/trips                          - Get all trips
POST   /api/trips                          - Create new trip
GET    /api/trips/:id                      - Get trip details
PUT    /api/trips/:id                      - Update trip status
GET    /api/trips/:id/passenger-load       - Get current passenger load
GET    /gps/trip/:id                       - Get GPS logs for trip
GET    /passenger-count/trip/:id           - Get passenger counts
GET    /trips/:id/eta-predictions          - Get ETA predictions
```

#### Vehicles
```
GET    /api/vehicles                       - Get all vehicles
POST   /api/vehicles                       - Create vehicle
GET    /api/vehicles/:id                   - Get vehicle details
PUT    /api/vehicles/:id                   - Update vehicle
GET    /api/trips/vehicle-type/:type       - Get trips by vehicle type
```

#### Drivers
```
GET    /api/drivers                        - Get all drivers
POST   /api/drivers                        - Create driver
GET    /api/drivers/:id                    - Get driver details
PUT    /api/drivers/:id                    - Update driver
```

#### Routes & Stops
```
GET    /api/routes                         - Get all routes
POST   /api/routes                         - Create route
GET    /api/stops                          - Get all stops
GET    /api/stops/route/:routeId           - Get stops for a route
```

#### Tickets
```
GET    /api/tickets                        - Get all tickets
POST   /api/tickets/book                   - Book a ticket
GET    /api/tickets/trip/:tripId           - Get tickets for trip
```

#### Ratings & Notifications
```
GET    /api/ratings                        - Get all ratings
POST   /api/ratings                        - Submit rating
GET    /api/notifications                  - Get all notifications
PUT    /api/notifications/:id/read         - Mark as read
```

#### Dashboard
```
GET    /api/dashboard/stats                - Get dashboard statistics
GET    /api/dashboard/overview             - Get dashboard overview
```

---

### 🔗 Frontend API Integration

#### Using the API Client

**Example in a React Component:**

```javascript
import { useEffect, useState } from 'react';
import * as endpoints from '@/api/endpoints';  // Frontend would use its own endpoints module

function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch trips from backend
    endpoints.getTrips()
      .then(data => setTrips(data.recordset))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {trips.map(trip => (
        <div key={trip.trip_id}>{trip.trip_id} - {trip.status}</div>
      ))}
    </div>
  );
}
```

---

### 🎯 Admin Dashboard Features

#### Custom Hooks Available

```javascript
import { 
  useTrips, 
  useVehicles, 
  useDrivers, 
  useRoutes,
  useDashboardStats 
} from '@/hooks/useBackendData';

// Usage in component:
function AdminDashboard() {
  const { data: trips, loading, error, refetch } = useTrips();
  const { data: vehicles } = useVehicles();
  
  return <div>{/* render trips and vehicles */}</div>;
}
```

#### API Integration Modules

- **apiClient.js**: Base HTTP client with token management
- **endpoints.js**: All API endpoint functions
- **useBackendData.js**: Custom React hooks for data fetching

---

### 🔐 Authentication Flow

1. **User logs in** → Backend validates credentials
2. **Backend returns JWT token** → Stored in localStorage (admin) or AsyncStorage (frontend)
3. **Token attached to requests** → All subsequent API calls include the token
4. **401 response** → Token is cleared and user is logged out

---

### ✅ Testing the Connection

#### 1. **Backend Health Check**
```bash
curl http://localhost:4000/api/test
# Response: { status: 'success', message: 'Backend API is working 🚀' }
```

#### 2. **Database Connection Test**
```bash
curl http://localhost:4000/api/db-test
# Response lists all tables in the database
```

#### 3. **Fetch Sample Data**
```bash
curl http://localhost:4000/api/trips
# Returns all trips from database
```

---

### 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Backend won't start** | Check if port 4000 is available; verify `.env` file has SQL connection string |
| **Frontend can't reach backend** | Ensure backend is running on port 4000; check VITE_API_URL in `.env` |
| **Database connection fails** | Verify credentials and server name in `.env`; check if Azure firewall allows connections |
| **CORS errors** | Verify `CORS_ORIGIN` in backend `.env` matches frontend/admin URLs |
| **API returns 401** | Token might be expired or missing; check if user is properly authenticated |

---

### 📚 Database Queries Reference

#### Get active trips with vehicle and driver info
```sql
SELECT t.trip_id, r.route_name, v.plate_number, t.status
FROM trips t
JOIN routes r ON t.route_id = r.route_id
JOIN vehicles v ON t.vehicle_id = v.vehicle_id
WHERE t.status = 'ongoing'
```

#### Get passenger load for all trips
```sql
SELECT t.trip_id, pc.passenger_count, v.capacity
FROM trips t
JOIN passenger_counts pc ON t.trip_id = pc.trip_id
JOIN vehicles v ON t.vehicle_id = v.vehicle_id
WHERE pc.recorded_at = (
  SELECT MAX(recorded_at) FROM passenger_counts 
  WHERE trip_id = t.trip_id
)
```

#### Get average trip ratings
```sql
SELECT t.trip_id, r.route_name, AVG(CAST(rt.rating AS FLOAT)) AS avg_rating
FROM trips t
JOIN routes r ON t.route_id = r.route_id
LEFT JOIN ratings rt ON t.trip_id = rt.trip_id
GROUP BY t.trip_id, r.route_name
```

---

### 📞 Support

For issues or questions about the database schema and API integration, refer to:
- Database schema definition (schema.sql)
- Backend controller implementations (src/controllers/)
- Frontend/Admin API client modules

Last Updated: April 2026
