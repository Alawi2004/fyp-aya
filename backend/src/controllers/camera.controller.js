import { sql, poolPromise } from "../db/db.js";

const CAMERA_SERVER = process.env.CAMERA_SERVER_URL || "http://localhost:9000";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getPool() {
  const pool = await poolPromise;
  if (!pool) throw new Error("Database unavailable");
  return pool;
}

async function fetchCamera(path) {
  const res = await fetch(`${CAMERA_SERVER}${path}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Camera server error: ${res.status}`);
  return res.json();
}

// ─── Passenger status (live from Python camera server) ───────────────────────

export const getPassengerStatus = async (req, res) => {
  const { bus_id } = req.query;
  try {
    const qs   = bus_id ? `?bus_id=${bus_id}` : "";
    const data = await fetchCamera(`/api/passenger/status${qs}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: "Camera server offline", detail: err.message });
  }
};

// ─── Driver status (live from Python camera server) ──────────────────────────

export const getDriverStatus = async (req, res) => {
  const { bus_id } = req.query;
  try {
    const qs   = bus_id ? `?bus_id=${bus_id}` : "";
    const data = await fetchCamera(`/api/driver/status${qs}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: "Camera server offline", detail: err.message });
  }
};

// ─── Log passenger event (called by Python camera server) ────────────────────

export const logPassengerEvent = async (req, res) => {
  const { bus_id, event_type, track_id, passenger_count, available_seats } = req.body;
  if (!bus_id || !event_type) {
    return res.status(400).json({ error: "bus_id and event_type are required" });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input("bus_id",          sql.VarChar(20), bus_id)
      .input("event_type",      sql.VarChar(10), event_type)
      .input("track_id",        sql.Int,         track_id        ?? null)
      .input("passenger_count", sql.Int,         passenger_count ?? 0)
      .input("available_seats", sql.Int,         available_seats ?? null)
      .query(`
        INSERT INTO camera_passenger_events
          (bus_id, event_type, track_id, passenger_count, available_seats)
        VALUES
          (@bus_id, @event_type, @track_id, @passenger_count, @available_seats)
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[camera] logPassengerEvent:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Log driver alert (called by Python camera server) ───────────────────────

export const logDriverAlert = async (req, res) => {
  const { bus_id, alert_type, confidence } = req.body;
  if (!bus_id || !alert_type) {
    return res.status(400).json({ error: "bus_id and alert_type are required" });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input("bus_id",     sql.VarChar(20), bus_id)
      .input("alert_type", sql.VarChar(30), alert_type)
      .input("confidence", sql.Int,         confidence ?? 0)
      .query(`
        INSERT INTO camera_driver_alerts (bus_id, alert_type, confidence)
        VALUES (@bus_id, @alert_type, @confidence)
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[camera] logDriverAlert:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Recent passenger events (from DB) ───────────────────────────────────────

export const getPassengerEvents = async (req, res) => {
  const { bus_id, limit = 50 } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request().input("limit", sql.Int, Number(limit));
    const whereClause = bus_id
      ? (request.input("bus_id", sql.VarChar(20), bus_id), "WHERE bus_id = @bus_id")
      : "";
    const result = await request.query(`
      SELECT TOP (@limit) *
      FROM camera_passenger_events
      ${whereClause}
      ORDER BY recorded_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Recent driver alerts (from DB) ──────────────────────────────────────────

export const getDriverAlerts = async (req, res) => {
  const { bus_id, limit = 50 } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request().input("limit", sql.Int, Number(limit));
    const whereClause = bus_id
      ? (request.input("bus_id", sql.VarChar(20), bus_id), "WHERE bus_id = @bus_id")
      : "";
    const result = await request.query(`
      SELECT TOP (@limit) *
      FROM camera_driver_alerts
      ${whereClause}
      ORDER BY recorded_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Analytics — passenger trends per bus ────────────────────────────────────

export const getPassengerTrends = async (req, res) => {
  const { bus_id, hours = 24 } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request()
      .input("hours",  sql.Int, Number(hours));
    const whereClause = bus_id
      ? (request.input("bus_id", sql.VarChar(20), bus_id), "AND bus_id = @bus_id")
      : "";
    const result = await request.query(`
      SELECT
        bus_id,
        DATEPART(HOUR, recorded_at)              AS hour,
        COUNT(CASE WHEN event_type='ENTER' THEN 1 END) AS entries,
        COUNT(CASE WHEN event_type='EXIT'  THEN 1 END) AS exits,
        COUNT(*)                                 AS total_events
      FROM camera_passenger_events
      WHERE recorded_at >= DATEADD(HOUR, -@hours, GETUTCDATE())
        ${whereClause}
      GROUP BY bus_id, DATEPART(HOUR, recorded_at)
      ORDER BY bus_id, hour
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Camera health check ──────────────────────────────────────────────────────

export const getCameraHealth = async (req, res) => {
  try {
    const data = await fetchCamera("/api/health");
    res.json({ status: "online", ...data });
  } catch {
    res.json({ status: "offline", buses: [], timestamp: new Date().toISOString() });
  }
};
