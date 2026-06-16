// DashboardMap — Google Maps tiles + driver-style markers
import { useEffect, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Tooltip,
  Polyline, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLiveGps, getWaypoints, getRouteStops } from '../../api/endpoints';

// ── Inject pulse keyframes once ───────────────────────────────────────────────
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

// ── Status colours (matching driver app palette) ──────────────────────────────
const STATUS_COLOR = {
  ongoing:   '#10B981',
  active:    '#10B981',
  delayed:   '#F59E0B',
  scheduled: '#2563EB',
  alert:     '#EF4444',
};

// ── Pulsing bus marker (same design as DriverMapScreen) ───────────────────────
function makeBusIcon(statusKey, selected) {
  const color    = STATUS_COLOR[statusKey] ?? '#64748B';
  const core     = selected ? 34 : 26;
  const wrap     = core + 20;
  const iconSize = selected ? 15 : 12;

  return L.divIcon({
    html: `
      <div style="
        position:relative;
        width:${wrap}px;height:${wrap}px;
        display:flex;align-items:center;justify-content:center;
      ">
        <!-- pulse ring -->
        <div style="
          position:absolute;
          width:${wrap}px;height:${wrap}px;border-radius:50%;
          background:${color}33;
          animation:dm-pulse ${selected ? '1.4s' : '2s'} ease-out infinite;
        "></div>
        <!-- core circle -->
        <div style="
          position:relative;z-index:1;
          width:${core}px;height:${core}px;border-radius:50%;
          background:${color};border:2.5px solid #fff;
          box-shadow:0 3px 10px ${color}66, 0 1px 4px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
        ">
          <!-- bus SVG icon -->
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
    tooltipAnchor: [wrap / 2 + 4, 0],
  });
}

// ── Stop marker (same design as DriverMapScreen stopPin) ─────────────────────
function makeStopIcon(isFirst, isLast, idx, total) {
  const color  = isFirst ? '#10B981' : isLast ? '#EF4444' : '#64748B';
  const size   = (isFirst || isLast) ? 16 : 12;
  const border = (isFirst || isLast) ? '2.5px' : '2px';
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:#fff;border:${border} solid ${color};
        box-shadow:0 1px 5px rgba(0,0,0,.22);
        display:flex;align-items:center;justify-content:center;
      ">
        ${(isFirst || isLast) ? `<div style="width:${size / 2.5}px;height:${size / 2.5}px;border-radius:50%;background:${color};"></div>` : ''}
      </div>`,
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    tooltipAnchor: [size / 2 + 4, 0],
  });
}

