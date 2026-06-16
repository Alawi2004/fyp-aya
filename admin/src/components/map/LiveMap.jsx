// src/components/map/LiveMap.jsx
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Inject pulse keyframes once (shared with DashboardMap) ───────────────────
const STYLE_ID = '__dm_pulse__';
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes dm-pulse {
      0%   { transform:scale(.7); opacity:.85; }
      70%  { transform:scale(1.8); opacity:0; }
      100% { transform:scale(1.8); opacity:0; }
    }
  `;
  document.head.appendChild(s);
}

// ─── status colours ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Ongoing:   '#10B981',
  Delayed:   '#F59E0B',
  Scheduled: '#2563EB',
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
  if (speed < 15) return '#EF4444';
  if (speed < 30) return '#F59E0B';
  if (speed < 50) return '#10B981';
  return '#3B82F6';
}

// ─── pulsing bus marker (matching DashboardMap / DriverMapScreen style) ──────
function makeBusIcon(status, selected, geofenced = false) {
  const color      = geofenced ? '#EF4444' : (STATUS_COLOR[status] ?? '#64748B');
  const core       = selected ? 34 : 26;
  const wrap       = core + 20;
  const iconSize   = selected ? 15 : 12;
  const animDur    = geofenced ? '1.0s' : selected ? '1.4s' : '2s';

  return L.divIcon({
    html: `
      <div style="
        position:relative;
        width:${wrap}px;height:${wrap}px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;
          width:${wrap}px;height:${wrap}px;border-radius:50%;
          background:${color}33;
          animation:dm-pulse ${animDur} ease-out infinite;
        "></div>
        <div style="
          position:relative;z-index:1;
          width:${core}px;height:${core}px;border-radius:50%;
          background:${color};border:2.5px solid #fff;
          box-shadow:0 3px 10px ${color}66, 0 1px 4px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"
               fill="none" stroke="white" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 3v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
            <line x1="1" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="3" x2="8" y2="12"/>
          </svg>
        </div>
      </div>`,
    className: '',
    iconSize:    [wrap, wrap],
    iconAnchor:  [wrap / 2, wrap / 2],
    popupAnchor: [0, -(wrap / 2) - 4],
  });
}

// ─── signal-lost marker ───────────────────────────────────────────────────────
function makeSignalLostIcon(selected = false) {
  const core = selected ? 34 : 26;
  const wrap = core + 20;
  return L.divIcon({
    html: `
      <div style="
        position:relative;
        width:${wrap}px;height:${wrap}px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;
          width:${wrap}px;height:${wrap}px;border-radius:50%;
          background:#7C3AED33;
          animation:dm-pulse 1.6s ease-out infinite;
        "></div>
        <div style="
          position:relative;z-index:1;
          width:${core}px;height:${core}px;border-radius:50%;
          background:#7C3AED;border:2.5px solid #fff;
          box-shadow:0 3px 10px #7C3AED66, 0 1px 4px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
          font-size:${selected ? 14 : 10}px;
        ">📡</div>
      </div>`,
    className: '',
    iconSize:    [wrap, wrap],
    iconAnchor:  [wrap / 2, wrap / 2],
    popupAnchor: [0, -(wrap / 2) - 4],
  });
}

// ─── playback position marker ────────────────────────────────────────────────
function makePlaybackIcon() {
  const core = 32, wrap = core + 20;
  return L.divIcon({
    html: `
      <div style="
        position:relative;
        width:${wrap}px;height:${wrap}px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;
          width:${wrap}px;height:${wrap}px;border-radius:50%;
          background:#8B5CF633;
          animation:dm-pulse 1.4s ease-out infinite;
        "></div>
        <div style="
          position:relative;z-index:1;
          width:${core}px;height:${core}px;border-radius:50%;
          background:#8B5CF6;border:2.5px solid #fff;
          box-shadow:0 3px 10px #8B5CF666, 0 1px 4px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
        ">🚌</div>
      </div>`,
    className: '',
    iconSize:    [wrap, wrap],
    iconAnchor:  [wrap / 2, wrap / 2],
    popupAnchor: [0, -(wrap / 2) - 4],
  });
}

const PLAYBACK_ICON = makePlaybackIcon();

// ─── fly-to helpers ───────────────────────────────────────────────────────────
function FlyToSelected({ buses, selectedId }) {
  const map = useMap();
  const prevId = useRef(null);
  useEffect(() => {
    if (selectedId === prevId.current) return;
    prevId.current = selectedId;
    const bus = buses.find((b) => b.id === selectedId);
    if (bus?.lat != null && bus?.lng != null)
      map.flyTo([bus.lat, bus.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [selectedId, buses, map]);
  return null;
}

function FitRouteBounds({ routePath }) {
  const map     = useMap();
  const prevKey = useRef(null);
  useEffect(() => {
    if (!routePath || routePath.length < 2) return;
    const key = `${routePath[0]?.[0]},${routePath[0]?.[1]}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    try {
      map.fitBounds(L.latLngBounds(routePath), { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.8 });
    } catch {}
  }, [routePath, map]);
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
  geofencedIds      = new Set(),
  signalLostIds     = new Set(),
  showHeatmap       = false,
  heatmapPoints     = [],
  selectedRoutePath = [],
  loadingRoute      = false,
  playbackMode      = false,
  playbackTrack     = [],
  playbackPos       = null,
  playbackRoute     = null,
}) {
  const center = [33.88, 35.55];

  return (
    <MapContainer
      center={center}
      zoom={playbackMode ? 12 : 11}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      {/* Google Maps road tiles */}
      <TileLayer
        url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains="0123"
        maxZoom={20}
      />

      {/* ── Normal live-tracking mode ── */}
      {!playbackMode && <>
        {/* Selected bus route — road-following geometry from OSRM */}
        {selectedRoutePath.length > 1 && (
          <>
            <Polyline
              positions={selectedRoutePath}
              color="#93C5FD"
              weight={7}
              opacity={0.35}
            />
            <Polyline
              positions={selectedRoutePath}
              color="#2563EB"
              weight={4}
              opacity={0.9}
              dashArray="12 6"
            />
          </>
        )}

        {/* Heatmap overlay */}
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
                    📡 GPS SIGNAL LOST
                  </div>
                )}
                {geofencedIds.has(bus.id) && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', marginBottom: 8, fontSize: 11, color: '#DC2626', fontWeight: 700 }}>
                    ⚠️ GEOFENCE BREACH
                  </div>
                )}
                {[
                  ['Driver',  bus.driver],
                  ['Vehicle', bus.vehicle],
                  ['Status',  bus.status],
                  ['Seats',   bus.seats],
                  ['Speed',   `${bus.speed} km/h`],
                  ['ETA',     bus.trafficInfo?.adjustedEta ?? bus.eta],
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
        {selectedRoutePath.length > 1 && !buses.find(b => b.id === selectedId && b.lat != null) && (
          <FitRouteBounds routePath={selectedRoutePath} />
        )}
      </>}

      {/* ── Journey Playback mode ── */}
      {playbackMode && <>
        {playbackRoute && (
          <Polyline
            positions={playbackRoute.map(p => [p.lat ?? p[0], p.lng ?? p[1]])}
            color="#CBD5E1"
            weight={6}
            opacity={0.6}
            dashArray="8 4"
          />
        )}

        {playbackTrack.length > 1 && playbackTrack.slice(0, -1).map((pt, i) => {
          const next = playbackTrack[i + 1];
          return (
            <Polyline
              key={i}
              positions={[[pt.lat, pt.lng], [next.lat, next.lng]]}
              color={speedColor((pt.speed + next.speed) / 2)}
              weight={4}
              opacity={0.85}
            />
          );
        })}

        {playbackPos && playbackTrack
          .slice(0, playbackTrack.findIndex(p => p.lat === playbackPos.lat) + 1)
          .filter((_, i) => i % 5 === 0)
          .map((pt, i) => (
            <CircleMarker
              key={i}
              center={[pt.lat, pt.lng]}
              radius={3}
              pathOptions={{ color: speedColor(pt.speed), fillColor: speedColor(pt.speed), fillOpacity: 0.8, weight: 1 }}
            />
          ))}

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
