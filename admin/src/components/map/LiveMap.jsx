// src/components/map/LiveMap.jsx
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── status colours ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Ongoing:   '#10B981',
  Delayed:   '#F59E0B',
  Scheduled: '#64748B',
};

const ROUTE_COLOR = {
  'Route 12A': '#2563EB',
  'Route 7B':  '#10B981',
  'Route 3C':  '#7C3AED',
  'Route 5D':  '#EF4444',
  'Route 9E':  '#0891B2',
};

// ─── speed → colour for playback track ───────────────────────────────────────
function speedColor(speed) {
  if (speed < 15) return '#EF4444';   // stopped/very slow
  if (speed < 30) return '#F59E0B';   // slow
  if (speed < 50) return '#10B981';   // normal
  return '#3B82F6';                   // fast
}

// ─── signal-lost marker ───────────────────────────────────────────────────────
function makeSignalLostIcon(selected = false) {
  const size = selected ? 36 : 26;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#7C3AED;border:3px solid #fff;
      box-shadow:0 2px 10px rgba(124,58,237,.4),0 0 0 3px rgba(124,58,237,.2);
      display:flex;align-items:center;justify-content:center;
      font-size:${selected ? 15 : 11}px;opacity:0.75;
    ">📡</div>`,
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

// ─── bus marker icon ─────────────────────────────────────────────────────────
function makeBusIcon(status, selected, geofenced = false) {
  const color = STATUS_COLOR[status] || '#888';
  const size  = selected ? 36 : 26;
  const emoji = status === 'Scheduled' ? '🕐' : status === 'Delayed' ? '⚠️' : '🚌';

  const baseShadow = selected ? `, 0 0 0 3px ${color}88` : '';
  const geoRing    = geofenced ? ', 0 0 0 4px #EF4444' : '';

  return L.divIcon({
    html: `
      <div style="
        width:${size}px; height:${size}px;
        border-radius:50%;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 2px 10px rgba(0,0,0,.35)${baseShadow}${geoRing};
        display:flex; align-items:center; justify-content:center;
        font-size:${selected ? 16 : 12}px;
        cursor:pointer;
        transition:all .2s;
        ${geofenced ? 'animation:geofence-pulse 1.2s ease-out infinite;' : ''}
      ">${emoji}</div>
      <style>
        @keyframes geofence-pulse {
          0%   { box-shadow: 0 2px 10px rgba(0,0,0,.35)${baseShadow}, 0 0 0 4px #EF4444; }
          50%  { box-shadow: 0 2px 10px rgba(0,0,0,.35)${baseShadow}, 0 0 0 8px rgba(239,68,68,.3); }
          100% { box-shadow: 0 2px 10px rgba(0,0,0,.35)${baseShadow}, 0 0 0 4px #EF4444; }
        }
      </style>`,
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

// ─── playback bus marker ──────────────────────────────────────────────────────
const PLAYBACK_ICON = L.divIcon({
  html: `<div style="
    width:34px;height:34px;border-radius:50%;
    background:#8B5CF6;border:3px solid #fff;
    box-shadow:0 2px 12px rgba(139,92,246,.5),0 0 0 3px rgba(139,92,246,.3);
    display:flex;align-items:center;justify-content:center;font-size:16px;
  ">🚌</div>`,
  className: '',
  iconSize:    [34, 34],
  iconAnchor:  [17, 17],
  popupAnchor: [0, -20],
});

// ─── fly-to helpers ───────────────────────────────────────────────────────────
function FlyToSelected({ buses, selectedId }) {
  const map = useMap();
  const prevId = useRef(null);
  useEffect(() => {
    if (selectedId === prevId.current) return;
    prevId.current = selectedId;
    const bus = buses.find((b) => b.id === selectedId);
    if (bus) map.flyTo([bus.lat, bus.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [selectedId, buses, map]);
  return null;
}

function FlyToPlayback({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.3 });
  }, [pos, map]);
  return null;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function LiveMap({
  buses,
  routes,
  selectedId,
  onSelect,
  geofencedIds   = new Set(),
  signalLostIds  = new Set(),
  showHeatmap    = false,
  heatmapPoints  = [],
  // Journey Playback props
  playbackMode   = false,
  playbackTrack  = [],
  playbackPos    = null,
  playbackRoute  = null,
}) {
  const center = [33.88, 35.55];

  return (
    <MapContainer
      center={center}
      zoom={playbackMode ? 12 : 11}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      {/* ── Normal live-tracking mode ── */}
      {!playbackMode && <>
        {/* Route polylines */}
        {routes && routes.map((route) => (
          <Polyline
            key={route.name}
            positions={route.path}
            color={ROUTE_COLOR[route.name] || '#888'}
            weight={3}
            opacity={0.55}
            dashArray="6 4"
          />
        ))}

        {/* Heatmap overlay — pt is [lat, lng] or [lat, lng, intensity 0-1] */}
        {showHeatmap && heatmapPoints.map((pt, i) => {
          const lat       = Array.isArray(pt) ? pt[0] : pt.lat;
          const lng       = Array.isArray(pt) ? pt[1] : pt.lng;
          const intensity = Array.isArray(pt) ? (pt[2] ?? 0.5) : 0.5;
          const color     = intensity > 0.66 ? '#DC2626'
                          : intensity > 0.33 ? '#F59E0B'
                          :                    '#10B981';
          return (
            <CircleMarker
              key={`hm-${i}`}
              center={[lat, lng]}
              radius={7 + intensity * 13}
              pathOptions={{
                stroke:      false,
                fillColor:   color,
                fillOpacity: 0.06 + intensity * 0.28,
              }}
            />
          );
        })}

        {/* Bus markers */}
        {buses.map((bus) => (
          <Marker
            key={bus.id}
            position={[bus.lat, bus.lng]}
            icon={signalLostIds.has(bus.id)
              ? makeSignalLostIcon(bus.id === selectedId)
              : makeBusIcon(bus.status, bus.id === selectedId, geofencedIds.has(bus.id))
            }
            eventHandlers={{ click: () => onSelect(bus.id) }}
            zIndexOffset={bus.id === selectedId ? 1000 : 0}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#111' }}>
                  {bus.id} — {bus.route}
                </div>
                {signalLostIds.has(bus.id) && (
                  <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 6, padding: '4px 8px', marginBottom: 8, fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>
                    📡 GPS SIGNAL LOST — No updates received
                  </div>
                )}
                {geofencedIds.has(bus.id) && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', marginBottom: 8, fontSize: 11, color: '#DC2626', fontWeight: 700 }}>
                    ⚠️ GEOFENCE BREACH — Off route corridor
                  </div>
                )}
                {[
                  ['Driver',  bus.driver],
                  ['Vehicle', bus.vehicle],
                  ['Status',  bus.status],
                  ['Seats',   bus.seats],
                  ['Speed',   `${bus.speed} km/h`],
                  ['ETA',     bus.eta],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#888' }}>{k}</span>
                    <span style={{ fontWeight: 600, color: '#111' }}>{v}</span>
                  </div>
                ))}
              </div>
            </Popup>
          </Marker>
        ))}

        <FlyToSelected buses={buses} selectedId={selectedId} />
      </>}

      {/* ── Journey Playback mode ── */}
      {playbackMode && <>
        {/* Planned route corridor */}
        {playbackRoute && (
          <Polyline
            positions={playbackRoute.map(p => [p.lat ?? p[0], p.lng ?? p[1]])}
            color="#CBD5E1"
            weight={6}
            opacity={0.6}
            dashArray="8 4"
          />
        )}

        {/* GPS track coloured by speed — render as segments */}
        {playbackTrack.length > 1 && playbackTrack.slice(0, -1).map((pt, i) => {
          const next = playbackTrack[i + 1];
          const avgSpeed = (pt.speed + next.speed) / 2;
          return (
            <Polyline
              key={i}
              positions={[[pt.lat, pt.lng], [next.lat, next.lng]]}
              color={speedColor(avgSpeed)}
              weight={4}
              opacity={0.85}
            />
          );
        })}

        {/* Visited waypoints as small dots */}
        {playbackPos && playbackTrack.slice(0, playbackTrack.findIndex(p => p.lat === playbackPos.lat) + 1).filter((_, i) => i % 5 === 0).map((pt, i) => (
          <CircleMarker
            key={i}
            center={[pt.lat, pt.lng]}
            radius={3}
            pathOptions={{ color: speedColor(pt.speed), fillColor: speedColor(pt.speed), fillOpacity: 0.8, weight: 1 }}
          />
        ))}

        {/* Current playback position */}
        {playbackPos && (
          <Marker position={[playbackPos.lat, playbackPos.lng]} icon={PLAYBACK_ICON} zIndexOffset={2000}>
            <Popup>
              <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Journey Replay</div>
                <div>Speed: <strong>{playbackPos.speed} km/h</strong></div>
                <div>Time: <strong>{playbackPos.timeLabel}</strong></div>
              </div>
            </Popup>
          </Marker>
        )}

        {playbackPos && <FlyToPlayback pos={playbackPos} />}
      </>}
    </MapContainer>
  );
}
