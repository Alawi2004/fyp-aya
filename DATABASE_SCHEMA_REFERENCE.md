# Database Schema Reference
## Smart Transportation System - Complete Schema Guide

### 📊 Table Structure & Relationships

```
USERS (1) ─────┬─────(1) DRIVERS
              ├─────(M) TICKETS
              ├─────(M) NOTIFICATIONS
              └─────(M) RATINGS

VEHICLES (1)────(M) TRIPS
DRIVERS (1)─────(M) TRIPS
ROUTES (1)──────(M) TRIPS

TRIPS (1)───┬──(M) GPS_LOGS
            ├──(M) PASSENGER_COUNTS
            ├──(M) TICKETS
            ├──(M) RATINGS
            └──(M) ETA_PREDICTIONS

ROUTES (M)◄────►(M) STOPS (via ROUTE_STOPS junction table)
```

---

## 🗂️ Detailed Table Schemas

### 1. **USERS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| user_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| full_name | VARCHAR(100) | NOT NULL | User's full name |
| email | VARCHAR(120) | UNIQUE, NOT NULL | Email address |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| phone | VARCHAR(20) | | Contact number |
| role | VARCHAR(20) | DEFAULT 'passenger', CHECK | Role: passenger/driver/admin |
| created_at | DATETIME | DEFAULT GETDATE() | Account creation timestamp |

**Key Point**: Every driver must be a user first. Drivers are linked via 1-to-1 relationship with the DRIVERS table.

---

### 2. **DRIVERS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| driver_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| user_id | INT | FOREIGN KEY, UNIQUE | References USERS (one driver per user) |
| license_number | VARCHAR(50) | NOT NULL | Driver's license number |
| hire_date | DATE | | Employment date |

**Foreign Key**: `user_id` → `users(user_id)`

**Example Usage**:
```sql
-- Get all drivers with their user info
SELECT u.full_name, u.email, d.license_number, d.hire_date
FROM users u
JOIN drivers d ON u.user_id = d.user_id;
```

---

### 3. **VEHICLES**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| vehicle_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| plate_number | VARCHAR(20) | NOT NULL, UNIQUE | Vehicle registration plate |
| vehicle_type | VARCHAR(20) | NOT NULL, CHECK | Type: bus/van/car/shuttle |
| capacity | INT | NOT NULL | Maximum passenger count |
| model | VARCHAR(50) | | Vehicle model |
| status | VARCHAR(20) | DEFAULT 'active', CHECK | Status: active/maintenance/inactive |
| created_at | DATETIME | DEFAULT GETDATE() | Registration timestamp |

**Check Values**:
- vehicle_type: 'bus', 'van', 'car', 'shuttle'
- status: 'active', 'maintenance', 'inactive'

---

### 4. **ROUTES**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| route_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| route_name | VARCHAR(100) | NOT NULL | Name of the route |
| start_location | VARCHAR(100) | | Starting point |
| end_location | VARCHAR(100) | | Ending point |

**Example**: Route 1 = "Downtown → Airport"

---

### 5. **STOPS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| stop_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| stop_name | VARCHAR(100) | NOT NULL | Stop name |
| latitude | DECIMAL(9,6) | | GPS latitude |
| longitude | DECIMAL(9,6) | | GPS longitude |

**Example**: Stop 1 = "Central Station" (40.712776, -74.005974)

---

### 6. **ROUTE_STOPS** (Junction Table - Many-to-Many)
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| route_id | INT | PRIMARY KEY, FOREIGN KEY | References ROUTES |
| stop_id | INT | PRIMARY KEY, FOREIGN KEY | References STOPS |
| stop_order | INT | | Sequence order in route |

**Purpose**: Allows stops to be on multiple routes and routes to have multiple stops.

**Example**:
```sql
-- Get all stops for Route 1 in order
SELECT s.stop_name, s.latitude, s.longitude, rs.stop_order
FROM route_stops rs
JOIN stops s ON rs.stop_id = s.stop_id
WHERE rs.route_id = 1
ORDER BY rs.stop_order;
```

---

