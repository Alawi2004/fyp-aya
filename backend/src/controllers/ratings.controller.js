import { poolPromise, sql } from "../db/db.js";

export const getRatings = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        r.rating_id,
        r.user_id,
        r.trip_id,
        r.rating,
        r.comment,
        r.created_at,
        u.full_name,
        ro.route_name,
        du.full_name AS driver_name
      FROM ratings r
      LEFT JOIN users   u  ON u.user_id   = r.user_id
      LEFT JOIN trips   t  ON t.trip_id   = r.trip_id
      LEFT JOIN routes  ro ON ro.route_id = t.route_id
      LEFT JOIN drivers d  ON d.driver_id = t.driver_id
      LEFT JOIN users   du ON du.user_id  = d.user_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRating = async (req, res) => {
  try {
    const { trip_id, rating, comment } = req.body;
    const user_id = req.body.user_id ?? req.user?.user_id;
    if (!user_id || !trip_id || !rating) {
      return res.status(400).json({ error: "user_id, trip_id and rating are required" });
    }

    const pool = await poolPromise;
    const ins = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("trip_id", sql.Int, trip_id)
      .input("rating",  sql.Int, rating)
      .input("comment", sql.NVarChar(sql.MAX), comment ?? null)
      .query(`
        INSERT INTO ratings (user_id, trip_id, rating, comment)
        OUTPUT INSERTED.rating_id
        VALUES (@user_id, @trip_id, @rating, @comment)
      `);

    res.status(201).json({ message: "Rating added", rating_id: ins.recordset[0]?.rating_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTripRatings = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("trip_id", sql.Int, req.params.trip_id)
      .query(`
        SELECT r.*, u.full_name AS passenger_name
        FROM ratings r
        LEFT JOIN users u ON u.user_id = r.user_id
        WHERE r.trip_id = @trip_id
        ORDER BY r.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/driver/ratings — ratings for a specific driver's trips
export const getDriverRatings = async (req, res) => {
  try {
    const driverId = req.query.driver_id || req.user?.driver_id;
    if (!driverId) return res.status(400).json({ error: "driver_id required" });

    const pool = await poolPromise;
    const result = await pool.request()
      .input("driver_id", sql.Int, driverId)
      .query(`
        SELECT
          r.rating_id,
          r.trip_id,
          r.rating,
          r.comment,
          r.created_at,
          u.full_name  AS passenger_name,
          ro.route_name
        FROM ratings r
        JOIN trips   t  ON t.trip_id   = r.trip_id
        JOIN routes  ro ON ro.route_id = t.route_id
        LEFT JOIN users u ON u.user_id = r.user_id
        WHERE t.driver_id = @driver_id
        ORDER BY r.created_at DESC
      `);

    const rows = result.recordset;
    const total = rows.length;
    const avg   = total > 0
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : 0;

    const dist = [5, 4, 3, 2, 1].map(s => ({
      stars: s,
      count: rows.filter(r => r.rating === s).length,
    }));

    res.json({ average: avg, total, distribution: dist, reviews: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
