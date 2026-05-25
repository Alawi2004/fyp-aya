import { poolPromise, sql } from "../db/db.js";

// GET /api/buses — returns trips joined with vehicle & route info (what the passenger app needs)
export const getBuses = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.trip_id   AS _id,
        v.model     AS name,
        r.route_name AS route,
        r.start_location AS origin,
        r.end_location   AS destination,
        t.start_time     AS departureTime,
        t.status,
        v.capacity       AS totalSeats
      FROM trips t
      JOIN vehicles v ON t.vehicle_id = v.vehicle_id
      JOIN routes  r ON t.route_id   = r.route_id
      WHERE t.status IN ('ongoing','active','scheduled','boarding','delayed')
    `);
    res.json({ buses: result.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch buses" });
  }
};

// GET /api/buses/:id
export const getBusById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          t.trip_id        AS _id,
          v.model          AS name,
          v.plate_number,
          r.route_name     AS route,
          r.start_location AS origin,
          r.end_location   AS destination,
          t.start_time     AS departureTime,
          t.status,
          v.capacity       AS totalSeats,
          u.full_name      AS driver_name,
          u.phone          AS driver_phone,
          d.driver_id,
          d.rating         AS driver_rating,
          d.total_trips    AS driver_trips
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.vehicle_id
        JOIN routes  r ON t.route_id   = r.route_id
        LEFT JOIN drivers d ON t.driver_id = d.driver_id
        LEFT JOIN users   u ON d.user_id   = u.user_id
        WHERE t.trip_id = @id
      `);
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bus" });
  }
};

// GET /api/buses/:id/location — returns latest GPS log for a trip
export const getBusLocation = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT TOP 1 latitude, longitude, recorded_at
        FROM gps_logs
        WHERE trip_id = @id
        ORDER BY recorded_at DESC
      `);
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bus location" });
  }
};

// GET /api/buses/:id/route
export const getBusRoute = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT r.*, s.stop_name, s.latitude, s.longitude, rs.stop_order
        FROM trips t
        JOIN routes r ON t.route_id = r.route_id
        JOIN route_stops rs ON r.route_id = rs.route_id
        JOIN stops s ON rs.stop_id = s.stop_id
        WHERE t.trip_id = @id
        ORDER BY rs.stop_order
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bus route" });
  }
};
