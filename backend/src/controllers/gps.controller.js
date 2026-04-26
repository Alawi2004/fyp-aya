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
