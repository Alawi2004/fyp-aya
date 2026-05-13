// pages/LiveTrackingPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTripGpsLogs, getGpsHeatmap } from '../api/endpoints';
import { createPortal } from 'react-dom';
import { StatusPill } from '../components/StatusPill';
import LiveMap from '../components/map/LiveMap';

// ─── Route paths (real Lebanese road coordinates) ────────────────────────────
// Each path is an array of [lat, lng] waypoints along Lebanese highways

const ROUTES = [
  {
    name: 'Route 12A',
    label: 'Beirut ↔ Jounieh',
    path: [
      [33.8938, 35.5018], // Beirut
      [33.9100, 35.5150],
      [33.9280, 35.5340],
      [33.9450, 35.5620],
      [33.9566, 35.5901],
      [33.9700, 35.6050],
      [33.9806, 35.6178], // Jounieh
    ],
  },
  {
    name: 'Route 7B',
    label: 'Beirut ↔ Byblos',
    path: [
      [33.8938, 35.5018], // Beirut
      [33.9280, 35.5340],
      [33.9806, 35.6178], // Jounieh
      [34.0300, 35.6350],
      [34.0800, 35.6440],
      [34.1208, 35.6484], // Byblos
    ],
  },
  {
    name: 'Route 3C',
    label: 'Beirut ↔ Zahlé',
    path: [
      [33.8938, 35.5018], // Beirut
      [33.8800, 35.5500],
      [33.8700, 35.6200],
      [33.8600, 35.7200],
      [33.8520, 35.8200],
      [33.8481, 35.9019], // Zahlé
    ],
  },
  {
    name: 'Route 5D',
    label: 'Beirut ↔ Sidon',
    path: [
      [33.8938, 35.5018], // Beirut
      [33.8600, 35.4900],
      [33.8200, 35.4600],
      [33.7400, 35.4300],
      [33.6500, 35.4000],
      [33.5614, 35.3670], // Sidon
    ],
  },
  {
    name: 'Route 9E',
    label: 'Beirut ↔ Batroun',
    path: [
      [33.8938, 35.5018], // Beirut
      [33.9806, 35.6178], // Jounieh
      [34.1208, 35.6484], // Byblos
      [34.1800, 35.6530],
      [34.2200, 35.6560],
      [34.2567, 35.6578], // Batroun
    ],
  },
];

// ─── Mock bus data with real Lebanese coordinates ─────────────────────────────

