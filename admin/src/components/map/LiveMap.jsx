// src/components/map/LiveMap.jsx
// Real Leaflet map with per-bus markers and route polylines
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// ─── build a div-icon for each bus ───────────────────────────────────────────
function makeBusIcon(status, selected) {
  const color = STATUS_COLOR[status] || '#888';
  const size  = selected ? 36 : 26;
  const emoji = status === 'Scheduled' ? '🕐' : status === 'Delayed' ? '⚠️' : '🚌';
  return L.divIcon({
    html: `
      <div style="
        width:${size}px; height:${size}px;
        border-radius:50%;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 2px 10px rgba(0,0,0,.35)${selected ? `,0 0 0 3px ${color}88` : ''};
        display:flex; align-items:center; justify-content:center;
        font-size:${selected ? 16 : 12}px;
        cursor:pointer;
        transition:all .2s;
      ">${emoji}</div>`,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

// ─── helper: fly to selected bus on change ────────────────────────────────────
function FlyToSelected({ buses, selectedId }) {
  const map = useMap();
  useEffect(() => {
    const bus = buses.find((b) => b.id === selectedId);
    if (bus) {
      map.flyTo([bus.lat, bus.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  return null;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function LiveMap({ buses, routes, selectedId, onSelect }) {
  // Lebanon center
  const center = [33.88, 35.55];

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={true}
    >
      {/* OpenStreetMap tiles — no API key needed */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

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

      {/* Bus markers */}
      {buses.map((bus) => (
        <Marker
          key={bus.id}
          position={[bus.lat, bus.lng]}
          icon={makeBusIcon(bus.status, bus.id === selectedId)}
          eventHandlers={{ click: () => onSelect(bus.id) }}
          zIndexOffset={bus.id === selectedId ? 1000 : 0}
        >
          <Popup>
            <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#111' }}>
                {bus.id} — {bus.route}
              </div>
              {[
                ['Driver',  bus.driver],
                ['Vehicle', bus.vehicle],
                ['Status',  bus.status],
                ['Seats',   bus.seats],
                ['Speed',   `${bus.speed} km/h`],
                ['ETA',     bus.eta],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                                       fontSize: 12, padding: '2px 0',
                                       borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#111' }}>{v}</span>
                </div>
              ))}
            </div>
          </Popup>
        </Marker>
      ))}

      <FlyToSelected buses={buses} selectedId={selectedId} />
    </MapContainer>
  );
}
