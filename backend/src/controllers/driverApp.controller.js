import { poolPromise, sql } from "../db/db.js";

// GET /api/driver/trips — trips assigned to the authenticated driver
// Uses driver_id from query param until auth middleware is added
export const getDriverTrips = async (req, res) => {
  try {
    const driverId = req.query.driver_id || req.user?.driver_id;
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT t.*, r.route_name, r.start_location, r.end_location,
               v.model AS vehicle_model, v.plate_number
        FROM trips t
        JOIN routes r ON t.route_id = r.route_id
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        WHERE t.driver_id = @id
        ORDER BY t.start_time DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch driver trips" });
  }
};

// PUT /api/driver/trips/:id/start
export const startTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE trips SET status='ongoing' WHERE trip_id=@id");
    res.json({ message: "Trip started" });
  } catch (err) {
    res.status(500).json({ error: "Failed to start trip" });
  }
};

// PUT /api/driver/trips/:id/complete
export const completeTrip = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE trips SET status='completed' WHERE trip_id=@id");
    res.json({ message: "Trip completed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to complete trip" });
  }
};

// GET /api/driver/trips/:id/passengers
export const getTripPassengers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT tk.ticket_id, tk.seat_number, tk.status,
               u.full_name, u.email, u.phone
        FROM tickets tk
        JOIN users u ON tk.user_id = u.user_id
        WHERE tk.trip_id = @id
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch passengers" });
  }
};

// GET /api/driver/earnings
export const getDriverEarnings = async (req, res) => {
  try {
    const driverId = req.query.driver_id || req.user?.driver_id;
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query(`
        SELECT COUNT(tk.ticket_id) AS total_tickets,
               SUM(tk.amount)      AS total_earnings
        FROM trips t
        JOIN tickets tk ON t.trip_id = tk.trip_id
        WHERE t.driver_id = @id AND t.status = 'completed'
      `);
    res.json(result.recordset[0] || { total_tickets: 0, total_earnings: 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};

// POST /api/driver/issues
export const reportIssue = async (req, res) => {
  try {
    const { driver_id, trip_id, description } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("driver_id", sql.Int, driver_id)
      .input("trip_id", sql.Int, trip_id || null)
      .input("description", sql.Text, description)
      .query(`
        INSERT INTO issues (driver_id, trip_id, description, created_at)
        VALUES (@driver_id, @trip_id, @description, GETDATE())
      `);
    res.status(201).json({ message: "Issue reported" });
  } catch (err) {
    res.status(500).json({ error: "Failed to report issue" });
  }
};

// POST /api/driver/emergency
export const sendEmergency = async (req, res) => {
  try {
    const { driver_id, trip_id, message } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("driver_id", sql.Int, driver_id)
      .input("trip_id", sql.Int, trip_id || null)
      .input("message", sql.Text, message || "Emergency alert")
      .query(`
        INSERT INTO issues (driver_id, trip_id, description, created_at)
        VALUES (@driver_id, @trip_id, 'EMERGENCY: ' + @message, GETDATE())
      `);
    res.status(201).json({ message: "Emergency alert sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send emergency" });
  }
};

// POST /api/driver/location
export const updateLocation = async (req, res) => {
  try {
    const { trip_id, latitude, longitude } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("trip_id", sql.Int, trip_id)
      .input("lat", sql.Decimal(9, 6), latitude)
      .input("lng", sql.Decimal(9, 6), longitude)
      .query(`
        INSERT INTO gps_logs (trip_id, latitude, longitude, recorded_at)
        VALUES (@trip_id, @lat, @lng, GETDATE())
      `);
    res.json({ message: "Location updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update location" });
  }
};
