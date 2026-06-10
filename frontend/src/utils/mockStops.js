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
