import { poolPromise, sql } from '../db/db.js';
import { findMultiTripRoutes } from '../modules/routing/multiTripRouter.js';
import {
  getTrafficMultiplier,
  getTrafficCondition,
  getBestDepartureWindows,
  formatDelayDescription,
} from '../modules/eta/trafficModel.js';
import { getSegmentDuration } from '../modules/eta/hereClient.js';

const SUPPORTED_MODES = new Set(['fastest', 'easiest', 'cheapest']);

// Returns route+stop+trip data; departure_time scopes which trip is matched per route.
// Routes with no running trip in the ±2 h / +6 h window get trip_id = NULL (still
// routable, just not bookable until a schedule is published for that time slot).
const buildRouteDataQuery = () => `
  SELECT
    r.*,
    rs.stop_id,
    rs.stop_order,
    s.stop_name,
    s.latitude,
    s.longitude,
    vehicle_pick.vehicle_type,
    vehicle_pick.trip_id
  FROM routes r
  JOIN route_stops rs ON r.route_id = rs.route_id
  JOIN stops s ON rs.stop_id = s.stop_id
  OUTER APPLY (
    SELECT TOP 1 v.vehicle_type, t.trip_id
    FROM trips t
    JOIN vehicles v ON t.vehicle_id = v.vehicle_id
    WHERE t.route_id = r.route_id
      AND ISNULL(t.status, 'scheduled') <> 'cancelled'
      AND t.start_time >= DATEADD(hour, -2, @dep_time)
      AND t.start_time <= DATEADD(hour,  6, @dep_time)
    ORDER BY
      CASE WHEN t.status = 'ongoing'   THEN 0
           WHEN t.status = 'scheduled' THEN 1
           ELSE 2 END,
      ABS(DATEDIFF(minute, t.start_time, @dep_time))
  ) vehicle_pick
  ORDER BY r.route_id, rs.stop_order;
`;

// Build stop coordinate lookup from route data rows
function buildStopMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = Number(row.stop_id);
    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (id && Number.isFinite(lat) && Number.isFinite(lon)) {
      map.set(id, { stop_id: id, latitude: lat, longitude: lon });
    }
  }
  return map;
}

// Enrich a journey's segments with real road distances and traffic-adjusted times.
// Mutates nothing — returns a new journey object.
async function enrichWithTraffic(journey, stopMap, departureDate) {
  const trafficMult = getTrafficMultiplier(departureDate);
  const trafficCond = getTrafficCondition(trafficMult);

  const enrichedSegments = await Promise.all(
    journey.segments.map(async (segment) => {
      // Walking segments: traffic doesn't affect pedestrians
      if (segment.type === 'walk') {
        return {
          ...segment,
          traffic_adjusted_min: segment.estimated_time_min,
        };
      }

      const fromStop = stopMap.get(segment.from_stop_id);
      const toStop = stopMap.get(segment.to_stop_id);

      // No coordinates available — apply multiplier to existing estimate
      if (!fromStop || !toStop) {
        return {
          ...segment,
          traffic_adjusted_min: Math.max(1, Math.ceil(segment.estimated_time_min * trafficMult)),
        };
      }

      const seg = await getSegmentDuration(fromStop, toStop);
      const baseMin = Math.max(1, seg.duration_min);
      // HERE already embeds live traffic — skip static multiplier to avoid double-counting
      const adjustedMin = seg.traffic_included ? baseMin : Math.max(1, baseMin * trafficMult);

      return {
        ...segment,
        estimated_time_min: Math.ceil(baseMin),
        traffic_adjusted_min: Math.ceil(adjustedMin),
        road_distance_m: seg.distance_m,
        data_source: seg.source,
      };
    })
  );

  // Recalculate totals using traffic-adjusted times
  const totalBase = enrichedSegments.reduce(
    (s, seg) => s + (seg.estimated_time_min || 0) + (seg.transfer_from_previous_min || 0),
    0
  );
  const totalAdjusted = enrichedSegments.reduce(
    (s, seg) =>
      s +
      (seg.traffic_adjusted_min ?? seg.estimated_time_min ?? 0) +
      (seg.transfer_from_previous_min || 0),
    0
  );

  return {
    ...journey,
    total_duration_min: Math.ceil(totalBase),
    traffic_adjusted_duration_min: Math.ceil(totalAdjusted),
    traffic_multiplier: trafficMult,
    traffic_condition: trafficCond,
    delay_description: formatDelayDescription(trafficMult),
    departure_time: departureDate.toISOString(),
    best_departure_windows: getBestDepartureWindows(departureDate),
    segments: enrichedSegments,
  };
}

export const getMultiTripRoute = async (req, res) => {
  try {
    const { start_id, end_id, mode = 'fastest', alternatives, departure_time } = req.query;
    const rankingMode = String(mode).toLowerCase();

    if (!start_id || !end_id) {
      return res.status(400).json({ error: 'start_id and end_id are required.' });
    }

    if (!SUPPORTED_MODES.has(rankingMode)) {
      return res
        .status(400)
        .json({ error: 'Unsupported mode. Use fastest, easiest, or cheapest.' });
    }

    // Parse departure time early — used for both trip matching and traffic enrichment
    const depDate = departure_time ? new Date(departure_time) : new Date();
    if (isNaN(depDate.getTime())) {
      return res.status(400).json({ error: 'Invalid departure_time format. Use ISO 8601.' });
    }

    const pool = await poolPromise;
    const exists = await pool
      .request()
      .input('start_id', sql.Int, start_id)
      .input('end_id', sql.Int, end_id)
      .query(`SELECT stop_id FROM stops WHERE stop_id IN (@start_id, @end_id);`);

    if (exists.recordset.length < 2 && Number(start_id) !== Number(end_id)) {
      return res.status(404).json({ error: 'One or both stops were not found.' });
    }

    // Fetch route+stop data with trip_id scoped to the requested departure window
    const routeData = await pool
      .request()
      .input('dep_time', sql.DateTime, depDate)
      .query(buildRouteDataQuery());

    const stopMap = buildStopMap(routeData.recordset);

    const result = findMultiTripRoutes(routeData.recordset, start_id, end_id, rankingMode, {
      includeAlternatives: alternatives === 'true' || alternatives === '1',
    });

    if (!result.primary) {
      return res.status(404).json({
        route_type: 'unavailable',
        mode: rankingMode,
        message: result.reason || 'No route found.',
        alternatives: [],
      });
    }

    const [primary, ...altEnriched] = await Promise.all([
      enrichWithTraffic(result.primary, stopMap, depDate),
      ...result.alternatives.map((j) => enrichWithTraffic(j, stopMap, depDate)),
    ]);

    return res.json({
      ...primary,
      alternatives: altEnriched,
      direct_available: result.direct_available,
    });
  } catch (err) {
    console.error('Multi-trip routing error:', err);
    return res.status(500).json({
      error: 'Failed to calculate multi-step route.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
