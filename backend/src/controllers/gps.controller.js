import { poolPromise, sql } from "../db/db.js";
import { broadcastGpsUpdate } from "../services/gps.stream.service.js";

// POST /api/gps — save location and broadcast to WebSocket subscribers
export const sendGpsLocation = async (req, res) => {
  try {
    const { trip_id, latitude, longitude, speed, heading } = req.body;
    const pool = await poolPromise;

    // Resolve plate number for the WebSocket broadcast
    const tripRow = await pool.request()
      .input("tid", sql.Int, trip_id)
      .query(`
        SELECT
          CONCAT('TRP-', RIGHT('000' + CAST(t.trip_id AS VARCHAR), 3)) AS trip_ref,
          v.plate_number AS vehicle_id,
          r.route_name   AS route
        FROM trips t
        LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        LEFT JOIN routes   r ON r.route_id   = t.route_id
        WHERE t.trip_id = @tid
      `);

    await pool
      .request()
      .input("trip_id",   sql.Int,          trip_id)
      .input("latitude",  sql.Decimal(9, 6), latitude)
      .input("longitude", sql.Decimal(9, 6), longitude)
      .query(`INSERT INTO gps_logs(trip_id, latitude, longitude, recorded_at) VALUES(@trip_id, @latitude, @longitude, GETDATE())`);

    res.status(201).json({ message: "GPS location saved" });

    // Fire-and-forget WebSocket broadcast after response is sent
    const meta = tripRow.recordset[0] ?? {};
    broadcastGpsUpdate({
      trip_id:    trip_id,
      trip_ref:   meta.trip_ref   ?? null,
      vehicle_id: meta.vehicle_id ?? null,
      route:      meta.route      ?? null,
      lat:        parseFloat(latitude),
      lng:        parseFloat(longitude),
      speed:      speed   ?? null,
      heading:    heading ?? null,
      recorded_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save GPS data" });
  }
};

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
      where += " AND CAST(recorded_at AS DATE) = @date";
    }

    const result = await request.query(`
      SELECT
        gps_id,
        CAST(latitude  AS FLOAT) AS lat,
        CAST(longitude AS FLOAT) AS lng,
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
      speed:     0,
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
        WHERE recorded_at >= DATEADD(minute, -30, GETUTCDATE())
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
        )
          AND LOWER(ISNULL(t.status, '')) IN ('ongoing', 'active')
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
        SELECT TOP 1 *
        FROM gps_logs
        WHERE trip_id = @trip_id
        ORDER BY recorded_at DESC
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch GPS data" });
  }
};

// GET /api/gps/sse/bus/:vehicleId — SSE stream for browser clients
// Pushes a GPS position event every 3 seconds until the client disconnects.
export const sseGpsBus = async (req, res) => {
  const { vehicleId } = req.params;

  res.writeHead(200, {
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection":    "keep-alive",
    "X-Accel-Buffering": "no",   // disable nginx buffering
  });

  // Send a connected event immediately so the client doesn't wait 3 s
  res.write(`data: ${JSON.stringify({ type: "connected", vehicle_id: vehicleId })}\n\n`);

  const push = async () => {
    try {
      const pool   = await poolPromise;
      const result = await pool.request()
        .input("vid", sql.NVarChar(50), vehicleId)
        .query(`
          SELECT TOP 1
            CAST(g.latitude  AS FLOAT) AS latitude,
            CAST(g.longitude AS FLOAT) AS longitude,
            g.recorded_at              AS updatedAt
          FROM gps_logs g
          JOIN  trips    t ON t.trip_id    = g.trip_id
          JOIN  vehicles v ON v.vehicle_id = t.vehicle_id
          WHERE (LOWER(v.plate_number) = LOWER(@vid) OR LOWER(REPLACE(v.plate_number,'-','')) = LOWER(REPLACE(@vid,'-','')))
            AND LOWER(ISNULL(t.status,'')) IN ('ongoing','active')
          ORDER BY g.recorded_at DESC
        `);

      if (result.recordset[0]) {
        res.write(`data: ${JSON.stringify({ type: "gps_update", ...result.recordset[0] })}\n\n`);
      }
    } catch { /* keep stream alive on transient DB errors */ }
  };

  await push();
  const interval = setInterval(push, 3_000);

  req.on("close", () => clearInterval(interval));
};

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