### 7. **TRIPS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| trip_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| vehicle_id | INT | FOREIGN KEY, NOT NULL | References VEHICLES |
| driver_id | INT | FOREIGN KEY, NOT NULL | References DRIVERS |
| route_id | INT | FOREIGN KEY, NOT NULL | References ROUTES |
| start_time | DATETIME | | Trip start time |
| end_time | DATETIME | | Trip end time |
| status | VARCHAR(20) | CHECK | Status: scheduled/ongoing/completed/cancelled |

**Check Values**: 'scheduled', 'ongoing', 'completed', 'cancelled'

**Example**: Bus #42 (Plate: ABC123) driven by Driver #5 on Route 1 from 08:00 to 09:30 ✅

---

### 8. **GPS_LOGS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| gps_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| trip_id | INT | FOREIGN KEY, NOT NULL | References TRIPS |
| latitude | DECIMAL(9,6) | | Current latitude |
| longitude | DECIMAL(9,6) | | Current longitude |
| recorded_at | DATETIME | DEFAULT GETDATE() | Timestamp of position |

**Purpose**: Real-time tracking of vehicle position (recorded every few seconds)

---

### 9. **PASSENGER_COUNTS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| count_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| trip_id | INT | FOREIGN KEY, NOT NULL | References TRIPS |
| passenger_count | INT | NOT NULL | Number of passengers |
| recorded_at | DATETIME | DEFAULT GETDATE() | Timestamp |
| method | VARCHAR(20) | DEFAULT 'camera', CHECK | Detection method: camera/qr_scan |

**Check Values**: 'camera' (AI detection), 'qr_scan'

**Use Case**: AI camera counts passengers at each stop; data used for load management & analytics

---

### 10. **TICKETS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| ticket_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| user_id | INT | FOREIGN KEY, NOT NULL | References USERS |
| trip_id | INT | FOREIGN KEY, NOT NULL | References TRIPS |
| seat_number | VARCHAR(10) | | Assigned seat |
| booking_time | DATETIME | DEFAULT GETDATE() | Booking timestamp |

**Example**: User #3 books Seat A5 on Trip #42 on 2024-03-15 10:30 AM

---

### 11. **NOTIFICATIONS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| notification_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| user_id | INT | FOREIGN KEY, NOT NULL | References USERS |
| message | TEXT | NOT NULL | Notification message |
| is_read | BIT | DEFAULT 0 | Read status (0=unread, 1=read) |
| created_at | DATETIME | DEFAULT GETDATE() | Creation timestamp |

**Examples**:
- "Bus arriving in 5 minutes"
- "Delay alert: 15 minutes late"
- "Ticket confirmed for Trip #42"

---

### 12. **RATINGS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| rating_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| user_id | INT | FOREIGN KEY, NOT NULL | References USERS |
| trip_id | INT | FOREIGN KEY, NOT NULL | References TRIPS |
| rating | INT | CHECK (1-5) | Rating value 1-5 stars |
| comment | TEXT | | Optional review comment |

**Example**: User #3 rates Trip #42 as 4 stars with comment "Clean bus, good service"

---

### 13. **ETA_PREDICTIONS**
| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| eta_id | INT | PRIMARY KEY, IDENTITY | Unique identifier |
| trip_id | INT | FOREIGN KEY, NOT NULL | References TRIPS |
| predicted_arrival | DATETIME | | Predicted arrival time |
| confidence | DECIMAL(5,2) | | Confidence score (0.00-100.00) |

**Purpose**: AI predicts arrival times; multiple predictions made as trip progresses

---

## 🔍 Database Views

### VIEW 1: **view_trip_vehicle**
```sql
SELECT 
    t.trip_id,
    v.vehicle_type,
    v.plate_number,
    v.capacity,
    t.status,
    r.route_name
FROM trips t
JOIN vehicles v ON t.vehicle_id = v.vehicle_id
JOIN routes r ON t.route_id = r.route_id;
```

**Use Case**: Dashboard showing all trips with vehicle & route details

---

