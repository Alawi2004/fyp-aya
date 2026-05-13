// OSRM public routing server — real road distances & durations
// Falls back to haversine estimation when OSRM is unavailable

const OSRM_BASE = 'http://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 20 * 60 * 60 * 1000; // 20 h — road networks are stable

const routeCache = new Map();

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Haversine fallback using road-factor × urban bus average speed
function fallbackRoute(from, to) {
  const roadDist = haversineMeters(from, to) * 1.38; // straight-line → road distance
  const speedMs = (22 * 1000) / 3600;                // 22 km/h urban bus
  return {
    distance_m: Math.round(roadDist),
    duration_s: Math.round(roadDist / speedMs),
    duration_min: roadDist / speedMs / 60,
    source: 'fallback',
  };
}

function pairKey(from, to) {
  return (
    `${from.latitude.toFixed(4)},${from.longitude.toFixed(4)}` +
    `;${to.latitude.toFixed(4)},${to.longitude.toFixed(4)}`
  );
}

// Single origin → destination road time (cached)
export async function getSegmentDuration(from, to) {
  const key = pairKey(from, to);
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  try {
    const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const url = `${OSRM_BASE}/${coords}?overview=false&annotations=false`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.code !== 'Ok' || !json.routes?.length) throw new Error('No OSRM route');

    const r = json.routes[0];
    const data = {
      distance_m: Math.round(r.distance),
      duration_s: Math.round(r.duration),
      duration_min: r.duration / 60,
      source: 'osrm',
    };
    routeCache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return fallbackRoute(from, to);
  }
}

// Cumulative ETAs from a current GPS position to each remaining stop
// Single OSRM multi-waypoint request for efficiency
export async function getEtasFromPosition(currentPos, stops) {
  if (!stops.length) return [];

  const waypoints = [currentPos, ...stops]
    .map((p) => `${p.longitude},${p.latitude}`)
    .join(';');

  try {
    const url = `${OSRM_BASE}/${waypoints}?overview=false&annotations=false`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.code !== 'Ok' || !json.routes?.length) throw new Error('No OSRM route');

    const legs = json.routes[0].legs;
    let cumDist = 0;
    let cumDur = 0;
    return stops.map((stop, i) => {
      cumDist += legs[i].distance;
      cumDur += legs[i].duration;
      return {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        cumulative_min: cumDur / 60,
        cumulative_distance_m: Math.round(cumDist),
        source: 'osrm',
      };
    });
  } catch {
    // Fallback: sequential haversine from current position
    let cumDist = 0;
    let cumDur = 0;
    let prev = currentPos;
    return stops.map((stop) => {
      const seg = fallbackRoute(prev, stop);
      cumDist += seg.distance_m;
      cumDur += seg.duration_min;
      prev = stop;
      return {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        cumulative_min: cumDur,
        cumulative_distance_m: Math.round(cumDist),
        source: 'fallback',
      };
    });
  }
}

// Per-segment road data for sequential stops (used in route planner enrichment)
export async function getRouteSegments(stops) {
  return Promise.all(
    stops.slice(0, -1).map((stop, i) =>
      getSegmentDuration(stop, stops[i + 1]).then((d) => ({
        from_stop_id: stop.stop_id,
        to_stop_id: stops[i + 1].stop_id,
        ...d,
      }))
    )
  );
}
