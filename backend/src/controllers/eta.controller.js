import { poolPromise, sql } from '../db/db.js';
import {
  getTrafficMultiplier,
  getTrafficCondition,
  getBestDepartureWindows,
  getDayForecast,
  formatDelayDescription,
} from '../modules/eta/trafficModel.js';
import { getEtasFromPosition } from '../modules/eta/osrmClient.js';
import { getHistoricalStats, getRouteHourlyProfile } from '../modules/eta/historicalAnalyzer.js';

const haversineMeters = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Weighted blend of traffic-model ETA and historical ETA
function blendEta(trafficAdjustedMin, historicalStats, segmentRatio) {
  if (!historicalStats || historicalStats.confidence < 0.25) return trafficAdjustedMin;
  const historicalSegMin = historicalStats.avg_min * segmentRatio;
  const w = historicalStats.confidence * 0.40; // max 40% weight on historical
  return trafficAdjustedMin * (1 - w) + historicalSegMin * w;
}

// GET /api/trips/:id/eta-predictions
export const getTripEtaPredictions = async (req, res) => {
  try {
    const tripId = Number(req.params.id);
    if (!tripId) return res.status(400).json({ error: 'Invalid trip ID' });

    const pool = await poolPromise;
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });

    // --- 1. Fetch trip + route metadata ---
    const tripResult = await pool
      .request()
      .input('trip_id', sql.Int, tripId)
      .query(`
        SELECT t.trip_id, t.route_id, t.start_time, t.status,
               r.route_name, r.start_location, r.end_location
        FROM   trips t
        JOIN   routes r ON r.route_id = t.route_id
        WHERE  t.trip_id = @trip_id
      `);

    if (!tripResult.recordset.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const trip = tripResult.recordset[0];

    // --- 2. Fetch ordered route stops ---
    const stopsResult = await pool
      .request()
      .input('route_id', sql.Int, trip.route_id)
      .query(`
        SELECT rs.stop_order,
               s.stop_id,
               s.stop_name,
               CAST(s.latitude  AS FLOAT) AS latitude,
               CAST(s.longitude AS FLOAT) AS longitude
        FROM   route_stops rs
        JOIN   stops s ON s.stop_id = rs.stop_id
        WHERE  rs.route_id = @route_id
        ORDER  BY rs.stop_order
      `);

    const allStops = stopsResult.recordset;
    if (!allStops.length) return res.status(404).json({ error: 'No stops for this route' });

    // --- 3. Most recent GPS position ---
    const gpsResult = await pool
      .request()
      .input('trip_id', sql.Int, tripId)
      .query(`
        SELECT TOP 1
               CAST(latitude  AS FLOAT) AS latitude,
               CAST(longitude AS FLOAT) AS longitude,
               recorded_at
        FROM   gps_logs
        WHERE  trip_id = @trip_id
        ORDER  BY recorded_at DESC
      `);

    const gpsLog = gpsResult.recordset[0] || null;
    const now = new Date();

    // --- 4. Determine current position ---
    const currentPos = gpsLog
      ? { latitude: gpsLog.latitude, longitude: gpsLog.longitude }
      : { latitude: allStops[0].latitude, longitude: allStops[0].longitude };

    // --- 5. Find nearest stop to establish progress on route ---
    let currentStopIdx = 0;
    if (gpsLog) {
      let minDist = Infinity;
      allStops.forEach((stop, i) => {
        const d = haversineMeters(currentPos, stop);
        if (d < minDist) { minDist = d; currentStopIdx = i; }
      });
    }

    const remainingStops = allStops.slice(currentStopIdx);

    // --- 6. Traffic model ---
    const trafficMult = getTrafficMultiplier(now);
    const trafficCond = getTrafficCondition(trafficMult);

    // --- 7. OSRM road ETAs (single multi-waypoint request) ---
    const osrmEtas = await getEtasFromPosition(currentPos, remainingStops);

    // --- 8. Historical stats for blending ---
    const historical = await getHistoricalStats(pool, trip.route_id, now.getHours(), now.getDay()).catch(() => null);
    const totalOsrmMin = osrmEtas.at(-1)?.cumulative_min || 1;

    // --- 9. Build per-stop ETA list ---
    const stops = osrmEtas.map((eta, i) => {
      const baseMin = eta.cumulative_min;
      const trafficMin = baseMin * trafficMult;

      // Segment ratio: proportion of total route this stop represents
      const segRatio = totalOsrmMin > 0 ? baseMin / totalOsrmMin : 1;
      const blended = blendEta(trafficMin, historical, segRatio);
      const finalMin = Math.max(0.5, blended);

      const etaTime = new Date(now.getTime() + finalMin * 60 * 1000);
      const stop = remainingStops[i];

      return {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        stop_order: stop.stop_order,
        status: i === 0 ? 'next' : 'upcoming',
        eta_min: Math.round(finalMin * 10) / 10,
        eta_min_base: Math.round(baseMin * 10) / 10,      // OSRM no-traffic baseline
        eta_time: etaTime.toTimeString().slice(0, 5),      // "HH:MM"
        eta_iso: etaTime.toISOString(),
        distance_m: eta.cumulative_distance_m,
        data_source: eta.source,
      };
    });

    const dataConfidence = osrmEtas.every((e) => e.source === 'osrm') ? 0.92 : 0.72;

    return res.json({
      trip_id: tripId,
      route_id: trip.route_id,
      route_name: trip.route_name,
      trip_status: trip.status,
      current_position: currentPos,
      last_gps_update: gpsLog?.recorded_at || null,
      gps_age_seconds: gpsLog
        ? Math.round((now - new Date(gpsLog.recorded_at)) / 1000)
        : null,
      current_stop_index: currentStopIdx,
      traffic: {
        multiplier: trafficMult,
        delay_description: formatDelayDescription(trafficMult),
        ...trafficCond,
      },
      stops,
      confidence: dataConfidence,
      historical_samples: historical?.samples ?? 0,
      best_departure_windows: getBestDepartureWindows(now),
      generated_at: now.toISOString(),
    });
  } catch (err) {
    console.error('ETA prediction error:', err);
    return res.status(500).json({ error: 'Failed to compute ETA predictions' });
  }
};

