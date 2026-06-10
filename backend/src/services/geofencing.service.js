/**
 * Server-side Geofencing Engine — Yalla Transit
 *
 * Runs a background loop every 30 seconds checking every active trip's
 * latest GPS position against its planned route corridor.
 *
 * When a vehicle strays more than GEOFENCE_RADIUS_M (500 m) from all
 * waypoints on its assigned route:
 *   1. A row is inserted into geofence_events (status = 'active').
 *   2. Admin users with push tokens receive an FCM/Expo alert.
 *   3. The WebSocket GPS stream broadcasts a 'geofence_breach' event.
 *
 * When the vehicle returns within the corridor the existing event is
 * resolved (status = 'resolved').
 *
 * Only ONE active event per trip is stored at a time — duplicate
 * checks are suppressed.
 */

import { poolPromise, sql } from "../db/db.js";
import { dispatchToTokens } from "./fcm.service.js";
import { broadcastEvent }   from "./gps.stream.service.js";

const GEOFENCE_RADIUS_M  = 500;
const CHECK_INTERVAL_MS  = 30_000;   // 30 seconds
let   _running = false;

// ── Pure maths ────────────────────────────────────────────────────────────────

function haversineM(lat1, lon1, lat2, lon2) {
  const R      = 6_371_000;
  const toRad  = d => (d * Math.PI) / 180;
  const dLat   = toRad(lat2 - lat1);
  const dLon   = toRad(lon2 - lon1);
  const a      = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Minimum great-circle distance from point (lat, lon) to any segment
 * endpoint in the waypoints array.
 *
 * Using endpoint distance only (no perpendicular projection) is safe
 * because route_waypoints are stored at ~100-500 m resolution.
 */
function distToPath(lat, lon, waypoints) {
  if (!waypoints.length) return 0;
  return Math.min(
    ...waypoints.map(w =>
      haversineM(lat, lon, parseFloat(w.latitude), parseFloat(w.longitude))
    )
  );
}

// ── Single check cycle ────────────────────────────────────────────────────────

async function _runCheck() {
  const pool = await poolPromise;

  // ── 1. Active trips with a GPS ping in the last 5 minutes ────────────────
  const tripRes = await pool.request().query(`
    SELECT
      t.trip_id, t.route_id,
      v.plate_number AS vehicle,
      CONCAT('TRP-', RIGHT('000' + CAST(t.trip_id AS VARCHAR), 3)) AS trip_ref,
      u.full_name  AS driver,
      CAST(g.latitude  AS FLOAT) AS lat,
      CAST(g.longitude AS FLOAT) AS lng
    FROM trips t
    JOIN vehicles v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN drivers  d ON d.driver_id = t.driver_id
    LEFT JOIN users    u ON u.user_id   = d.user_id
    JOIN (
      SELECT trip_id, latitude, longitude,
             ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY recorded_at DESC) AS rn
      FROM gps_logs
      WHERE recorded_at >= DATEADD(minute, -5, GETUTCDATE())
    ) g ON g.trip_id = t.trip_id AND g.rn = 1
    WHERE LOWER(ISNULL(t.status, '')) IN ('ongoing', 'active')
  `);

  for (const trip of tripRes.recordset) {
    // ── 2. Load route waypoints ───────────────────────────────────────────
    const wptRes = await pool.request()
      .input("rid", sql.Int, trip.route_id)
      .query(`
        SELECT latitude, longitude
        FROM route_waypoints
        WHERE route_id = @rid
        ORDER BY wp_order
      `);

    if (!wptRes.recordset.length) continue;  // no waypoints to check against

    const distM = Math.round(distToPath(trip.lat, trip.lng, wptRes.recordset));

    if (distM > GEOFENCE_RADIUS_M) {
      // ── 3a. Check for existing active breach ──────────────────────────
      const existing = await pool.request()
        .input("tid", sql.Int, trip.trip_id)
        .query(`
          SELECT TOP 1 event_id
          FROM geofence_events
          WHERE trip_id = @tid AND status = 'active'
        `);

      if (!existing.recordset.length) {
        // ── 3b. Insert new breach event ───────────────────────────────
        await pool.request()
          .input("tid",      sql.Int,         trip.trip_id)
          .input("lat",      sql.Decimal(9,6), trip.lat)
          .input("lng",      sql.Decimal(9,6), trip.lng)
          .input("dist",     sql.Int,          distM)
          .input("rid",      sql.Int,          trip.route_id)
          .query(`
            INSERT INTO geofence_events
              (trip_id, latitude, longitude, distance_m, route_id, status)
            VALUES (@tid, @lat, @lng, @dist, @rid, 'active')
          `);

        console.log(`[geofence] breach: ${trip.trip_ref} (${trip.vehicle}) — ${distM} m off-route`);

        // ── 3c. Broadcast over WebSocket ──────────────────────────────
        broadcastEvent("geofence_breach", {
          trip_ref:  trip.trip_ref,
          vehicle:   trip.vehicle,
          driver:    trip.driver,
          distance_m: distM,
          lat:       trip.lat,
          lng:       trip.lng,
          detected_at: new Date().toISOString(),
        });

        // ── 3d. Push alert to all admin users ─────────────────────────
        _pushToAdmins(pool, trip, distM);
      }

    } else {
      // ── 4. Back on route — resolve any open breach ──────────────────
      await pool.request()
        .input("tid", sql.Int, trip.trip_id)
        .query(`
          UPDATE geofence_events
          SET status = 'resolved', resolved_at = GETUTCDATE()
          WHERE trip_id = @tid AND status = 'active'
        `);
    }
  }
}

// ── Admin push alert ──────────────────────────────────────────────────────────

async function _pushToAdmins(pool, trip, distM) {
  try {
    const r = await pool.request().query(`
      SELECT push_token, fcm_token
      FROM users
      WHERE role IN ('admin','staff')
        AND (push_token IS NOT NULL OR fcm_token IS NOT NULL)
    `);

    const tokens = r.recordset.flatMap(u => [u.push_token, u.fcm_token].filter(Boolean));
    if (!tokens.length) return;

    await dispatchToTokens(
      tokens,
      "⚠️ Route Deviation",
      `${trip.trip_ref} (${trip.vehicle}) is ${distM} m off its planned route.`,
      { trip_ref: trip.trip_ref, vehicle: trip.vehicle, distance_m: String(distM) }
    );
  } catch (err) {
    console.warn("[geofence] push error:", err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the geofencing background loop.
 * Called once from app.js on startup.
 * Safe to call multiple times — subsequent calls are ignored.
 */
export function startGeofencingEngine() {
  if (_running) return;
  _running = true;

  const run = async () => {
    try { await _runCheck(); } catch (err) {
      console.warn("[geofence] cycle error:", err.message);
    }
  };

  run();  // immediate first check
  setInterval(run, CHECK_INTERVAL_MS);
  console.log(`[geofence] engine started — checking every ${CHECK_INTERVAL_MS / 1000}s`);
}

export { haversineM, distToPath, GEOFENCE_RADIUS_M };
