# 🚀 Quick Start Checklist - Database Connection Verification

## Pre-Startup Verification ✅

### 1. Backend Setup
- [ ] Navigate to `backend/` directory
- [ ] Verify `.env` file exists with these key variables:
  - [ ] `SQL_CONNECTION_STRING` (Azure SQL connection details)
  - [ ] `PORT=4000`
  - [ ] `JWT_SECRET` set
- [ ] Run `npm install` (if not done)
- [ ] Check if `mssql` package is installed

### 2. Frontend Setup
- [ ] Navigate to `frontend/` directory
- [ ] Verify `.env` file exists with:
  - [ ] `VITE_API_URL=http://localhost:4000/api`
  - [ ] `VITE_API_TIMEOUT=15000`
- [ ] Verify `src/api/apiClient.js` is using environment variables (not commented out)
- [ ] Check `axios` is installed in package.json
- [ ] Run `npm install` (if not done)

### 3. Admin Dashboard Setup
- [ ] Navigate to `admin/` directory
- [ ] Verify `.env` file exists with:
  - [ ] `VITE_API_URL=http://localhost:4000/api`
  - [ ] `VITE_BUS_COUNTER_API=http://localhost:8000/api`
- [ ] Verify `src/api/apiClient.js` exists and uses fetch API
- [ ] Verify `src/api/endpoints.js` has all endpoint definitions
- [ ] Run `npm install` (if not done)

---

## Startup Procedure 🟢

### Open 3 Terminals (One for Each Component)

#### Terminal 1 - Backend
```bash
cd backend
npm run dev

# Expected output:
# ✅ Azure SQL Database connected successfully
# 🚀 Server running on http://localhost:4000
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev

# Expected output:
# ➜  Local:   http://localhost:3000/
```

#### Terminal 3 - Admin Dashboard
```bash
cd admin
npm run dev

# Expected output:
# ➜ Local:   http://localhost:5173/
```

---

## Connection Tests 🧪

### 1. Backend Health Check
```bash
# In a new terminal:
curl http://localhost:4000/api/test

# Expected Response:
# {
#   "status": "success",
#   "message": "Backend API is working 🚀",
#   "time": "2024-03-15T10:30:00Z"
# }
```

### 2. Database Connection Test
```bash
curl http://localhost:4000/api/db-test

# Expected Response:
# {
#   "success": true,
#   "tables": [
#     { "TABLE_SCHEMA": "dbo", "TABLE_NAME": "users" },
#     { "TABLE_SCHEMA": "dbo", "TABLE_NAME": "drivers" },
#     { "TABLE_SCHEMA": "dbo", "TABLE_NAME": "vehicles" },
#     ... (more tables)
#   ]
# }
```

### 3. Fetch Sample Data
```bash
curl http://localhost:4000/api/trips

# Expected Response:
# [
#   { "trip_id": 1, "vehicle_id": 1, "driver_id": 1, "status": "scheduled" },
#   ...
# ]
```

### 4. Frontend API Test
- Open http://localhost:3000 in browser
- Open DevTools (F12) → Console
- Check if any errors appear
- Try navigating to pages that fetch data (Dashboard, Trips, etc.)
- **Success**: Data loads without "API disabled" errors

### 5. Admin Dashboard Test
- Open http://localhost:5173 in browser
- Open DevTools (F12) → Network tab
- Try using admin features
- **Success**: See network requests to `http://localhost:4000/api/`

---

## Troubleshooting Guide 🔧

### Backend Won't Start
| Error | Solution |
|-------|----------|
| `EADDRINUSE :::4000` | Port 4000 in use. Kill process: `lsof -i :4000` then `kill -9 <PID>` |
| `SQL_CONNECTION_STRING is missing` | Add connection string to `.env` file |
| `Cannot find module 'mssql'` | Run `npm install` in backend directory |

### Frontend Can't Connect to Backend
| Error | Solution |
|-------|----------|
| `ERR_EMPTY_RESPONSE` | Backend not running on port 4000 |
| `CORS error` | Check `CORS_ORIGIN` in backend `.env` |
| `API disabled` | Check if `apiClient.js` is correctly configured (not commented out) |

### Admin Dashboard Can't Fetch Data
| Error | Solution |
|-------|----------|
| `Network error` | Verify `VITE_API_URL` in `.env` points to backend |
| `localStorage is null` | Using browser's private mode; open in normal window |
| `401 Unauthorized` | Authentication token expired; user needs to login |