const INITIAL_BUSES = [
  {
    id: 'TRP-041',
    route: 'Route 12A',
    routeLabel: 'Beirut → Jounieh',
    driver: 'Karim Moussa',
    vehicle: 'BUS-01',
    status: 'Ongoing',
    seats: '24/30',
    passengerCount: 24,
    capacity: 30,
    speed: 42,
    lat: 33.9450,
    lng: 35.5620,
    eta: '14:15',
    // direction: small delta applied each tick to simulate movement
    _dlat:  0.00012,
    _dlng:  0.00018,
  },
  {
    id: 'TRP-038',
    route: 'Route 7B',
    routeLabel: 'Jounieh → Byblos',
    driver: 'Lara Abi Nader',
    vehicle: 'BUS-05',
    status: 'Delayed',
    seats: '18/20',
    passengerCount: 18,
    capacity: 20,
    speed: 15,
    lat: 34.0300,
    lng: 35.6350,
    eta: '14:42',
    _dlat:  0.00004,
    _dlng:  0.00006,
  },
  {
    id: 'TRP-029',
    route: 'Route 3C',
    routeLabel: 'Beirut → Zahlé',
    driver: 'Joe Pharaon',
    vehicle: 'BUS-09',
    status: 'Ongoing',
    seats: '40/40',
    passengerCount: 40,
    capacity: 40,
    speed: 55,
    lat: 33.8650,
    lng: 35.7200,
    eta: '13:58',
    _dlat: -0.00008,
    _dlng:  0.00020,
  },
  {
    id: 'TRP-033',
    route: 'Route 5D',
    routeLabel: 'Beirut Terminal',
    driver: 'Maya Salameh',
    vehicle: 'BUS-02',
    status: 'Scheduled',
    seats: '11/30',
    passengerCount: 11,
    capacity: 30,
    speed: 0,
    lat: 33.8938,
    lng: 35.5018,
    eta: '14:30',
    _dlat: 0,
    _dlng: 0,
  },
  {
    id: 'TRP-045',
    route: 'Route 9E',
    routeLabel: 'Byblos → Batroun',
    driver: 'Rami Khoury',
    vehicle: 'BUS-11',
    status: 'Ongoing',
    seats: '22/30',
    passengerCount: 22,
    capacity: 30,
    speed: 38,
    lat: 34.1800,
    lng: 35.6530,
    eta: '15:05',
    _dlat:  0.00010,
    _dlng:  0.00005,
  },
  {
    id: 'TRP-041B',
    route: 'Route 12A',
    routeLabel: 'Jounieh → Beirut',
    driver: 'Hassan Nasser',
    vehicle: 'BUS-03',
    status: 'Ongoing',
    seats: '19/30',
    passengerCount: 19,
    capacity: 30,
    speed: 48,
    lat: 33.9806,
    lng: 35.6178,
    eta: '14:20',
    _dlat: -0.00014,
    _dlng: -0.00020,
  },
  {
    id: 'TRP-047',
    route: 'Route 3C',
    routeLabel: 'Zahlé → Beirut',
    driver: 'Sara Khoury',
    vehicle: 'BUS-07',
    status: 'Delayed',
    seats: '25/40',
    passengerCount: 25,
    capacity: 40,
    speed: 8,
    lat: 33.8510,
    lng: 35.8700,
    eta: '15:30',
    _dlat: -0.00003,
    _dlng: -0.00008,
  },
  {
    id: 'TRP-050',
    route: 'Route 7B',
    routeLabel: 'Beirut → Byblos',
    driver: 'Fadi Gemayel',
    vehicle: 'BUS-12',
    status: 'Ongoing',
    seats: '30/45',
    passengerCount: 30,
    capacity: 45,
    speed: 62,
    lat: 33.9280,
    lng: 35.5340,
    eta: '14:55',
    _dlat:  0.00016,
    _dlng:  0.00014,
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  Ongoing:   '#10B981',
  Delayed:   '#F59E0B',
  Scheduled: '#64748B',
};

const TRAFFIC_WINDOWS = {
  peak_am: { label: 'AM peak', factor: 1.28 },
  midday:  { label: 'Midday flow', factor: 1.05 },
  peak_pm: { label: 'PM peak', factor: 1.34 },
  late:    { label: 'Late evening', factor: 0.92 },
};

const ROUTE_HINTS = {
  'Route 12A': {
    peak_am: 'Expect coastal slowdown around Nahr El Kalb.',
    midday: 'Coastal road is moving normally toward Jounieh.',
    peak_pm: 'Jounieh return traffic is building near Dbayeh.',
    late: 'Fast coastal segment with lighter evening flow.',
  },
  'Route 7B': {
    peak_am: 'Northbound congestion likely after Jounieh interchange.',
    midday: 'Byblos corridor is mostly clear.',
    peak_pm: 'Heavy merge traffic expected near Casino du Liban.',
    late: 'Longer open stretches make this one of the faster routes now.',
  },
  'Route 3C': {
    peak_am: 'Mountain climb out of Beirut is slowing ETA.',
    midday: 'Inland section is steady with moderate climb traffic.',
    peak_pm: 'Inbound Beirut approach is congested near Mkalles.',
    late: 'Zahle corridor is flowing with minimal bottlenecks.',
  },
  'Route 5D': {
    peak_am: 'Airport approach traffic may add a few minutes.',
    midday: 'Southbound coastal movement is stable.',
    peak_pm: 'Sidon return traffic is dense on the Beirut edge.',
    late: 'Evening south corridor is relatively open.',
  },
  'Route 9E': {
    peak_am: 'North coastal bottlenecks may slow Batroun arrivals.',
    midday: 'Batroun corridor is moving at near-normal speed.',
    peak_pm: 'Evening congestion likely around Byblos and Jounieh.',
    late: 'Long-haul coastal run is clear for now.',
  },
};

function getTrafficWindow(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 7 && hour < 10) return 'peak_am';
  if (hour >= 10 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 20) return 'peak_pm';
  return 'late';
}

