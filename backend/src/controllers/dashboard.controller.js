import { poolPromise } from "../db/db.js";

export const getTripsDashboard = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM view_trip_vehicle");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trips dashboard" });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const pool = await poolPromise;
    const [usersResult, tripsResult, vehiclesResult, ratingsResult] =
      await Promise.all([
        pool.request().query("SELECT COUNT(*) AS total FROM users"),
        pool
          .request()
          .query(
            "SELECT COUNT(*) AS total FROM trips WHERE status IN ('ongoing','active')"
          ),
        pool
          .request()
          .query(
            "SELECT COUNT(*) AS total FROM vehicles WHERE status='Active'"
          ),
        pool
          .request()
          .query("SELECT AVG(CAST(rating AS FLOAT)) AS avg_rating FROM ratings"),
      ]);
    res.json({
      totalUsers: usersResult.recordset[0].total,
      activeTrips: tripsResult.recordset[0].total,
      activeVehicles: vehiclesResult.recordset[0].total,
      avgRating: ratingsResult.recordset[0].avg_rating || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

export const getDashboardOverview = async (req, res) => {
  try {
    const pool = await poolPromise;
    const tripsResult = await pool
      .request()
      .query(
        "SELECT TOP 10 * FROM trips ORDER BY trip_id DESC"
      );
    res.json({ recentTrips: tripsResult.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard overview" });
  }
};
