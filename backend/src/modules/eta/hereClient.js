// HERE Routing API v8 — real road distances + live traffic for Lebanon
// Drop-in replacement for osrmClient.js — same exported function signatures.
//
// Free tier: 250,000 requests/month  →  developer.here.com → "Freemium"
// Set HERE_API_KEY in backend/.env to activate.
// Falls back to haversine (1.38× road factor, 22 km/h bus speed) when key
// is missing or HERE is unreachable.

const HERE_BASE         = 'https://router.hereapi.com/v8/routes';
const HERE_TIMEOUT_MS   = 8000;
const SEGMENT_CACHE_TTL = 20 * 60 * 60 * 1000; // 20 h — road geometry is stable
const TRAFFIC_CACHE_TTL =  5 * 60 * 1000;        //  5 min — traffic changes

const segCache = new Map(); // stop→stop fixed segments  (long TTL)
const etaCache = new Map(); // currentPos→stops in-trip  (short TTL)

// ── Haversine fallback ────────────────────────────────────────────────────────
function haversineMeters(a, b) {
  const R    = 6371000;
  const toR  = d => (d * Math.PI) / 180;
  const dLat = toR(b.latitude  - a.latitude);
  const dLon = toR(b.longitude - a.longitude);
  const h    = Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.latitude)) * Math.cos(toR(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fallbackRoute(from, to) {
  const roadDist = haversineMeters(from, to) * 1.38;
  const speedMs  = (22 * 1000) / 3600;
  const durMin   = roadDist / speedMs / 60;
  return {
    distance_m:       Math.round(roadDist),
    duration_s:       Math.round(roadDist / speedMs),
    duration_min:     durMin,
    typical_min:      durMin, // no separate no-traffic estimate in fallback
    traffic_included: false,
    source:           'fallback',
  };
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
// 3-decimal precision ≈ 111 m — stationary bus reuses cached result
function cacheKey(points) {
  return points.map(p => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join(';');
}

// ── HERE API core ─────────────────────────────────────────────────────────────
// Returns the sections array from the first route, or throws.
async function callHere(origin, viaPoints, destination) {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) throw new Error('HERE_API_KEY not configured');

  // HERE uses lat,lng order (unlike OSRM which uses lng,lat)
  const params = new URLSearchParams({
    transportMode: 'car',
    origin:        `${origin.latitude},${origin.longitude}`,
    destination:   `${destination.latitude},${destination.longitude}`,
    return:        'summary',
    departureTime: new Date().toISOString(), // current time → enables real-time traffic (HERE v8 rejects literal 'now')
    apiKey,
  });
  for (const p of viaPoints) {
    params.append('via', `${p.latitude},${p.longitude}`);
  }

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HERE_TIMEOUT_MS);
  try {
    const resp = await fetch(`${HERE_BASE}?${params}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HERE HTTP ${resp.status}`);
    const json = await resp.json();
    const sections = json.routes?.[0]?.sections;
    if (!Array.isArray(sections) || !sections.length) throw new Error('No HERE route');
    return sections;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Single origin → destination road time (cached 20 h — stop coords don't move)
export async function getSegmentDuration(from, to) {
  const key = cacheKey([from, to]);
  const hit = segCache.get(key);
  if (hit && Date.now() - hit.ts < SEGMENT_CACHE_TTL) return hit.data;

  try {
    const sections = await callHere(from, [], to);
    const s    = sections[0].summary;
    const data = {
      distance_m:       s.length,
      duration_s:       s.duration,
      duration_min:     s.duration / 60,
      typical_min:      (s.typicalDuration ?? s.duration) / 60,
      traffic_included: true,
      source:           'here',
    };
    segCache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return fallbackRoute(from, to);
  }
}

// Cumulative traffic-aware ETAs from the bus's current GPS position to each
// remaining stop.  Single HERE multi-waypoint request for efficiency.
// Cache TTL is 5 min; 3-decimal key means moves <111 m reuse the cache.
export async function getEtasFromPosition(currentPos, stops) {
  if (!stops.length) return [];

  const key = cacheKey([currentPos, ...stops]);
  const hit = etaCache.get(key);
  if (hit && Date.now() - hit.ts < TRAFFIC_CACHE_TTL) return hit.data;

  const destination = stops[stops.length - 1];
  const viaPoints   = stops.slice(0, -1);

  try {
    const sections = await callHere(currentPos, viaPoints, destination);
    if (sections.length !== stops.length) throw new Error('section count mismatch');

    let cumDist = 0, cumDur = 0, cumTypical = 0;
    const result = stops.map((stop, i) => {
      const s     = sections[i].summary;
      cumDist    += s.length;
      cumDur     += s.duration;
      cumTypical += (s.typicalDuration ?? s.duration);
      return {
        stop_id:                  stop.stop_id,
        stop_name:                stop.stop_name,
        cumulative_min:           cumDur     / 60, // traffic-adjusted (live)
        cumulative_min_typical:   cumTypical / 60, // without traffic (baseline)
        cumulative_distance_m:    Math.round(cumDist),
        traffic_included:         true,
        source:                   'here',
      };
    });

    etaCache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch {
    // Fallback: sequential haversine from current position
    let cumDist = 0, cumDur = 0;
    let prev = currentPos;
    return stops.map(stop => {
      const seg = fallbackRoute(prev, stop);
      cumDist  += seg.distance_m;
      cumDur   += seg.duration_min;
      prev      = stop;
      return {
        stop_id:                stop.stop_id,
        stop_name:              stop.stop_name,
        cumulative_min:         cumDur,
        cumulative_min_typical: cumDur,
        cumulative_distance_m:  Math.round(cumDist),
        traffic_included:       false,
        source:                 'fallback',
      };
    });
  }
}

// Per-segment road data for sequential fixed stops (route planner enrichment)
export async function getRouteSegments(stops) {
  return Promise.all(
    stops.slice(0, -1).map((stop, i) =>
      getSegmentDuration(stop, stops[i + 1]).then(d => ({
        from_stop_id: stop.stop_id,
        to_stop_id:   stops[i + 1].stop_id,
        ...d,
      }))
    )
  );
}