function parseEtaToMinutes(eta) {
  const [hours, minutes] = eta.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToEta(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mins = String(normalized % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function seatMeta(bus) {
  const available = Math.max(0, bus.capacity - bus.passengerCount);
  const ratio = bus.capacity > 0 ? bus.passengerCount / bus.capacity : 0;
  if (available === 0 || ratio >= 0.95) return { available, label: 'Full', color: '#DC2626', bg: '#FEF2F2' };
  if (available <= 4 || ratio >= 0.8) return { available, label: `${available} seats left`, color: '#D97706', bg: '#FFFBEB' };
  return { available, label: `${available} seats available`, color: '#059669', bg: '#ECFDF5' };
}

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

// ─── GPS Signal Loss ─────────────────────────────────────────────────────────

const SIGNAL_LOSS_MS = 30_000; // 30 s without a GPS update → signal lost

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

// ─── Geofence detection ──────────────────────────────────────────────────────

const GEOFENCE_RADIUS_M = 500; // metres off the planned corridor

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
              <div style={{ fontWeight: 600, color: '#2563EB' }}>{pct.toFixed(0)}% complete</div>
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

        <button onClick={load} style={{ padding: '8px 20px', borderRadius: 8, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
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
                background: playing ? '#F59E0B' : '#2563EB',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: playing ? '0 2px 8px rgba(245,158,11,.3)' : '0 2px 8px rgba(37,99,235,.25)',
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
                  border: `1.5px solid ${speed === s ? '#2563EB' : '#E2E8F0'}`,
                  background: speed === s ? '#EFF6FF' : '#F8FAFC',
                  color: speed === s ? '#2563EB' : '#64748B',
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
              style={{ width: '100%', accentColor: '#2563EB', height: 6 }}
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
            <div style={{ width: 80, height: 80, borderRadius: 20, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🗺️</div>
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
  const [buses,       setBuses]       = useState(() => INITIAL_BUSES.map((bus) => enrichBus(bus)));
  const [selected,    setSelected]    = useState(INITIAL_BUSES[0].id);
  const [filter,      setFilter]      = useState('All');
  const [geofencedIds,  setGeofencedIds]  = useState(() => new Set(['TRP-047']));  // TRP-047 demo breach
  const [geoAlerts,     setGeoAlerts]     = useState([
    { busId: 'TRP-047', vehicle: 'BUS-07', route: 'Route 3C', driver: 'Sara Khoury', distM: 820, detectedAt: new Date().toISOString(), dismissed: false, demo: true },
  ]);
  const [showGeoAlerts,  setShowGeoAlerts] = useState(true);

  // GPS signal loss — TRP-038 pre-seeded as demo: it's Delayed and never gets
  // position updates from the simulation tick (only Ongoing buses are updated)
  const lastSeenRef = useRef(
    Object.fromEntries(INITIAL_BUSES.map((b) => [
      b.id,
      b.id === 'TRP-038' ? Date.now() - 40_000 : Date.now(), // TRP-038 already stale
    ]))
  );
  const [signalLostIds,   setSignalLostIds]   = useState(() => new Set(['TRP-038']));
  const [signalAlerts,    setSignalAlerts]     = useState([
    { busId: 'TRP-038', vehicle: 'BUS-05', route: 'Route 7B', driver: 'Lara Abi Nader', lastSeen: new Date(Date.now() - 40_000).toISOString(), dismissed: false, demo: true },
  ]);
  const [showSignalAlerts, setShowSignalAlerts] = useState(true);

  const [showPlayback,   setShowPlayback]   = useState(false);
  const [showHeatmap,    setShowHeatmap]    = useState(false);
  const [heatmapPoints,  setHeatmapPoints]  = useState([]);  // [lat, lng, intensity]
  const [heatmapFetched, setHeatmapFetched] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const tickRef = useRef(0);

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
      const dist = distToRoutePath(bus.lat, bus.lng, bus.route);
      if (dist > GEOFENCE_RADIUS_M) {
        breached.add(bus.id);
        newAlerts.push({
          busId: bus.id, vehicle: bus.vehicle, route: bus.route,
          driver: bus.driver, distM: Math.round(dist),
          detectedAt: new Date().toISOString(), dismissed: false,
        });
      }
    });

    // Keep TRP-047 in demo breach regardless
    breached.add('TRP-047');

    setGeofencedIds(breached);
    setGeoAlerts((prev) => {
      const existingIds = new Set(prev.filter((a) => !a.dismissed).map((a) => a.busId));
      const fresh = newAlerts.filter((a) => !existingIds.has(a.busId) && a.busId !== 'TRP-047');
      return [...prev.filter((a) => a.dismissed || breached.has(a.busId)), ...fresh];
    });
  }, []);

  // Simulate real-time bus movement for Ongoing buses
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setBuses((prev) =>
        prev.map((bus) => {
          if (bus.status !== 'Ongoing' || (bus._dlat === 0 && bus._dlng === 0)) {
            return bus;
          }
          // Mark this bus as recently seen
          lastSeenRef.current[bus.id] = Date.now();
          // Slight jitter so it looks organic
          const jitter = (Math.random() - 0.5) * 0.00004;
          const movedBus = {
            ...bus,
            lat: bus.lat + bus._dlat + jitter,
            lng: bus.lng + bus._dlng + jitter,
          };
          return enrichBus(movedBus);
        })
      );

      // Geofence check every 5 ticks (~12.5 s)
      if (tickRef.current % 5 === 0) {
        setBuses((current) => { runGeofenceCheck(current); return current; });
      }

      // Signal loss check every 8 ticks (~20 s)
      if (tickRef.current % 8 === 0) {
        const now  = Date.now();
        const lost = new Set();
        const newAlerts = [];
        INITIAL_BUSES.forEach((b) => {
          if (b.status === 'Scheduled') return;
          const lastSeen = lastSeenRef.current[b.id] ?? 0;
          if (now - lastSeen > SIGNAL_LOSS_MS) {
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
    }, 2500);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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
                  ? (STATUS_COLOR[f] || '#2563EB')
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
                      {alert.route} · Last GPS ping: <strong>{staleLabel}</strong> · No updates for {Math.round(SIGNAL_LOSS_MS / 1000)}s+
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
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Active buses',   value: counts.Ongoing,   color: '#10B981', bg: '#ECFDF5' },
          { label: 'Delayed',        value: counts.Delayed,   color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Scheduled',      value: counts.Scheduled, color: '#64748B', bg: '#F1F5F9' },
          { label: 'Total passengers',
            value: buses.reduce((s, b) => s + b.passengerCount, 0),
            color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Seats available',
            value: buses.reduce((s, b) => s + b.seatInfo.available, 0),
            color: '#059669', bg: '#ECFDF5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ padding: '8px 16px', borderRadius: 10,
                                     backgroundColor: bg, border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Map + list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, height: 560 }}>

        {/* Map panel */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid #F1F5F9' }}>
            {/* Row 1 — title + heatmap toggle */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 }}>
                GPS map — Lebanon
                {showHeatmap && <span style={{ fontSize: 11, fontWeight: 500, color: '#DC2626', marginLeft: 8 }}>· Heatmap active</span>}
              </span>
              <button
                onClick={() => setShowHeatmap((h) => !h)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 13px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${showHeatmap ? '#FCA5A5' : '#E2E8F0'}`,
                  background: showHeatmap ? '#FEF2F2' : '#F8FAFC',
                  color: showHeatmap ? '#DC2626' : '#64748B',
                  transition: 'all .15s',
                }}
              >
                🌡️ {showHeatmap ? 'Heatmap ON' : 'Heatmap'}
              </button>
            </div>

            {/* Row 2 — context-sensitive legend */}
            {showHeatmap ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>Low</span>
                <div style={{
                  height: 6, width: 100, borderRadius: 3,
                  background: 'linear-gradient(to right, #10B981, #F59E0B, #DC2626)',
                }} />
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>High density</span>
                {heatmapLoading && (
                  <span style={{ fontSize: 10, color: '#2563EB', marginLeft: 4 }}>Loading…</span>
                )}
                {!heatmapLoading && heatmapFetched && (
                  <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>
                    — {heatmapPoints.length} cells · real GPS data
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 14 }}>
                {[['#10B981', 'Ongoing'], ['#F59E0B', 'Delayed'], ['#94A3B8', 'Scheduled'], ['#7C3AED', 'No signal']].map(([c, l]) => (
                  <span key={l} style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Leaflet map fills the remaining space */}
          <div style={{ flex: 1, position: 'relative' }}>
            <LiveMap
              buses={filteredBuses}
              routes={ROUTES}
              selectedId={selected}
              onSelect={setSelected}
              geofencedIds={geofencedIds}
              signalLostIds={signalLostIds}
              showHeatmap={showHeatmap}
              heatmapPoints={heatmapPoints}
            />
          </div>
        </div>

        {/* Bus list */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9',
                        fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
            {filteredBuses.length === buses.length
              ? `All buses (${buses.length})`
              : `${filter} (${filteredBuses.length})`}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredBuses.map((bus) => (
              <div
                key={bus.id}
                onClick={() => setSelected(bus.id)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #f7f7f7',
                  cursor: 'pointer',
                  background: selected === bus.id ? '#EFF6FF' : 'transparent',
                  borderLeft: selected === bus.id ? '3px solid #2563EB' : '3px solid transparent',
                  transition: 'background .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%',
                                  background: STATUS_COLOR[bus.status], flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#0F172A', flex: 1 }}>
                    {bus.id}
                  </span>
                  <StatusPill status={bus.status} />
                </div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 2, fontWeight: 500 }}>
                  {bus.route} · {bus.routeLabel}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                  <span>{bus.driver}</span>
                  <span>{bus.vehicle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3 }}>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>ETA {bus.trafficInfo.adjustedEta}</span>
                  <span style={{ color: '#555' }}>{bus.seats} · {bus.speed} km/h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, marginTop: 6 }}>
                  <span style={{ color: '#64748B' }}>{bus.trafficInfo.trafficLabel}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: bus.seatInfo.bg, color: bus.seatInfo.color, fontWeight: 700 }}>
                    {bus.seatInfo.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 5 }}>
                  {bus.trafficInfo.hint}
                </div>

                {/* Passenger fill bar */}
                <div style={{ marginTop: 5, height: 3, borderRadius: 2,
                               backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${(bus.passengerCount / bus.capacity) * 100}%`,
                    backgroundColor: bus.passengerCount / bus.capacity > 0.9
                      ? '#ef4444' : bus.passengerCount / bus.capacity > 0.6
                      ? '#f59e0b' : '#22c55e',
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Selected bus detail */}
          {selectedBus && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid #f0f0f0', background: '#fafffe' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8,
                             textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Selected bus details
              </div>
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Passenger app seat estimate</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: selectedBus.seatInfo.bg, color: selectedBus.seatInfo.color }}>
                    {selectedBus.seatInfo.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>
                  Derived from live passenger count camera feed and vehicle capacity.
                </div>
                <div style={{ fontSize: 10, color: '#64748B' }}>
                  Traffic hint: {selectedBus.trafficInfo.hint}
                </div>
              </div>
              {[
                ['Trip ID',  selectedBus.id],
                ['Route',    `${selectedBus.route} — ${selectedBus.routeLabel}`],
                ['Driver',   selectedBus.driver],
                ['Vehicle',  selectedBus.vehicle],
                ['Seats',    selectedBus.seats],
                ['Available', `${selectedBus.seatInfo.available} estimated seats`],
                ['Speed',    `${selectedBus.speed} km/h`],
                ['ETA',      selectedBus.trafficInfo.adjustedEta],
                ['Traffic',  selectedBus.trafficInfo.trafficLabel],
                ['Position', `${selectedBus.lat.toFixed(4)}°N, ${selectedBus.lng.toFixed(4)}°E`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                                       fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#64748B' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', textAlign: 'right',
                                  maxWidth: '60%', wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