### Database Connection Fails
| Error | Solution |
|-------|----------|
| `Connection timeout` | Check if server name is correct in connection string |
| `Login failed` | Verify username and password |
| `Azure firewall blocked` | Add your IP to Azure SQL firewall rules |

---

## API Connection Flow Diagram

```
┌─────────────┐
│   Frontend  │ (localhost:3000)
└──────┬──────┘
       │
       │ HTTP Requests
       ├─ VITE_API_URL = http://localhost:4000/api
       │
       ▼
┌─────────────────────────────────────┐
│  Backend API Server                 │ (localhost:4000)
│  ✅ CORS enabled                    │
│  ✅ Auth middleware                 │
│  ✅ Route handlers                  │
└──────┬──────────────────────────────┘
       │
       │ SQL Queries
       │ Connection String
       │
       ▼
┌────────────────────────────────────────┐
│  Azure SQL Database                    │
│  Server: fypserver.database.windows.net│
│  Database: fypdatabase                 │
│  ✅ 14 tables                          │
│  ✅ 2 views                            │
│  ✅ 2 stored procedures                │
└────────────────────────────────────────┘
```

---

## Admin Dashboard Architecture

```
┌─────────────────────────────────────┐
│  Admin Dashboard (localhost:5173)   │
└──────┬──────────────────────────────┘
       │
       ├─ src/api/apiClient.js
       │  └─ Base HTTP client with auth
       │
       ├─ src/api/endpoints.js
       │  └─ All API endpoint functions
       │  └─ trip, vehicle, driver, route endpoints
       │
       ├─ src/hooks/useBackendData.js
       │  └─ Custom React hooks for data fetching
       │  └─ useTrips(), useVehicles(), useDashboards()
       │
       └─ src/hooks/useBusCounter.js
          └─ Polls passenger counter API
          └─ VITE_BUS_COUNTER_API = http://localhost:8000/api

            │
            ▼
       Backend API
       (localhost:4000)
```

---

## File Structure Summary

```
fyp-aya/
├── backend/
│   ├── .env                          ← Database connection
│   ├── src/
│   │   ├── db/db.js                 ← MSSQL connection pool
│   │   ├── controllers/              ← Business logic
│   │   ├── routes/                   ← API endpoints
│   │   ├── app.js                   ← Express setup
│   │   └── server.js                ← Server startup
│   └── package.json
│
├── frontend/
│   ├── .env                          ← API URL config
│   ├── src/
│   │   ├── api/
│   │   │   ├── apiClient.js         ← Axios instance
│   │   │   ├── authApi.js           ← Auth endpoints
│   │   │   ├── busApi.js            ← Bus endpoints
│   │   │   └── ...
│   │   └── components/
│   └── package.json
│
├── admin/
│   ├── .env                          ← API URLs config
│   ├── src/
│   │   ├── api/
│   │   │   ├── apiClient.js         ← Fetch-based client
│   │   │   └── endpoints.js         ← All backend endpoints
│   │   ├── hooks/
│   │   │   ├── useBackendData.js    ← Data fetching hooks
│   │   │   └── useBusCounter.js     ← Counter polling
│   │   └── components/
│   └── package.json
│
├── INTEGRATION_GUIDE.md              ← Full setup guide
└── DATABASE_SCHEMA_REFERENCE.md     ← Schema details
```

---

## Next Steps After Verification ✨

Once all checks pass:

1. **Create Sample Data** (Optional)
   ```bash
   # Run SQL scripts to populate test data
   # Use queries in DATABASE_SCHEMA_REFERENCE.md
   ```

2. **Test End-to-End Flow**
   - Frontend: Create trip booking
   - Admin: View trip details, passenger count
   - Backend: Log should show all API calls

3. **Monitor Logs**
   - Backend console: SQL queries and errors
   - Frontend DevTools: Network requests and errors
   - Admin DevTools: API response status

4. **Deploy (When Ready)**
   - Update CORS_ORIGIN and API URLs for production
   - Update .env files with production database credentials
   - Run builds: `npm run build` in each directory

---

## Support & Documentation

- **Integration Guide**: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- **Database Schema**: [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md)
- **Backend Controllers**: `backend/src/controllers/`
- **API Routes**: `backend/src/routes/`

---

✅ **Setup Complete!** Your system is now ready for development.

Last Updated: April 2026