### VIEW 2: **view_passenger_load**
```sql
SELECT
    t.trip_id,
    MAX(pc.passenger_count) AS current_passengers,
    v.capacity
FROM trips t
JOIN passenger_counts pc ON t.trip_id = pc.trip_id
JOIN vehicles v ON t.vehicle_id = v.vehicle_id
GROUP BY t.trip_id, v.capacity;
```

**Use Case**: Real-time bus capacity monitoring

---

## 🔧 Stored Procedures

### PROCEDURE 1: **book_ticket**
```sql
CREATE PROCEDURE book_ticket
    @p_user_id INT,
    @p_trip_id INT,
    @p_seat VARCHAR(10)
AS
BEGIN
    INSERT INTO tickets (user_id, trip_id, seat_number)
    VALUES (@p_user_id, @p_trip_id, @p_seat);
END;
```

---

### PROCEDURE 2: **get_trips_by_vehicle**
```sql
CREATE PROCEDURE get_trips_by_vehicle
    @p_type VARCHAR(20)
AS
BEGIN
    SELECT *
    FROM view_trip_vehicle
    WHERE vehicle_type = @p_type;
END;
```

---

## 📈 Common Queries

### Get All Active Trips
```sql
SELECT t.trip_id, r.route_name, v.plate_number, d.user_id, t.start_time
FROM trips t
JOIN routes r ON t.route_id = r.route_id
JOIN vehicles v ON t.vehicle_id = v.vehicle_id
JOIN drivers d ON t.driver_id = d.driver_id
WHERE t.status = 'ongoing'
ORDER BY t.start_time DESC;
```

### Get User's Booking History
```sql
SELECT tk.ticket_id, r.route_name, t.start_time, tk.booking_time, tk.seat_number
FROM tickets tk
JOIN trips t ON tk.trip_id = t.trip_id
JOIN routes r ON t.route_id = r.route_id
WHERE tk.user_id = @user_id
ORDER BY t.start_time DESC;
```

### Get Trip Statistics
```sql
SELECT 
    COUNT(DISTINCT t.trip_id) AS total_trips,
    COUNT(DISTINCT tk.ticket_id) AS total_bookings,
    AVG(CAST(rt.rating AS FLOAT)) AS avg_rating,
    MAX(pc.passenger_count) AS max_passengers
FROM trips t
LEFT JOIN tickets tk ON t.trip_id = tk.trip_id
LEFT JOIN ratings rt ON t.trip_id = rt.trip_id
LEFT JOIN passenger_counts pc ON t.trip_id = pc.trip_id;
```

### Get Next Stop in Route
```sql
SELECT s.stop_name, s.latitude, s.longitude, rs.stop_order
FROM route_stops rs
JOIN stops s ON rs.stop_id = s.stop_id
WHERE rs.route_id = @route_id AND rs.stop_order > @current_order
ORDER BY rs.stop_order
OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY;
```

---

## 🔑 Key Constraints Summary

| Constraint | Type | Affected Tables |
|-----------|------|-----------------|
| 1-to-1 | USERS ← → DRIVERS | Each driver is exactly one user |
| 1-to-Many | USERS → TICKETS | One user can have multiple tickets |
| 1-to-Many | TRIPS → GPS_LOGS | One trip has many position logs |
| 1-to-Many | TRIPS → PASSENGER_COUNTS | One trip has many count snapshots |
| Many-to-Many | ROUTES ← → STOPS | Via ROUTE_STOPS junction |
| Foreign Keys | TRIPS | Links to VEHICLES, DRIVERS, ROUTES |

---

## ⚙️ Data Types Reference

| Type | SQL Equivalent | Example |
|------|---|---------|
| Auto-increment ID | INT IDENTITY(1,1) | user_id, trip_id |
| Text (short) | VARCHAR(20-100) | role, status, plate_number |
| Text (long) | VARCHAR(255) or TEXT | password_hash, comment, message |
| Decimal Coordinates | DECIMAL(9,6) | latitude 40.712776, longitude -74.005974 |
| Boolean | BIT | is_read (0 or 1) |
| DateTime | DATETIME | created_at, start_time, recorded_at |
| Date | DATE | hire_date |

---

Last Updated: April 2026
