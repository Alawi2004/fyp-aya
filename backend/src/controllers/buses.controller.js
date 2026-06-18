import { poolPromise, sql } from "../db/db.js";

// GET /api/buses — returns trips joined with vehicle & route info (what the passenger app needs)
export const getBuses = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.trip_id                                               AS _id,
        v.vehicle_id,
        v.model                                                 AS name,
        LOWER(ISNULL(v.vehicle_type, 'bus'))                    AS type,
        r.route_name                                            AS route,
        r.start_location                                        AS origin,
        r.end_location                                          AS destination,
        FORMAT(t.start_time, 'hh:mm tt')                        AS departureTime,
        FORMAT(ISNULL(t.end_time, DATEADD(MINUTE,60,t.start_time)), 'hh:mm tt') AS arrivalTime,
        CAST(DATEDIFF(MINUTE, t.start_time,
          ISNULL(t.end_time, DATEADD(MINUTE,60,t.start_time)))
        AS VARCHAR) + ' min'                                    AS duration,
        t.status,
        r.route_id,
        (SELECT TOP 1 rts.recurrence
         FROM recurring_trip_schedules rts
         WHERE rts.route_name = r.route_name AND rts.status = 'Active'
         ORDER BY rts.active_from DESC)                         AS schedule_recurrence,
        (SELECT TOP 1 rts.custom_days
         FROM recurring_trip_schedules rts
         WHERE rts.route_name = r.route_name AND rts.status = 'Active'
         ORDER BY rts.active_from DESC)                         AS schedule_custom_days,
        v.capacity                                              AS totalSeats,
        (SELECT COUNT(*) FROM tickets tk
         WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled') AS bookedSeats,
        ISNULL((SELECT STRING_AGG(tk.seat_number, ',') FROM tickets tk
                WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled'), '') AS bookedSeatsCsv,
        ISNULL((SELECT MIN(fz.base_fare) FROM fare_zones fz
                WHERE fz.route_id = r.route_id AND fz.zone_name = 'Default'), 0) AS price,
        (SELECT TOP 1 fz.base_fare FROM fare_zones fz
         WHERE fz.route_id = r.route_id AND fz.zone_name = 'Carpool')            AS carpool_price
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
          v.vehicle_id,
          v.model          AS name,
          v.plate_number,
          r.route_name     AS route,
          r.start_location AS origin,
          r.end_location   AS destination,
          t.start_time     AS departureTime,
          t.status,
          v.capacity       AS totalSeats,
          (SELECT COUNT(*) FROM tickets tk
           WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled') AS bookedSeats,
          ISNULL((SELECT STRING_AGG(tk.seat_number, ',') FROM tickets tk
                  WHERE tk.trip_id = t.trip_id AND tk.status != 'cancelled'), '') AS bookedSeatsCsv,
          u.full_name      AS driver_name,
          u.phone          AS driver_phone,
          d.driver_id,
          ISNULL((SELECT AVG(CAST(rt.rating AS FLOAT)) FROM ratings rt
                  JOIN trips tr ON tr.trip_id = rt.trip_id
                  WHERE tr.driver_id = d.driver_id), 0)            AS driver_rating,
          (SELECT COUNT(*) FROM trips tr
           WHERE tr.driver_id = d.driver_id AND tr.status = 'completed') AS driver_trips
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