// ── Fly-to helpers ─────────────────────────────────────────────────────────────
function FlyToTrip({ buses, selectedTripRef }) {
  const map    = useMap();
  const prevId = useRef(null);
  useEffect(() => {
    if (!selectedTripRef || selectedTripRef === prevId.current) return;
    prevId.current = selectedTripRef;
    const bus = buses.find(b => b.trip_ref === selectedTripRef);
    if (bus?.lat && bus?.lng)
      map.flyTo([bus.lat, bus.lng], Math.max(map.getZoom(), 14), { duration: 0.9 });
  }, [selectedTripRef, buses, map]);
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
      map.fitBounds(L.latLngBounds(routePath), { padding: [40, 40], maxZoom: 15, animate: true, duration: 0.9 });
    } catch {}
  }, [routePath, map]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DashboardMap({ onFullScreen, selectedTrip }) {
  const [buses,        setBuses]        = useState([]);
  const [routePath,    setRoutePath]    = useState([]);
  const [routeStops,   setRouteStops]   = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Poll live GPS every 5 s
  useEffect(() => {
    let cancelled = false;
    function poll() {
      getLiveGps().then(d => {
        if (!cancelled && Array.isArray(d)) setBuses(d);
      }).catch(() => {});
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Load route when a trip is selected — uses OSRM for road-following geometry
  useEffect(() => {
    if (!selectedTrip?.route_id) {
      setRoutePath([]);
      setRouteStops([]);
      return;
    }
    setLoadingRoute(true);

    Promise.all([
      getWaypoints(selectedTrip.route_id).catch(() => []),
      getRouteStops(selectedTrip.route_id).catch(() => []),
    ]).then(async ([wps, stops]) => {
      if (Array.isArray(stops)) setRouteStops(stops);

      // Build ordered via-points: prefer dense waypoints, fall back to stops
      const raw = (Array.isArray(wps) && wps.length >= 2 ? wps : stops) ?? [];
      const pts = raw
        .map(p => {
          const lat = parseFloat(p.latitude ?? p.lat);
          const lng = parseFloat(p.longitude ?? p.lng);
          return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
        })
        .filter(Boolean);

      if (pts.length < 2) return;

      // Sample to ≤ 25 points so OSRM doesn't reject the request
      const sampled = pts.length <= 25 ? pts : (() => {
        const step = (pts.length - 1) / 24;
        return Array.from({ length: 25 }, (_, i) => pts[Math.round(i * step)]);
      })();

      // OSRM coord string is lng,lat (GeoJSON order)
      const coordStr = sampled.map(p => `${p.lng},${p.lat}`).join(';');

      try {
        const resp = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(8000) }
        );
        const json = await resp.json();
        if (json.code === 'Ok' && json.routes?.[0]?.geometry?.coordinates?.length) {
          // GeoJSON returns [lng, lat]; Leaflet wants [lat, lng]
          setRoutePath(json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
          return;
        }
      } catch { /* fall through to straight-line fallback */ }

      // Fallback: straight lines (better than nothing)
      setRoutePath(pts.map(p => [p.lat, p.lng]));
    }).finally(() => setLoadingRoute(false));
  }, [selectedTrip?.route_id]);

  const selectedRef = selectedTrip?.id ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 290, borderRadius: selectedTrip ? '8px 8px 0 0' : 8, overflow: 'hidden' }}>
      <MapContainer
        center={[33.88, 35.55]}
        zoom={11}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={true}
      >
        {/* Google Maps road tiles */}
        <TileLayer
          url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains="0123"
          maxZoom={20}
        />

        {/* ── Route polyline ── */}
        {routePath.length > 1 && (
          <>
            {/* Shadow / glow */}
            <Polyline
              positions={routePath}
              color="#93C5FD"
              weight={7}
              opacity={0.35}
            />
            {/* Main dashed line */}
            <Polyline
              positions={routePath}
              color="#2563EB"
              weight={4}
              opacity={0.9}
              dashArray="12 6"
            />
          </>
        )}

        {/* ── Stop markers ── */}
        {routeStops.map((stop, i) => {
          const lat = parseFloat(stop.latitude ?? stop.lat);
          const lng = parseFloat(stop.longitude ?? stop.lng);
          if (isNaN(lat) || isNaN(lng)) return null;
          const isFirst = i === 0;
          const isLast  = i === routeStops.length - 1;
          return (
            <Marker
              key={stop.stop_id ?? i}
              position={[lat, lng]}
              icon={makeStopIcon(isFirst, isLast, i, routeStops.length)}
              zIndexOffset={200}
            >
              <Tooltip direction="top" offset={[0, -9]} permanent={false}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {isFirst ? '🟢 ' : isLast ? '🔴 ' : '⚪ '}
                  {stop.stop_name ?? `Stop ${i + 1}`}
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* ── Live bus markers ── */}
        {buses.map(bus => {
          const lat = parseFloat(bus.lat ?? bus.latitude);
          const lng = parseFloat(bus.lng ?? bus.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          const statusKey  = (bus.status ?? '').toLowerCase();
          const isSelected = bus.trip_ref === selectedRef;
          return (
            <Marker
              key={bus.trip_ref ?? bus.vehicle ?? `${lat},${lng}`}
              position={[lat, lng]}
              icon={makeBusIcon(statusKey, isSelected)}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Tooltip direction="right" offset={[8, 0]} permanent={false}>
                <div style={{ fontSize: 11, lineHeight: 1.7, minWidth: 120 }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 12 }}>
                    {bus.trip_ref ?? '—'}
                  </div>
                  {bus.route  && <div style={{ color: '#64748B' }}>{bus.route}</div>}
                  {bus.driver && <div style={{ color: '#64748B' }}>👤 {bus.driver}</div>}
                  {bus.vehicle && <div style={{ color: '#64748B' }}>🚌 {bus.vehicle}</div>}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        <FlyToTrip buses={buses} selectedTripRef={selectedRef} />
        {routePath.length > 1 && !buses.find(b => b.trip_ref === selectedRef) && (
          <FitRouteBounds routePath={routePath} />
        )}
        <InvalidateOnMount />
      </MapContainer>

      {/* ── Overlay: live count ── */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(8px)',
        border: '1px solid #E2E8F0', borderRadius: 20,
        padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#0F172A',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: buses.length > 0 ? '#10B981' : '#CBD5E1',
        }} />
        {buses.length > 0 ? `${buses.length} bus${buses.length !== 1 ? 'es' : ''} live` : 'No buses'}
      </div>

      {/* ── Overlay: full screen button ── */}
      {onFullScreen && (
        <button
          onClick={onFullScreen}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(8px)',
            border: '1px solid #E2E8F0', borderRadius: 20,
            padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#2563EB',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          Full screen
        </button>
      )}

      </div>

      {/* ── Route label — sits flush below the map ── */}
      {selectedTrip && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE', borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '7px 14px',
          fontSize: 11, fontWeight: 700, color: '#1D4ED8',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
          {loadingRoute ? 'Loading route…' : selectedTrip.route}
        </div>
      )}
    </div>
  );
}
