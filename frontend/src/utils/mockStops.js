// Beirut-area mock bus stops used in frontend-only mode.
// Matches the shape returned by GET /api/stops.
export const MOCK_STOPS = [
  { stop_id: 1,  stop_name: 'Hamra Circle',       latitude: 33.8938, longitude: 35.4824, routes: ['A', 'B', 'D'] },
  { stop_id: 2,  stop_name: 'Corniche Manara',     latitude: 33.8881, longitude: 35.4753, routes: ['B', 'C']      },
  { stop_id: 3,  stop_name: 'Cola Hub',            latitude: 33.8777, longitude: 35.4921, routes: ['A', 'E', 'F'] },
  { stop_id: 4,  stop_name: 'Dora Intersection',   latitude: 33.9117, longitude: 35.5583, routes: ['D', 'G']      },
  { stop_id: 5,  stop_name: 'Zouk Mikael',         latitude: 33.9736, longitude: 35.6266, routes: ['G', 'H']      },
  { stop_id: 6,  stop_name: 'Achrafieh Sassine',   latitude: 33.8837, longitude: 35.5123, routes: ['C', 'F']      },
  { stop_id: 7,  stop_name: 'Mar Mikhael',         latitude: 33.8902, longitude: 35.5142, routes: ['A', 'C']      },
  { stop_id: 8,  stop_name: 'Verdun Square',       latitude: 33.8849, longitude: 35.4905, routes: ['B', 'E']      },
  { stop_id: 9,  stop_name: 'Jdeideh Terminal',    latitude: 33.8975, longitude: 35.5608, routes: ['D', 'H']      },
  { stop_id: 10, stop_name: 'Airport Road Hub',    latitude: 33.8204, longitude: 35.4931, routes: ['E', 'F', 'G'] },
  { stop_id: 11, stop_name: 'Raouché Rocks',       latitude: 33.8879, longitude: 35.4712, routes: ['C', 'D']      },
  { stop_id: 12, stop_name: 'Antelias Square',     latitude: 33.9018, longitude: 35.5795, routes: ['D', 'G', 'H'] },
];

// Haversine distance in kilometres
export const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Walking time in minutes (5 km/h ≈ 12 min/km)
export const walkTimeMin = (distKm) => Math.max(1, Math.ceil(distKm * 12));

// Format a distance for display
export const formatDist = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

// Attach distance + walkTime to each stop relative to a position
export const stopsWithDistance = (stops, lat, lon) =>
  stops
    .filter((s) => s.latitude && s.longitude)
    .map((s) => ({
      ...s,
      distKm:   haversineKm(lat, lon, Number(s.latitude), Number(s.longitude)),
      walkMins: walkTimeMin(haversineKm(lat, lon, Number(s.latitude), Number(s.longitude))),
    }))
    .sort((a, b) => a.distKm - b.distKm);
