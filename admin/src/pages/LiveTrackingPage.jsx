// pages/LiveTrackingPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTripGpsLogs, getGpsHeatmap, getLiveGps, getTrips, getWaypoints, getRouteStops, getSystemSettings, getTripEtaPredictions } from '../api/endpoints';

// ── WebSocket GPS stream (admin "subscribe_all") ──────────────────────────────
const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api')
  .replace(/\/api\/?$/, '')
  .replace(/^http/, 'ws') + '/gps-stream';

function useAdminGpsStream(onUpdate) {
  const wsRef   = useRef(null);
  const cbRef   = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    let retryTimer;
    let dead = false;

    const connect = () => {
      if (dead) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen  = () => ws.send(JSON.stringify({ type: 'subscribe_all' }));
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            cbRef.current(msg);
          } catch {}
        };
        ws.onclose = () => { if (!dead) retryTimer = setTimeout(connect, 4000); };
        ws.onerror = () => {};
      } catch {}
    };

    connect();
    return () => {
      dead = true;
      clearTimeout(retryTimer);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
import { createPortal } from 'react-dom';
import { StatusPill } from '../components/StatusPill';
import LiveMap from '../components/map/LiveMap';

// ─── Mock bus data removed — using real backend data only ────────────────────


// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  Ongoing:   '#10B981',
  Delayed:   '#F59E0B',
  Scheduled: '#64748B',
};

