import { sql } from "../../db/db.js";
import { getRouteSegments } from "./hereClient.js";

// Real road-based total duration (minutes) for a route, derived from its
// ordered stops — not a guess from trip start/end timestamps (end_time is
// only set once a trip completes, which is why upcoming trips used to all
// show the same fallback duration). Pass a Map as `cache` to reuse results
// across multiple rows in the same request.
export async function getRouteDurationMin(pool, routeId, cache) {
  if (cache?.has(routeId)) return cache.get(routeId);

  const stopsRes = await pool.request()
    .input("route_id", sql.Int, routeId)
    .query(`
      SELECT s.stop_id, CAST(s.latitude AS FLOAT) AS latitude, CAST(s.longitude AS FLOAT) AS longitude
      FROM   route_stops rs
      JOIN   stops s ON s.stop_id = rs.stop_id
      WHERE  rs.route_id = @route_id
      ORDER  BY rs.stop_order
    `);
  const stops = stopsRes.recordset;

  let durationMin = null;
  if (stops.length >= 2) {
    try {
      const segments = await getRouteSegments(stops);
      durationMin = Math.round(segments.reduce((s, seg) => s + seg.duration_min, 0));
    } catch { /* keep null — caller falls back to a generic estimate */ }
  }

  cache?.set(routeId, durationMin);
  return durationMin;
}