// GET /api/routes/traffic-forecast?day=&hour=&route_id=
export const getTrafficForecast = async (req, res) => {
  try {
    const now = new Date();
    const day = req.query.day !== undefined ? Number(req.query.day) : now.getDay();
    const hour = req.query.hour !== undefined ? Number(req.query.hour) : now.getHours();
    const routeId = req.query.route_id ? Number(req.query.route_id) : null;

    const targetDate = new Date(
      now.getFullYear(), now.getMonth(),
      now.getDate() + ((day - now.getDay() + 7) % 7),
      hour
    );
    const mult = getTrafficMultiplier(targetDate);
    const condition = getTrafficCondition(mult);

    const pool = await poolPromise;
    const [historical, hourlyProfile] = await Promise.all([
      pool && routeId
        ? getHistoricalStats(pool, routeId, hour, day).catch(() => null)
        : Promise.resolve(null),
      pool && routeId
        ? getRouteHourlyProfile(pool, routeId).catch(() => [])
        : Promise.resolve([]),
    ]);

    return res.json({
      hour,
      day_of_week: day,
      traffic_multiplier: mult,
      delay_description: formatDelayDescription(mult),
      condition,
      day_forecast: getDayForecast(day),
      best_departure_windows: getBestDepartureWindows(targetDate),
      historical_for_hour: historical,
      route_hourly_profile: hourlyProfile,
    });
  } catch (err) {
    console.error('Traffic forecast error:', err);
    return res.status(500).json({ error: 'Failed to get traffic forecast' });
  }
};
