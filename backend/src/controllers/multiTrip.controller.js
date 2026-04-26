import { poolPromise, sql } from "../db/db.js";
import { findMultiTripRoutes } from "../modules/routing/multiTripRouter.js";

const SUPPORTED_MODES = new Set(["fastest", "easiest", "cheapest"]);

const routeDataQuery = `
  SELECT
    r.*,
    rs.stop_id,
    rs.stop_order,
    s.stop_name,
    s.latitude,
    s.longitude,
    vehicle_pick.vehicle_type
  FROM routes r
  JOIN route_stops rs ON r.route_id = rs.route_id
  JOIN stops s ON rs.stop_id = s.stop_id
  OUTER APPLY (
    SELECT TOP 1 v.vehicle_type
    FROM trips t
    JOIN vehicles v ON t.vehicle_id = v.vehicle_id
    WHERE t.route_id = r.route_id
      AND ISNULL(t.status, 'scheduled') <> 'cancelled'
    ORDER BY
      CASE WHEN t.status = 'ongoing' THEN 0 WHEN t.status = 'scheduled' THEN 1 ELSE 2 END,
      t.start_time DESC
  ) vehicle_pick
  ORDER BY r.route_id, rs.stop_order;
`;

export const getMultiTripRoute = async (req, res) => {
  try {
    const { start_id, end_id, mode = "fastest", alternatives } = req.query;
    const rankingMode = String(mode).toLowerCase();

    if (!start_id || !end_id) {
      return res.status(400).json({
        error: "start_id and end_id are required.",
      });
    }

    if (!SUPPORTED_MODES.has(rankingMode)) {
      return res.status(400).json({
        error: "Unsupported mode. Use fastest, easiest, or cheapest.",
      });
    }

    const pool = await poolPromise;

    const exists = await pool
      .request()
      .input("start_id", sql.Int, start_id)
      .input("end_id", sql.Int, end_id)
      .query(`
        SELECT stop_id
        FROM stops
        WHERE stop_id IN (@start_id, @end_id);
      `);

    if (exists.recordset.length < 2 && Number(start_id) !== Number(end_id)) {
      return res.status(404).json({
        error: "One or both stops were not found.",
      });
    }

    const routeData = await pool.request().query(routeDataQuery);
    const result = findMultiTripRoutes(routeData.recordset, start_id, end_id, rankingMode, {
      includeAlternatives: alternatives === "true" || alternatives === "1",
    });

    if (!result.primary) {
      return res.status(404).json({
        route_type: "unavailable",
        mode: rankingMode,
        message: result.reason || "No route found.",
        alternatives: [],
      });
    }

    return res.json({
      ...result.primary,
      alternatives: result.alternatives,
      direct_available: result.direct_available,
    });
  } catch (err) {
    console.error("Multi-trip routing error:", err);
    return res.status(500).json({
      error: "Failed to calculate multi-step route.",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
