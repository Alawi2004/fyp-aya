import { poolPromise, sql } from "../db/db.js";

// POST /api/gps
export const sendGpsLocation = async (req, res) => {
  try {
    const { trip_id, latitude, longitude } = req.body;
    const pool = await poolPromise;

    await pool
      .request()
      .input("trip_id", sql.Int, trip_id)
      .input("latitude", sql.Decimal(9, 6), latitude)
      .input("longitude", sql.Decimal(9, 6), longitude).query(`
        INSERT INTO gps_logs(trip_id, latitude, longitude)
        VALUES(@trip_id, @latitude, @longitude)
      `);

    res.status(201).json({ message: "GPS location saved" });
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
