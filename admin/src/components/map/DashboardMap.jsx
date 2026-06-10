// src/components/map/DashboardMap.jsx
// Compact Leaflet map for the dashboard overview widget
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_COLOR = {
  Ongoing:   '#10B981',
  Delayed:   '#F59E0B',
  Scheduled: '#64748B',
  Alert:     '#EF4444',
};

// Compact circle icon (no emoji, just a dot with ring)
function makeDot(color, selected) {
  const size = selected ? 18 : 12;
  return L.divIcon({
    html: `<div style="
      width:${size}px; height:${size}px;
      border-radius:50%;
      background:${color};
      border:2px solid #fff;
      box-shadow:0 1px 5px rgba(0,0,0,.35)${selected ? `,0 0 0 3px ${color}55` : ''};
    "></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2 + 2, 0],
  });
}

// Bus data shown on the dashboard map
const DASH_BUSES = [
  { id: 'TRP-041',  lat: 33.9450, lng: 35.5620, status: 'Ongoing',   label: 'Route 12A' },
  { id: 'TRP-038',  lat: 34.0300, lng: 35.6350, status: 'Delayed',   label: 'Route 7B'  },
  { id: 'TRP-029',  lat: 33.8650, lng: 35.7200, status: 'Ongoing',   label: 'Route 3C'  },
  { id: 'TRP-033',  lat: 33.8938, lng: 35.5018, status: 'Scheduled', label: 'Route 5D'  },
  { id: 'TRP-045',  lat: 34.1800, lng: 35.6530, status: 'Ongoing',   label: 'Route 9E'  },
  { id: 'TRP-041B', lat: 33.9806, lng: 35.6178, status: 'Ongoing',   label: 'Route 12A' },
  { id: 'TRP-047',  lat: 33.8510, lng: 35.8700, status: 'Delayed',   label: 'Route 3C'  },
  { id: 'TRP-050',  lat: 33.9280, lng: 35.5340, status: 'Alert',     label: 'Route 7B'  },
];

// Disable default zoom animation so small map renders cleanly
function MapInit() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function DashboardMap({ onFullScreen }) {
  return (
    <div style={{ position: 'relative', height: 170, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[33.95, 35.60]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {DASH_BUSES.map((bus) => (
          <Marker
            key={bus.id}
            position={[bus.lat, bus.lng]}
            icon={makeDot(STATUS_COLOR[bus.status] || '#888', bus.status === 'Alert')}
          >
            <Tooltip direction="right" offset={[6, 0]} permanent={false}>
              <span style={{ fontSize: 11 }}>{bus.id} · {bus.label}</span>
            </Tooltip>
          </Marker>
        ))}

        <MapInit />
      </MapContainer>

      {/* Overlay legend */}
      <div style={{
        position: 'absolute', bottom: 7, left: 8, zIndex: 1000,
        display: 'flex', gap: 6,
      }}>
        {[['#10B981', 'Normal'], ['#F59E0B', 'Delayed'], ['#EF4444', 'Alert']].map(([c, l]) => (
          <span key={l} style={{
            fontSize: 9, color: '#444', background: 'rgba(255,255,255,.9)',
            padding: '2px 7px', borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />
            {l}
          </span>
        ))}
      </div>

      {/* Vehicle count badge */}
      <div style={{
        position: 'absolute', top: 7, right: 8, zIndex: 1000,
        fontSize: 9, color: '#444', background: 'rgba(255,255,255,.9)',
        padding: '2px 8px', borderRadius: 8,
      }}>
        {DASH_BUSES.length} vehicles active
      </div>

      {/* Full-screen button */}
      {onFullScreen && (
        <button
          onClick={onFullScreen}
          title="Open full-screen live map"
          style={{
            position: 'absolute', top: 7, left: 8, zIndex: 1000,
            background: 'rgba(255,255,255,.92)', border: '1px solid #ddd',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 11, fontWeight: 600, color: '#2563EB',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ↗ Full screen
        </button>
      )}
    </div>
  );
}
