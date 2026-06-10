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
      ORDER BY r.rating_id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createRating = async (req, res) => {
  try {
    const { trip_id, rating, comment } = req.body;
    const user_id = req.user.user_id;
    if (!rating) {
      return res.status(400).json({ error: "rating is required" });
    }

    // Coerce trip_id safely: only a positive integer is valid, otherwise NULL.
    // (NaN/strings/objects would fail SQL Int validation and reject the insert.)
    const tripNum = Number(trip_id);
    const safeTripId = Number.isInteger(tripNum) && tripNum > 0 ? tripNum : null;

    const pool = await poolPromise;
    const ins = await pool
      .request()
      .input("user_id", sql.Int, user_id)
      .input("trip_id", sql.Int, safeTripId)
      .input("rating",  sql.Int, Number(rating))
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

export const createAppFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const user_id = req.user.user_id;
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }
    const pool = await poolPromise;
    await pool.request()
      .input("user_id", sql.Int, user_id)
      .input("rating",  sql.Int, Number(rating))
      .input("comment", sql.NVarChar(1000), comment ? String(comment).slice(0, 1000) : null)
      .query(`INSERT INTO app_feedback (user_id, rating, comment) VALUES (@user_id, @rating, @comment)`);
    res.status(201).json({ message: "Thank you for your feedback!" });
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
        ORDER BY r.rating_id DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/driver/ratings — ratings for a specific driver's trips
// GET /api/ratings/me — current user's own submitted ratings
export const getMyRatings = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.user.user_id)
      .query(`
        SELECT
          r.rating_id, r.trip_id, r.rating, r.comment, r.created_at,
          ro.route_name,
          du.full_name AS driver_name
        FROM   ratings r
        LEFT JOIN trips   t  ON t.trip_id   = r.trip_id
        LEFT JOIN routes  ro ON ro.route_id = t.route_id
        LEFT JOIN drivers d  ON d.driver_id = t.driver_id
        LEFT JOIN users   du ON du.user_id  = d.user_id
        WHERE  r.user_id = @uid
        ORDER  BY r.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Ratings can only be edited within this many hours of being posted.
const EDIT_WINDOW_HOURS = 24;

// PUT /api/ratings/:id — owner can edit their own rating (within 24h)
export const editMyRating = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ error: "Rating must be 1–5" });
    }
    const pool = await poolPromise;

    // Verify ownership and the 24-hour edit window before updating.
    const existing = await pool.request()
      .input("id",  sql.Int, Number(req.params.id))
      .input("uid", sql.Int, req.user.user_id)
      .query(`SELECT created_at FROM ratings WHERE rating_id = @id AND user_id = @uid`);

    if (!existing.recordset[0]) {
      return res.status(404).json({ error: "Rating not found or not yours" });
    }

    const createdAt = new Date(existing.recordset[0].created_at);
    const hoursSince = (Date.now() - createdAt.getTime()) / 36e5;
    if (hoursSince > EDIT_WINDOW_HOURS) {
      return res.status(403).json({
        error: `Ratings can only be edited within ${EDIT_WINDOW_HOURS} hours of posting.`,
      });
    }

    const result = await pool.request()
      .input("id",      sql.Int,          Number(req.params.id))
      .input("uid",     sql.Int,          req.user.user_id)
      .input("rating",  sql.Int,          Number(rating))
      .input("comment", sql.NVarChar(sql.MAX), comment ?? null)
      .query(`
        UPDATE ratings
        SET    rating = @rating, comment = @comment
        OUTPUT INSERTED.rating_id, INSERTED.rating, INSERTED.comment, INSERTED.created_at
        WHERE  rating_id = @id AND user_id = @uid
      `);
    res.json({ message: "Rating updated", rating: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/ratings/:id — owner can delete their own rating
export const deleteMyRating = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id",  sql.Int, Number(req.params.id))
      .input("uid", sql.Int, req.user.user_id)
      .query("DELETE FROM ratings WHERE rating_id = @id AND user_id = @uid");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Rating not found or not yours" });
    }
    res.json({ message: "Rating deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
          u.full_name  AS passenger_name,
          ro.route_name
        FROM ratings r
        JOIN trips   t  ON t.trip_id   = r.trip_id
        JOIN routes  ro ON ro.route_id = t.route_id
        LEFT JOIN users u ON u.user_id = r.user_id
        WHERE t.driver_id = @driver_id
        ORDER BY r.rating_id DESC
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
