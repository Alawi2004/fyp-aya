import { poolPromise, sql } from "../db/db.js";
import { sqlLocalDate } from "../utils/lebanonTime.js";

// NOTE: Driver GPS ingest is consolidated to POST /api/driver/location
// (driverApp.controller.updateLocation). The old POST /api/gps endpoint was
// removed so there is a single write path into gps_logs.

// A trip with no GPS ping within this window is treated as no longer "live",
// so the live/latest/bus/SSE endpoints never return a frozen position as if it
// were current. Applied consistently across every live-position query.
const LIVE_GPS_WINDOW_MIN = 30;

// GET /api/gps/trip/:id?date=YYYY-MM-DD
// Returns the full ordered GPS track for a trip, optionally filtered to a single date.
// When no records exist, returns { points: [], hasData: false } so the frontend
// can show "No GPS data for this date" rather than generating fake movement.
export const getTripGpsHistory = async (req, res) => {
  try {
    const tripId = parseInt(req.params.id, 10);
    const { date } = req.query;
    const pool    = await poolPromise;
    const request = pool.request().input("trip_id", sql.Int, tripId);

    let where = "WHERE trip_id = @trip_id";
    if (date) {
      request.input("date", sql.Date, date);
      where += ` AND ${sqlLocalDate('recorded_at')} = @date`;
    }

    const result = await request.query(`
      SELECT
        gps_id,
        CAST(latitude  AS FLOAT) AS lat,
        CAST(longitude AS FLOAT) AS lng,
        CAST(speed     AS FLOAT) AS speed,
        CAST(heading   AS FLOAT) AS heading,
        recorded_at              AS timestamp
      FROM gps_logs
      ${where}
      ORDER BY recorded_at ASC
    `);

    const points = result.recordset.map(r => ({
      lat:       r.lat,
      lng:       r.lng,
      timestamp: r.timestamp,
      timeLabel: new Date(r.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      speed:     r.speed ?? 0,
      heading:   r.heading ?? null,
    }));

    res.json({ points, hasData: points.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch GPS history" });
  }
};

// GET /api/gps/live — latest GPS position per active trip (admin live map)
export const getLiveGps = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        t.trip_id,
        CONCAT('TRP-', RIGHT('000' + CAST(t.trip_id AS VARCHAR), 3)) AS trip_ref,
        CAST(g.latitude  AS FLOAT) AS lat,
        CAST(g.longitude AS FLOAT) AS lng,
        g.recorded_at,
        r.route_name   AS route,
        u.full_name    AS driver,
        v.plate_number AS vehicle
      FROM (
        SELECT trip_id, latitude, longitude, recorded_at,
               ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY recorded_at DESC) AS rn
        FROM gps_logs
        WHERE recorded_at >= DATEADD(minute, -${LIVE_GPS_WINDOW_MIN}, GETUTCDATE())
      ) g
      JOIN  trips    t ON t.trip_id    = g.trip_id
      LEFT JOIN routes   r ON r.route_id   = t.route_id
      LEFT JOIN drivers  d ON d.driver_id  = t.driver_id
      LEFT JOIN users    u ON u.user_id    = d.user_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      WHERE g.rn = 1
        AND LOWER(ISNULL(t.status, '')) IN ('ongoing', 'active')
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live GPS data' });
  }
};

// GET /api/gps/bus/:vehicleId — latest GPS for a vehicle's active trip (passenger app)
export const getBusGps = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('vid', sql.NVarChar(50), req.params.vehicleId)
      .query(`
        SELECT TOP 1
          CAST(g.latitude  AS FLOAT) AS latitude,
          CAST(g.longitude AS FLOAT) AS longitude,
          g.recorded_at              AS updatedAt
        FROM gps_logs g
        JOIN  trips    t ON t.trip_id    = g.trip_id
        JOIN  vehicles v ON v.vehicle_id = t.vehicle_id
        WHERE (
              LOWER(v.plate_number) = LOWER(@vid)
          OR  LOWER(REPLACE(v.plate_number, '-', '')) = LOWER(REPLACE(@vid, '-', ''))
          -- The passenger app subscribes/polls by trip_id, so also match that.
          OR  (TRY_CAST(@vid AS INT) IS NOT NULL AND t.trip_id = TRY_CAST(@vid AS INT))
        )
          AND LOWER(ISNULL(t.status, '')) IN ('ongoing', 'active')
          AND g.recorded_at >= DATEADD(minute, -${LIVE_GPS_WINDOW_MIN}, GETUTCDATE())
        ORDER BY g.recorded_at DESC
      `);
    if (!result.recordset[0]) return res.status(404).json(null);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bus GPS' });
  }
};

// GET /api/gps/:trip_id/latest
export const getLatestGps = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("trip_id", sql.Int, req.params.trip_id).query(`
        SELECT TOP 1 g.*
        FROM gps_logs g
        JOIN trips t ON t.trip_id = g.trip_id
        WHERE g.trip_id = @trip_id
          AND LOWER(ISNULL(t.status, '')) IN ('ongoing', 'active')
          AND g.recorded_at >= DATEADD(minute, -${LIVE_GPS_WINDOW_MIN}, GETUTCDATE())
        ORDER BY g.recorded_at DESC
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch GPS data" });
  }
};

// NOTE: the old SSE stream (GET /api/gps/sse/bus/:vehicleId) was removed — it
// had no clients and spawned an unbounded per-connection 3s DB poll. Live
// browser/app tracking uses the WebSocket stream at /gps-stream instead.

// GET /api/gps/geofence-alerts — recent geofence breach events
export const getGeofenceAlerts = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const limit  = Math.min(100, Number(req.query.limit) || 50);
    const status = req.query.status;       // 'active' | 'resolved' | (all)

    const r = pool.request().input("limit", sql.Int, limit);
    const where = status ? ` AND ge.status = '${status === "active" ? "active" : "resolved"}'` : "";

    const result = await r.query(`
      SELECT TOP (@limit)
        ge.event_id,
        ge.trip_id,
        CONCAT('TRP-', RIGHT('000' + CAST(ge.trip_id AS VARCHAR), 3)) AS trip_ref,
        v.plate_number AS vehicle,
        r.route_name   AS route,
        CAST(ge.latitude  AS FLOAT) AS lat,
        CAST(ge.longitude AS FLOAT) AS lng,
        ge.distance_m,
        ge.status,
        ge.detected_at,
        ge.resolved_at
      FROM geofence_events ge
      LEFT JOIN trips    t ON t.trip_id    = ge.trip_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      LEFT JOIN routes   r ON r.route_id   = ge.route_id
      WHERE 1=1 ${where}
      ORDER BY ge.detected_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch geofence alerts" });
  }
};