// ETA helpers
function parseEtaToMinutes(eta) {
  if (!eta || eta === '—') return 0;
  const m = String(eta).match(/(\d+)\s*m/);
  return m ? parseInt(m[1], 10) : 0;
}
function minutesToEta(mins) {
  const m = Math.round(Math.max(0, mins));
  if (m === 0) return '—';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Route path definitions (used for geofence checks and playback)
const ROUTES = [];

function seatMeta(bus) {
  const available = Math.max(0, bus.capacity - bus.passengerCount);
  const ratio = bus.capacity > 0 ? bus.passengerCount / bus.capacity : 0;
  if (available === 0 || ratio >= 0.95) return { available, label: 'Full', color: '#DC2626', bg: '#FEF2F2' };
  if (available <= 4 || ratio >= 0.8) return { available, label: `${available} seats left`, color: '#D97706', bg: '#FFFBEB' };
  return { available, label: `${available} seats available`, color: '#059669', bg: '#ECFDF5' };
}

const TRAFFIC_WINDOWS = {
  morning_peak:   { label: 'Morning Peak',   factor: 1.25 },
  midday:         { label: 'Midday',          factor: 1.0  },
  evening_peak:   { label: 'Evening Peak',    factor: 1.3  },
  off_peak:       { label: 'Off-Peak',        factor: 0.9  },
};

function getTrafficWindow(date) {
  const h = date.getHours();
  if (h >= 7  && h < 10) return 'morning_peak';
  if (h >= 10 && h < 16) return 'midday';
  if (h >= 16 && h < 20) return 'evening_peak';
  return 'off_peak';
}

const ROUTE_HINTS = {};

function trafficMeta(bus, date = new Date()) {
  const windowKey = getTrafficWindow(date);
  const windowMeta = TRAFFIC_WINDOWS[windowKey];
  const loadFactor = bus.status === 'Delayed' ? 1.12 : bus.speed < 20 ? 1.1 : 1;
  return {
    adjustedEta: minutesToEta(parseEtaToMinutes(bus.eta) + ((windowMeta.factor * loadFactor) - 1) * 12),
    trafficLabel: windowMeta.label,
    hint: ROUTE_HINTS[bus.route]?.[windowKey] ?? 'Traffic-aware ETA is based on the current Beirut time-of-day model.',
  };
}

function enrichBus(bus, date = new Date()) {
  return { ...bus, seatInfo: seatMeta(bus), trafficInfo: trafficMeta(bus, date) };
}

// Map a real DB trip row → the bus shape used by this page
const _STATUS_MAP = { ongoing:'Ongoing', active:'Ongoing', boarding:'Ongoing', delayed:'Delayed', scheduled:'Scheduled' };
function tripToBus(t) {
  return {
    id:           'TRP-' + String(t.trip_id).padStart(3, '0'),
    trip_id:      t.trip_id,
    route_id:     t.route_id ?? null,
    route:        t.route_name  || 'Unknown Route',
    routeLabel:   t.start_location && t.end_location ? `${t.start_location} → ${t.end_location}` : t.route_name || '',
    driver:       t.driver_name || 'Unassigned',
    vehicle:      t.plate_number || t.vehicle_model || '',
    status:       _STATUS_MAP[(t.status || '').toLowerCase()] || 'Scheduled',
    seats:        `0/${t.capacity || 40}`,
    passengerCount: 0,
    capacity:     t.capacity || 40,
    speed:        0,
    lat:          null,
    lng:          null,
    eta:          '—',
    _dlat: 0, _dlng: 0,
  };
}

// ─── GPS Signal Loss (default — overridden by DB setting gps.stale_threshold_sec) ──

// ─── Heatmap density points (pre-computed at module load) ────────────────────

function _interpolatePath(path, count, jitter) {
  const n = path.length;
  return Array.from({ length: count }, (_, i) => {
    const t   = i / (count - 1);
    const raw = t * (n - 1);
    const seg = Math.min(Math.floor(raw), n - 2);
    const st  = raw - seg;
    return [
      path[seg][0] + (path[seg + 1][0] - path[seg][0]) * st + (Math.random() - 0.5) * jitter,
      path[seg][1] + (path[seg + 1][1] - path[seg][1]) * st + (Math.random() - 0.5) * jitter,
    ];
  });
}

const HEATMAP_POINTS = (() => {
  const pts = [];

  // Coastal Beirut→Jounieh — Routes 12A + 7B + 9E overlap → highest density
  const coastal = [[33.8938,35.5018],[33.9100,35.5150],[33.9280,35.5340],[33.9450,35.5620],[33.9566,35.5901],[33.9700,35.6050],[33.9806,35.6178]];
  pts.push(..._interpolatePath(coastal, 130, 0.003));

  // Jounieh→Byblos — Routes 7B + 9E
  const jByblos = [[33.9806,35.6178],[34.0300,35.6350],[34.0800,35.6440],[34.1208,35.6484]];
  pts.push(..._interpolatePath(jByblos, 60, 0.003));

  // Byblos→Batroun — Route 9E only
  pts.push(..._interpolatePath([[34.1208,35.6484],[34.1800,35.6530],[34.2200,35.6560],[34.2567,35.6578]], 28, 0.003));

  // Beirut→Zahlé inland — Route 3C
  pts.push(..._interpolatePath([[33.8938,35.5018],[33.8800,35.5500],[33.8700,35.6200],[33.8600,35.7200],[33.8520,35.8200],[33.8481,35.9019]], 50, 0.003));

  // Beirut→Sidon south — Route 5D
  pts.push(..._interpolatePath([[33.8938,35.5018],[33.8600,35.4900],[33.8200,35.4600],[33.7400,35.4300],[33.6500,35.4000],[33.5614,35.3670]], 50, 0.003));

  // Beirut hub — all routes converge here
  for (let i = 0; i < 45; i++)
    pts.push([33.8938 + (Math.random() - 0.5) * 0.012, 35.5018 + (Math.random() - 0.5) * 0.012]);

  return pts;
})();

// ─── Geofence detection (radius loaded from DB via gps.geofence_radius_m) ───

function haversineDist(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distToRoutePath(lat, lng, routeName) {
  const route = ROUTES.find((r) => r.name === routeName);
  if (!route) return 0;
  let minDist = Infinity;
  for (let i = 0; i < route.path.length - 1; i++) {
    const [aLat, aLng] = route.path[i];
    const [bLat, bLng] = route.path[i + 1];
    const dx = bLng - aLng;
    const dy = bLat - aLat;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
      ((lng - aLng) * dx + (lat - aLat) * dy) / lenSq));
    const d = haversineDist(lat, lng, aLat + t * dy, aLng + t * dx);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ─── Journey playback mock track generator ───────────────────────────────────

function generateMockTrack(bus, dateStr) {
  const route = ROUTES.find((r) => r.name === bus.route);
  if (!route) return [];
  const path = route.path;
  const n    = path.length;

  const startMs     = new Date(`${dateStr}T07:30:00`).getTime();
  const durationMs  = 95 * 60 * 1000;   // ~95-minute journey
  const intervalMs  = 20 * 1000;         // point every 20 s
  const total       = Math.floor(durationMs / intervalMs);
  const points      = [];

  for (let i = 0; i <= total; i++) {
    const t      = i / total;
    const raw    = t * (n - 1);
    const seg    = Math.min(Math.floor(raw), n - 2);
    const segT   = raw - seg;
    const [aLat, aLng] = path[seg];
    const [bLat, bLng] = path[seg + 1];

    // GPS noise + terrain-driven speed variation
    const noise  = 0.0004;
    const lat    = aLat + (bLat - aLat) * segT + (Math.random() - 0.5) * noise;
    const lng    = aLng + (bLng - aLng) * segT + (Math.random() - 0.5) * noise;
    const speedBase = 25 + Math.sin(t * Math.PI) * 40;        // faster in middle
    const speed  = Math.max(5, Math.round(speedBase + (Math.random() - 0.5) * 15));
    const ts     = new Date(startMs + i * intervalMs);

    points.push({
      lat:       parseFloat(lat.toFixed(6)),
      lng:       parseFloat(lng.toFixed(6)),
      speed,
      timestamp: ts.toISOString(),
      timeLabel: ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  }
  return points;
}

// ─── Journey Playback overlay ────────────────────────────────────────────────

function JourneyPlayback({ buses, onClose }) {
  const busOptions  = buses.filter((b) => b.status !== 'Scheduled');
  const [busId,     setBusId]     = useState(busOptions[0]?.id ?? '');
  const [date,      setDate]      = useState(() => new Date().toISOString().slice(0, 10));
  const [track,     setTrack]     = useState([]);
  const [idx,       setIdx]       = useState(0);
  const [playing,   setPlaying]   = useState(false);
  const [speed,     setSpeed]     = useState(4);   // playback speed multiplier
  const [loaded,    setLoaded]    = useState(false);
  const [noData,    setNoData]    = useState(false);
  const [loadingGps,setLoadingGps]= useState(false);
  const intervalRef = useRef(null);

  const selectedBus = buses.find((b) => b.id === busId);
  const busRoute    = ROUTES.find((r) => r.name === selectedBus?.route);
  const routeForMap = busRoute?.path.map(([lat, lng]) => ({ lat, lng }));

  const load = useCallback(async () => {
    if (!busId) return;
    setLoadingGps(true);
    setNoData(false);
    try {
      // busId is the trip id from the live buses list
      const res = await getTripGpsLogs(busId, date);
      const points = res?.points ?? res ?? [];
      if (points.length === 0) {
        setNoData(true);
        setTrack([]);
      } else {
        setTrack(points);
      }
    } catch {
      // Fall back to mock track when API unavailable
      const t = generateMockTrack(selectedBus, date);
      setTrack(t);
    } finally {
      setIdx(0);
      setPlaying(false);
      setLoaded(true);
      setLoadingGps(false);
    }
  }, [busId, date, selectedBus]);

  useEffect(() => {
    if (playing && track.length > 0) {
      intervalRef.current = setInterval(() => {
        setIdx((i) => {
          if (i >= track.length - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }, Math.max(50, 500 / speed));
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, track]);

  const currentPt   = loaded && track[idx];
  const pct         = track.length > 1 ? (idx / (track.length - 1)) * 100 : 0;

  const fmtSpeed = (s) => s >= 8 ? `${s} km/h` : 'Stopped';

  // ── Shared input style matching admin design ──
  const ctrlInput = {
    padding: '8px 11px', borderRadius: 8,
    border: '1.5px solid #E2E8F0', background: '#F8FAFC',
    color: '#1E293B', fontSize: 13, outline: 'none',
  };
  const ctrlLabel = { fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: '#F8FAFC', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Top bar — matches admin Topbar style ── */}
      <div style={{
        height: 60, background: '#fff', borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 0 #F1F5F9, 0 2px 8px rgba(0,0,0,.04)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center', color: '#64748B', fontSize: 16 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; }}
        >← Back</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔁</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-.2px' }}>Journey Playback</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>Replay any vehicle's GPS history</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {currentPt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{currentPt.timeLabel}</div>
              <div style={{ fontSize: 11, color: currentPt.speed < 15 ? '#DC2626' : currentPt.speed < 30 ? '#D97706' : '#059669', fontWeight: 600 }}>
                {fmtSpeed(currentPt.speed)}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B' }}>
              <div>Point {idx + 1} of {track.length}</div>
              <div style={{ fontWeight: 600, color: '#6D28D9' }}>{pct.toFixed(0)}% complete</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '12px 24px', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}>
        {/* Vehicle */}
        <div>
          <label style={ctrlLabel}>Vehicle</label>
          <select value={busId} onChange={(e) => { setBusId(e.target.value); setLoaded(false); }} style={ctrlInput}>
            {busOptions.map((b) => <option key={b.id} value={b.id}>{b.id} — {b.route} ({b.driver})</option>)}
          </select>
        </div>

        {/* Date */}
        <div>
          <label style={ctrlLabel}>Journey Date</label>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
            max={new Date().toISOString().slice(0, 10)}
            style={ctrlInput} />
        </div>

        <button onClick={load} style={{ padding: '8px 20px', borderRadius: 8, background: '#6D28D9', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          className="btn-primary">
          Load Journey
        </button>

        {/* Divider */}
        {loaded && <div style={{ width: 1, height: 32, background: '#E2E8F0' }} />}

        {/* Playback controls */}
        {loaded && <>
          <div>
            <label style={ctrlLabel}>Controls</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setIdx(0)} title="Reset" style={{ padding: '7px 11px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#374151', fontSize: 15, cursor: 'pointer' }}>⏮</button>
              <button onClick={() => setPlaying((p) => !p)} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: playing ? '#F59E0B' : '#6D28D9',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: playing ? '0 2px 8px rgba(245,158,11,.3)' : '0 2px 8px rgba(109,40,217,.25)',
              }}>
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button onClick={() => { setPlaying(false); setIdx(track.length - 1); }} title="Jump to end" style={{ padding: '7px 11px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#374151', fontSize: 15, cursor: 'pointer' }}>⏭</button>
            </div>
          </div>

          {/* Speed */}
          <div>
            <label style={ctrlLabel}>Playback Speed</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 4, 8].map((s) => (
                <button key={s} onClick={() => setSpeed(s)} style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: `1.5px solid ${speed === s ? '#6D28D9' : '#E2E8F0'}`,
                  background: speed === s ? '#F5F3FF' : '#F8FAFC',
                  color: speed === s ? '#6D28D9' : '#64748B',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{s}×</button>
              ))}
            </div>
          </div>

          {/* Timeline scrubber */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>
              <span>{track[0]?.timeLabel ?? '—'}</span>
              <span>{track[Math.floor(track.length / 2)]?.timeLabel ?? '—'}</span>
              <span>{track[track.length - 1]?.timeLabel ?? '—'}</span>
            </div>
            <input
              type="range" min={0} max={track.length - 1} value={idx}
              onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
              style={{ width: '100%', accentColor: '#6D28D9', height: 6 }}
            />
          </div>
        </>}
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1 }}>
        {loadingGps ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
            <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>Loading GPS data…</div>
          </div>
        ) : loaded && noData ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#F8FAFC' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No GPS data for this date</div>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
              No GPS records were logged for this vehicle on {date}. Try a different date or check that the driver app is transmitting.
            </div>
          </div>
        ) : loaded ? (
          <LiveMap
            buses={[]}
            routes={[]}
            selectedId={null}
            onSelect={() => {}}
            playbackMode={true}
            playbackTrack={track}
            playbackPos={currentPt ? { lat: currentPt.lat, lng: currentPt.lng, speed: currentPt.speed, timeLabel: currentPt.timeLabel } : null}
            playbackRoute={routeForMap}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#F8FAFC' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🗺️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Select a vehicle and date</div>
            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
              The GPS track will be drawn on the map coloured by speed, with the planned route shown as a dashed overlay.
            </div>
          </div>
        )}
      </div>

      {/* ── Speed legend footer ── */}
      {loaded && (
        <div style={{ background: '#fff', borderTop: '1px solid #E2E8F0', padding: '10px 24px', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Track colour by speed:</span>
          {[['#EF4444', '< 15 km/h', 'Stopped/Very slow'], ['#F59E0B', '15–30', 'Slow'], ['#10B981', '30–50', 'Normal'], ['#3B82F6', '> 50 km/h', 'Fast']].map(([c, spd, lbl]) => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}>
              <span style={{ width: 22, height: 4, borderRadius: 2, background: c, display: 'inline-block', flexShrink: 0 }} />
              <span><strong style={{ color: '#374151' }}>{spd}</strong> {lbl}</span>
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {selectedBus?.route} · {selectedBus?.driver} · {date}
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function LiveTrackingPage() {
  const [buses,       setBuses]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [filter,      setFilter]      = useState('All');
  const [geofencedIds,  setGeofencedIds]  = useState(() => new Set());
  const [geoAlerts,     setGeoAlerts]     = useState([]);
  const [showGeoAlerts,  setShowGeoAlerts] = useState(true);

  const lastSeenRef = useRef({});
  const [signalLossMs,    setSignalLossMs]     = useState(30_000);
  const [geofenceRadiusM, setGeofenceRadiusM]  = useState(150);
  const [signalLostIds,   setSignalLostIds]    = useState(() => new Set());
  const [signalAlerts,    setSignalAlerts]     = useState([]);
  const [showSignalAlerts, setShowSignalAlerts] = useState(true);
  const busesRef = useRef([]);

  const [selectedRoute,   setSelectedRoute]   = useState([]);
  const [loadingRoute,    setLoadingRoute]    = useState(false);

  const [showPlayback,    setShowPlayback]    = useState(false);
  const [showHeatmap,     setShowHeatmap]     = useState(false);
  const [heatmapPoints,   setHeatmapPoints]   = useState([]);
  const [heatmapFetched,  setHeatmapFetched]  = useState(false);
  const [heatmapLoading,  setHeatmapLoading]  = useState(false);
  const [wsConnected,     setWsConnected]     = useState(false);
  const [serverGeoAlerts, setServerGeoAlerts] = useState([]);
  const tickRef = useRef(0);

  // HERE ETA per trip: { [trip_id]: { stops, traffic, routing_source } }
  const [tripEtaMap, setTripEtaMap] = useState({});

  // Keep busesRef in sync so the signal-loss check sees the latest bus list
  useEffect(() => { busesRef.current = buses; }, [buses]);

  // Load GPS settings from DB on mount
  useEffect(() => {
    getSystemSettings('gps')
      .then(res => {
        const flat = res?.data?.flat ?? {};
        const sec  = parseInt(flat['gps.stale_threshold_sec'] ?? '30',  10);
        const rad  = parseInt(flat['gps.geofence_radius_m']  ?? '150', 10);
        if (!isNaN(sec) && sec > 0) setSignalLossMs(sec * 1000);
        if (!isNaN(rad) && rad > 0) setGeofenceRadiusM(rad);
      })
      .catch(() => {});
  }, []);

  // Fetch HERE ETA for the selected trip and keep it fresh every 30 s
  const _selectedTripId = buses.find(b => b.id === selected)?.trip_id ?? null;
  useEffect(() => {
    if (!_selectedTripId) return;
    let dead = false;
    const fetch30 = () =>
      getTripEtaPredictions(_selectedTripId)
        .then(res => { if (!dead) setTripEtaMap(prev => ({ ...prev, [_selectedTripId]: res.data })); })
        .catch(() => {});
    fetch30();
    const t = setInterval(fetch30, 30_000);
    return () => { dead = true; clearInterval(t); };
  }, [_selectedTripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load real active trips from the backend on mount
  useEffect(() => {
    getTrips()
      .then(res => {
        const rows = Array.isArray(res?.data?.data) ? res.data.data
                   : Array.isArray(res?.data)        ? res.data
                   : [];
        const activeSet = new Set(['ongoing','active','boarding','delayed','scheduled']);
        const active = rows.filter(t => activeSet.has((t.status || '').toLowerCase()));
        const realBuses = active.map(t => enrichBus(tripToBus(t)));
        setBuses(realBuses);
        if (realBuses.length > 0) setSelected(realBuses[0].id);
        // Prime lastSeen so no false signal-loss alerts on first load
        active.forEach(t => {
          lastSeenRef.current['TRP-' + String(t.trip_id).padStart(3, '0')] = Date.now();
        });
      })
      .catch(() => {}); // stay empty on error — no mock fallback
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch route geometry when selected bus or its route_id changes ──────────
  // Derive route_id so the effect doesn't re-run on every GPS position update
  const _selectedRouteId = buses.find(b => b.id === selected)?.route_id ?? null;
  useEffect(() => {
    if (!_selectedRouteId) { setSelectedRoute([]); return; }
    let cancelled = false;
    setLoadingRoute(true);

    Promise.all([
      getWaypoints(_selectedRouteId).catch(() => []),
      getRouteStops(_selectedRouteId).catch(() => []),
    ]).then(async ([wps, stops]) => {
      if (cancelled) return;
      const raw = (Array.isArray(wps) && wps.length >= 2 ? wps : stops) ?? [];
      const pts = raw.map(p => {
        const lat = parseFloat(p.latitude ?? p.lat);
        const lng = parseFloat(p.longitude ?? p.lng);
        return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
      }).filter(Boolean);

      if (pts.length < 2) { setSelectedRoute([]); setLoadingRoute(false); return; }

      const sampled = pts.length <= 25 ? pts : (() => {
        const step = (pts.length - 1) / 24;
        return Array.from({ length: 25 }, (_, i) => pts[Math.round(i * step)]);
      })();

      const coordStr = sampled.map(p => `${p.lng},${p.lat}`).join(';');
      try {
        const resp = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
          { signal: AbortSignal.timeout(8000) }
        );
        const json = await resp.json();
        if (!cancelled && json.code === 'Ok' && json.routes?.[0]?.geometry?.coordinates?.length) {
          setSelectedRoute(json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
          setLoadingRoute(false);
          return;
        }
      } catch { /* fall through to straight-line fallback */ }

      if (!cancelled) {
        setSelectedRoute(pts.map(p => [p.lat, p.lng]));
        setLoadingRoute(false);
      }
    });
    return () => { cancelled = true; };
  }, [selected, _selectedRouteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket GPS stream ──────────────────────────────────────────────────
  useAdminGpsStream((msg) => {
    if (msg.type === 'connected')    { setWsConnected(true); return; }

    if (msg.type === 'gps_update' && msg.trip_id != null) {
      const tripRef = 'TRP-' + String(msg.trip_id).padStart(3, '0');
      lastSeenRef.current[tripRef] = Date.now();
      setBuses((prev) => {
        const exists = prev.some(b => b.id === tripRef);
        if (exists) {
          return prev.map(b => b.id !== tripRef ? b : enrichBus({ ...b, lat: msg.lat, lng: msg.lng }));
        }
        // New bus arriving via WebSocket — add it
        return [...prev, enrichBus({
          id: tripRef, route: msg.route || 'Unknown Route', routeLabel: msg.route || '',
          driver: msg.driver || 'Unknown', vehicle: msg.vehicle_id || '',
          status: 'Ongoing', seats: '?/?', passengerCount: 0, capacity: 40, speed: 0,
          lat: msg.lat, lng: msg.lng, eta: '—', _dlat: 0, _dlng: 0,
        })];
      });
    }

    if (msg.type === 'geofence_breach') {
      setServerGeoAlerts((prev) => {
        const exists = prev.some(a => a.busId === msg.trip_ref && !a.dismissed);
        if (exists) return prev;
        return [{ busId: msg.trip_ref, vehicle: msg.vehicle, driver: msg.driver,
                  distM: msg.distance_m, detectedAt: msg.detected_at, dismissed: false,
                  source: 'server' }, ...prev];
      });
    }
  });

  // Fetch real GPS heatmap data when the overlay is first toggled on
  useEffect(() => {
    if (!showHeatmap || heatmapFetched) return;
    setHeatmapLoading(true);
    getGpsHeatmap()
      .then(d => {
        const pts = d?.points ?? [];
        if (pts.length > 0) {
          setHeatmapPoints(pts);
        } else {
          // Fall back to static mock converted to [lat, lng, 0.5] triples
          setHeatmapPoints(HEATMAP_POINTS.map(p => [p[0], p[1], 0.5]));
        }
      })
      .catch(() => {
        setHeatmapPoints(HEATMAP_POINTS.map(p => [p[0], p[1], 0.5]));
      })
      .finally(() => {
        setHeatmapFetched(true);
        setHeatmapLoading(false);
      });
  }, [showHeatmap, heatmapFetched]);

  // Run geofence check every 5 ticks
  const runGeofenceCheck = useCallback((busList) => {
    const breached = new Set();
    const newAlerts = [];

    busList.forEach((bus) => {
      if (bus.status === 'Scheduled') return;
      if (bus.lat == null || bus.lng == null) return;
      const dist = distToRoutePath(bus.lat, bus.lng, bus.route);
      if (dist > geofenceRadiusM) {
        breached.add(bus.id);
        newAlerts.push({
          busId: bus.id, vehicle: bus.vehicle, route: bus.route,
          driver: bus.driver, distM: Math.round(dist),
          detectedAt: new Date().toISOString(), dismissed: false,
        });
      }
    });

    setGeofencedIds(breached);
    setGeoAlerts((prev) => {
      const existingIds = new Set(prev.filter((a) => !a.dismissed).map((a) => a.busId));
      const fresh = newAlerts.filter((a) => !existingIds.has(a.busId));
      return [...prev.filter((a) => a.dismissed || breached.has(a.busId)), ...fresh];
    });
  }, [geofenceRadiusM]);

  // Poll real GPS every 5 s — replaces fake-delta simulation
  useEffect(() => {
    const poll = async () => {
      tickRef.current += 1;
      try {
        const data = await getLiveGps();
        if (Array.isArray(data) && data.length > 0) {
          const liveMap = {};
          data.forEach((d) => { liveMap[d.trip_ref] = d; });
          setBuses((prev) => {
            const updatedIds = new Set();
            const updated = prev.map((bus) => {
              const live = liveMap[bus.id];
              if (live) {
                lastSeenRef.current[bus.id] = Date.now();
                updatedIds.add(bus.id);
                return enrichBus({ ...bus, lat: live.lat, lng: live.lng });
              }
              return bus;
            });
            // Add buses that arrived from GPS but aren't in the list yet
            data.forEach(live => {
              if (!updatedIds.has(live.trip_ref)) {
                lastSeenRef.current[live.trip_ref] = Date.now();
                updated.push(enrichBus({
                  id: live.trip_ref, route: live.route || 'Unknown Route', routeLabel: live.route || '',
                  driver: live.driver || 'Unknown', vehicle: live.vehicle || '',
                  status: 'Ongoing', seats: '?/?', passengerCount: 0, capacity: 40, speed: 0,
                  lat: live.lat, lng: live.lng, eta: '—', _dlat: 0, _dlng: 0,
                }));
              }
            });
            return updated;
          });
        }
      } catch { /* keep current positions on API error */ }

      // Geofence check every 3 polls (~15 s)
      if (tickRef.current % 3 === 0) {
        setBuses((current) => { runGeofenceCheck(current); return current; });
      }

      // Signal loss check every 4 polls (~20 s)
      if (tickRef.current % 4 === 0) {
        const now  = Date.now();
        const lost = new Set();
        const newAlerts = [];
        busesRef.current.forEach((b) => {
          if (b.status === 'Scheduled') return;
          const lastSeen = lastSeenRef.current[b.id] ?? 0;
          if (lastSeen > 0 && now - lastSeen > signalLossMs) {
            lost.add(b.id);
            newAlerts.push({
              busId: b.id, vehicle: b.vehicle, route: b.route, driver: b.driver,
              lastSeen: new Date(lastSeen).toISOString(), dismissed: false,
            });
          }
        });
        setSignalLostIds(lost);
        setSignalAlerts((prev) => {
          const kept = prev.filter((a) => a.dismissed || lost.has(a.busId));
          const existIds = new Set(kept.map((a) => a.busId));
          const fresh = newAlerts.filter((a) => !existIds.has(a.busId));
          return [...kept, ...fresh];
        });
      }
    };

    poll(); // immediate first fetch
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [runGeofenceCheck]);

  const filteredBuses = filter === 'All'
    ? buses
    : buses.filter((b) => b.status === filter);

  const selectedBus = buses.find((b) => b.id === selected);

  const counts = {
    Ongoing:   buses.filter((b) => b.status === 'Ongoing').length,
    Delayed:   buses.filter((b) => b.status === 'Delayed').length,
    Scheduled: buses.filter((b) => b.status === 'Scheduled').length,
  };

  const activeAlerts       = geoAlerts.filter((a) => !a.dismissed);
  const activeSignalAlerts = signalAlerts.filter((a) => !a.dismissed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Journey Playback overlay */}
      {showPlayback && <JourneyPlayback buses={buses} onClose={() => setShowPlayback(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Live Tracking
          </h1>
          <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0' }}>
            Real-time GPS positions — Lebanon · updates every 2.5s
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Journey Playback button */}
          <button
            onClick={() => setShowPlayback(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: '#F5F3FF', border: '1px solid #DDD6FE',
              color: '#7C3AED', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🔁 Journey Playback
          </button>

          {/* Signal loss badge */}
          {activeSignalAlerts.length > 0 && (
            <button onClick={() => setShowSignalAlerts((s) => !s)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: '#F5F3FF', border: '1px solid #DDD6FE',
              color: '#7C3AED', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              📡 {activeSignalAlerts.length} Signal {activeSignalAlerts.length === 1 ? 'Loss' : 'Losses'}
            </button>
          )}

          {/* Geofence alert badge */}
          {activeAlerts.length > 0 && (
            <button onClick={() => setShowGeoAlerts((s) => !s)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              animation: 'blink 1.5s ease-in-out infinite',
            }}>
              ⚠️ {activeAlerts.length} Geofence {activeAlerts.length === 1 ? 'Breach' : 'Breaches'}
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Ongoing', 'Delayed', 'Scheduled'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                backgroundColor: filter === f
                  ? (STATUS_COLOR[f] || '#6D28D9')
                  : '#F1F5F9',
                color: filter === f ? '#fff' : '#64748B',
                transition: 'all .15s',
              }}
            >
              {f}{f !== 'All' ? ` (${counts[f]})` : ` (${buses.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Signal loss alert panel */}
      {showSignalAlerts && activeSignalAlerts.length > 0 && (
        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📡</span>
              GPS Signal Loss — {activeSignalAlerts.length} vehicle{activeSignalAlerts.length !== 1 ? 's' : ''} not sending updates
              {activeSignalAlerts.every(a => a.demo) && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: '#7C3AED', color: '#fff', letterSpacing: '.06em' }}>
                  DEMO
                </span>
              )}
            </div>
            <button onClick={() => setShowSignalAlerts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeSignalAlerts.map((alert) => {
              const staleSec = Math.round((Date.now() - new Date(alert.lastSeen).getTime()) / 1000);
              const staleLabel = staleSec < 60 ? `${staleSec}s ago` : `${Math.round(staleSec / 60)}m ago`;
              return (
                <div key={alert.busId} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #DDD6FE', borderRadius: 9, padding: '10px 14px' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📡</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 7 }}>
                      {alert.busId} ({alert.vehicle}) — {alert.driver}
                      {alert.demo && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED', letterSpacing: '.05em', flexShrink: 0 }}>
                          SIMULATED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#7C3AED' }}>
                      {alert.route} · Last GPS ping: <strong>{staleLabel}</strong> · No updates for {Math.round(signalLossMs / 1000)}s+
                    </div>
                  </div>
                  <button onClick={() => setSelected(alert.busId)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#7C3AED', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    View on map
                  </button>
                  <button onClick={() => setSignalAlerts((prev) => prev.map((a) => a.busId === alert.busId ? { ...a, dismissed: true } : a))}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Geofence alert panel */}
      {showGeoAlerts && activeAlerts.length > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              Geofence Alerts — {activeAlerts.length} vehicle{activeAlerts.length !== 1 ? 's' : ''} outside route corridor
              {activeAlerts.every(a => a.demo) && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: '#DC2626', color: '#fff', letterSpacing: '.06em' }}>
                  DEMO
                </span>
              )}
            </div>
            <button onClick={() => setShowGeoAlerts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeAlerts.map((alert) => (
              <div key={alert.busId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', border: '1px solid #FECACA', borderRadius: 9,
                padding: '10px 14px',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 7 }}>
                    {alert.busId} ({alert.vehicle}) — {alert.driver}
                    {alert.demo && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: '#FEE2E2', color: '#DC2626', letterSpacing: '.05em', flexShrink: 0 }}>
                        SIMULATED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#DC2626' }}>
                    {alert.route} · <strong>{alert.distM} m</strong> outside corridor · detected {new Date(alert.detectedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(alert.busId)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#6D28D9', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  View on map
                </button>
                <button
                  onClick={() => setGeoAlerts((prev) => prev.map((a) => a.busId === alert.busId ? { ...a, dismissed: true } : a))}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Active',      value: counts.Ongoing,   color: '#10B981', bg: '#ECFDF5' },
          { label: 'Delayed',     value: counts.Delayed,   color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Scheduled',   value: counts.Scheduled, color: '#64748B', bg: '#F1F5F9' },
          { label: 'Passengers',  value: buses.reduce((s, b) => s + b.passengerCount, 0), color: '#6D28D9', bg: '#F5F3FF' },
          { label: 'Seats free',  value: buses.reduce((s, b) => s + b.seatInfo.available, 0), color: '#059669', bg: '#ECFDF5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ padding: '6px 14px', borderRadius: 9,
                                     backgroundColor: bg, border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Map + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14,
                    height: `calc(100vh - ${selectedBus ? 358 : 262}px)`, minHeight: 380 }}>

        {/* Map panel */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #F1F5F9',
                        display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* Title */}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', flexShrink: 0 }}>
              GPS map
              {loadingRoute && <span style={{ fontSize: 11, fontWeight: 500, color: '#6D28D9', marginLeft: 8 }}>· Loading route…</span>}
            </span>

            {/* Bus selector */}
            <select
              value={selected || ''}
              onChange={(e) => setSelected(e.target.value || buses[0]?.id)}
              style={{
                flex: 1, minWidth: 0,
                padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A',
                cursor: 'pointer', outline: 'none',
              }}
            >
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.id} — {bus.route} ({bus.status})
                </option>
              ))}
            </select>

            {/* Status legend */}
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              {[['#10B981', 'Ongoing'], ['#F59E0B', 'Delayed'], ['#64748B', 'Scheduled'], ['#7C3AED', 'No signal']].map(([c, l]) => (
                <span key={l} style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Leaflet map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <LiveMap
              buses={filteredBuses.filter(b => b.lat != null && b.lng != null)}
              routes={[]}
              selectedId={selected}
              onSelect={setSelected}
              geofencedIds={geofencedIds}
              signalLostIds={signalLostIds}
              showHeatmap={false}
              heatmapPoints={[]}
              selectedRoutePath={selectedRoute}
              loadingRoute={loadingRoute}
            />
          </div>
        </div>

        {/* Bus list */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9',
                        fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
            {filteredBuses.length === buses.length
              ? `All buses (${buses.length})`
              : `${filter} (${filteredBuses.length})`}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredBuses.length === 0 && (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                {buses.length === 0 ? 'Loading trips from backend…' : `No ${filter.toLowerCase()} trips`}
              </div>
            )}
            {filteredBuses.map((bus) => (
              <div
                key={bus.id}
                onClick={() => setSelected(bus.id)}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #F7F7F7',
                  cursor: 'pointer',
                  background: selected === bus.id ? '#F5F3FF' : 'transparent',
                  borderLeft: selected === bus.id ? '3px solid #6D28D9' : '3px solid transparent',
                  transition: 'background .15s',
                }}
              >
                {/* Row 1: ID + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%',
                                  background: STATUS_COLOR[bus.status], flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#0F172A', flex: 1 }}>{bus.id}</span>
                  <StatusPill status={bus.status} />
                </div>
                {/* Row 2: route */}
                <div style={{ fontSize: 11, color: '#374151', marginBottom: 2, fontWeight: 500,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bus.route} · {bus.routeLabel}
                </div>
                {/* Row 3: driver | vehicle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{bus.driver}</span>
                  <span>{bus.vehicle}</span>
                </div>
                {/* Row 4: ETA + seat pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  {(() => {
                    const h = tripEtaMap[bus.trip_id]?.stops?.[0];
                    const label = h?.eta_min != null
                      ? (h.eta_min < 1 ? 'Arriving' : `${Math.round(h.eta_min)} min`)
                      : bus.trafficInfo.adjustedEta;
                    return <span style={{ fontSize: 11, color: '#6D28D9', fontWeight: 700 }}>ETA {label}</span>;
                  })()}
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999,
                                  background: bus.seatInfo.bg, color: bus.seatInfo.color, fontWeight: 700, flexShrink: 0 }}>
                    {bus.seatInfo.label}
                  </span>
                </div>
                {/* Capacity bar */}
                <div style={{ marginTop: 5, height: 2, borderRadius: 1, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 1,
                    width: `${(bus.passengerCount / bus.capacity) * 100}%`,
                    backgroundColor: bus.passengerCount / bus.capacity > 0.9 ? '#EF4444'
                                   : bus.passengerCount / bus.capacity > 0.6 ? '#F59E0B' : '#22C55E',
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Selected trip detail card ─────────────────────────────────────────── */}
      {selectedBus && (
        <div style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflow: 'hidden',
        }}>
          {/* Trip ID + status badge */}
          <div style={{ paddingRight: 18, borderRight: '1px solid #F1F5F9', marginRight: 18, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%',
                              background: STATUS_COLOR[selectedBus.status] || '#64748B', flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{selectedBus.id}</span>
            </div>
            <StatusPill status={selectedBus.status} />
          </div>

          {/* Route name + label */}
          <div style={{ paddingRight: 18, borderRight: '1px solid #F1F5F9', marginRight: 18, flex: '0 0 180px', minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 2,
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedBus.route}
            </div>
            <div style={{ fontSize: 11, color: '#64748B',
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedBus.routeLabel || '—'}
            </div>
          </div>

          {/* Metric columns */}
          {[
            { label: 'Driver',   value: selectedBus.driver },
            { label: 'Vehicle',  value: selectedBus.vehicle },
            { label: 'Speed',    value: `${selectedBus.speed} km/h` },
            { label: 'ETA', value: (() => {
                const h = tripEtaMap[selectedBus.trip_id]?.stops?.[0];
                return h?.eta_min != null
                  ? (h.eta_min < 1 ? 'Arriving' : `${Math.round(h.eta_min)} min`)
                  : selectedBus.trafficInfo.adjustedEta;
              })() },
            { label: 'Seats',    value: selectedBus.seatInfo.label,
                                  valueColor: selectedBus.seatInfo.color },
            { label: 'Position', value: selectedBus.lat != null
                ? `${selectedBus.lat.toFixed(4)}°N, ${selectedBus.lng.toFixed(4)}°E`
                : 'Awaiting GPS…' },
          ].map(({ label, value, valueColor }, i, arr) => (
            <div key={label} style={{
              paddingLeft: 18,
              paddingRight: i < arr.length - 1 ? 18 : 0,
              borderRight: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: valueColor || '#0F172A',
                             whiteSpace: 'nowrap', marginBottom: 3 }}>
                {value}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8',
                             textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {label}
              </div>
            </div>
          ))}

          {/* Capacity bar */}
          <div style={{ marginLeft: 18, flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8',
                           textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
              Capacity
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(selectedBus.passengerCount / selectedBus.capacity) * 100}%`,
                background: selectedBus.passengerCount / selectedBus.capacity > 0.9 ? '#EF4444'
                           : selectedBus.passengerCount / selectedBus.capacity > 0.6 ? '#F59E0B' : '#10B981',
                transition: 'width .3s',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
              {selectedBus.passengerCount} / {selectedBus.capacity} passengers
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

