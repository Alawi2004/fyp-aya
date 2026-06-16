import { useState, useEffect, useCallback } from 'react';
import { useWebSocketCamera } from '../hooks/useWebSocketCamera';
import { useCounterData }     from '../hooks/useCounterData';
import { CAMERA_REST_URL }    from '../config/camera';
import { getVehicles }        from '../api/endpoints';

const CAMERA_SERVER_REST = CAMERA_REST_URL;

// ─── Camera offline placeholder ────────────────────────────────────────────────

function CameraOffline({ label = 'Camera Offline' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0a0f14' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round">
        <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        <line x1="1" y1="1" x2="23" y2="23" stroke="#4b5563"/>
      </svg>
      <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 10, color: '#374151' }}>Start camera server to connect</span>
    </div>
  );
}

// ─── Camera control button ─────────────────────────────────────────────────────

function CamIconBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: '1px solid #d1d5db', borderRadius: 5,
      cursor: 'pointer', padding: '2px 7px', fontSize: 13, color: '#6b7280',
      lineHeight: 1, display: 'flex', alignItems: 'center', transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none';    e.currentTarget.style.color = '#6b7280'; }}
    >
      {children}
    </button>
  );
}

// ─── Fullscreen overlay ────────────────────────────────────────────────────────

function CamMaxOverlay({ title, onClose, onMinimize, children }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const overlayBtn = (onClick, label, tip) => (
    <button onClick={onClick} title={tip} style={{
      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 6, color: '#e2e8f0', cursor: 'pointer',
      fontSize: 13, padding: '5px 13px', fontWeight: 500, transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
    >{label}</button>
  );

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.93)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 1400, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 10, flexShrink: 0 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>{title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onMinimize && overlayBtn(onMinimize, '— Minimize', 'Collapse panel')}
            {overlayBtn(onClose, '✕ Close', 'Exit fullscreen (Esc)')}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '16/9', maxHeight: '100%',
                          overflow: 'hidden', borderRadius: 10, position: 'relative' }}>
              {children}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: '#374151', flexShrink: 0 }}>
          Esc · click outside · or — Minimize to collapse
        </div>
      </div>
    </div>
  );
}

// ─── Passenger camera panel ────────────────────────────────────────────────────

function PassengerCameraPanel({ busId, counter }) {
  const { frameUrl, connected, status } = useWebSocketCamera(busId, 'passenger');
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const isLive = connected && !!frameUrl;

  const badge = connected && frameUrl
    ? { text: '● LIVE',         bg: '#dcfce7', color: '#166534', border: '#86efac' }
    : status === 'connecting'
    ? { text: '◉ CONNECTING',   bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' }
    : frameUrl
    ? { text: '✕ DISCONNECTED', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
    : { text: '○ OFFLINE',      bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };

  return (
    <>
      {maximized && (
        <CamMaxOverlay title={`Passenger Camera — ${busId}`}
          onClose={() => setMaximized(false)}
          onMinimize={() => { setMaximized(false); setCollapsed(true); }}>
          {isLive ? (
            <>
              <img src={frameUrl} alt="passenger cam"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', backgroundColor: '#0a0f14' }} />
              <div style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,.70)',
                            padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                {busId} · 3-ZONE COUNTER
              </div>
            </>
          ) : (
            <CameraOffline label="Passenger Camera Offline" />
          )}
        </CamMaxOverlay>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>
            Passenger Camera — {busId}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>3-ZONE DETECTION</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                           backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
              {badge.text}
            </span>
            <CamIconBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? '▲' : '▼'}
            </CamIconBtn>
            <CamIconBtn onClick={() => setMaximized(true)} title="Maximize">⛶</CamIconBtn>
          </div>
        </div>

        {!collapsed && (
          <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden',
                        border: `2px solid ${isLive ? '#059669' : '#1e293b'}`,
                        boxShadow: isLive ? '0 0 18px #05966933' : 'none', backgroundColor: '#0a0f14' }}>
            {isLive ? (
              <>
                <img src={frameUrl} alt="passenger cam"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                <div style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,.70)',
                              padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                  {busId} · 3-ZONE COUNTER
                </div>
              </>
            ) : (
              <CameraOffline label="Passenger Camera Offline" />
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'On Bus',  value: counter.on_bus,  color: '#059669', bg: '#f0fdf4', border: '#86efac' },
            { label: 'Entered', value: counter.entered, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Exited',  value: counter.exited,  color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ padding: '8px 6px', borderRadius: 8, textAlign: 'center',
                                      backgroundColor: bg, border: `1px solid ${border}` }}>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 2, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Fleet bus selector ────────────────────────────────────────────────────────

function BusSelectorPanel({ buses, selectedBusId, onSelect, onRefresh, loading }) {
  const active   = buses.filter(b => b.active !== false);
  const inactive = buses.filter(b => b.active === false);

  const BusCard = ({ bus }) => {
    const selected = bus.bus_id === selectedBusId;
    const isActive = bus.active !== false;
    return (
      <button onClick={() => isActive && onSelect(bus.bus_id)} style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '9px 11px', borderRadius: 9, textAlign: 'left',
        cursor: isActive ? 'pointer' : 'not-allowed', opacity: isActive ? 1 : 0.55,
        border: selected ? '2px solid #3b82f6' : isActive ? '2px solid #e5e7eb' : '2px solid #d1d5db',
        backgroundColor: selected ? '#eff6ff' : isActive ? '#fff' : '#f3f4f6',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
        transition: 'all .15s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: selected ? '#1d4ed8' : isActive ? '#111827' : '#9ca3af' }}>
            {bus.bus_id}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8,
                         backgroundColor: isActive ? '#dcfce7' : '#f3f4f6',
                         color: isActive ? '#166534' : '#9ca3af',
                         border: `1px solid ${isActive ? '#86efac' : '#d1d5db'}` }}>
            {isActive ? '● Active' : '○ Offline'}
          </span>
        </div>
        <div style={{ fontSize: 10, color: isActive ? '#6b7280' : '#b0b7c3',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bus.driver || '—'} · {bus.route || '—'}
        </div>
        {isActive && (
          <div style={{ fontSize: 10, fontWeight: 600, color: bus.on_bus > 0 ? '#059669' : '#9ca3af' }}>
            {bus.on_bus > 0 ? `${bus.on_bus} passengers` : 'Empty'}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Fleet ({buses.length})
        </span>
        <button onClick={onRefresh} title="Refresh"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', padding: 2 }}>
          {loading ? '⏳' : '↻'}
        </button>
      </div>
      {active.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 1 }}>
            ● Active ({active.length})
          </div>
          {active.map(bus => <BusCard key={bus.bus_id} bus={bus} />)}
        </>
      )}
      {inactive.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 6, marginBottom: 1 }}>
            ○ Inactive ({inactive.length})
          </div>
          {inactive.map(bus => <BusCard key={bus.bus_id} bus={bus} />)}
        </>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CameraPage() {
  const [buses,         setBuses]         = useState([]);
  const [busesLoading,  setBusesLoading]  = useState(false);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [showEvents,    setShowEvents]    = useState(false);
  const [vehicles,      setVehicles]      = useState([]);

  const { counter, events, health, resetCounter } = useCounterData(selectedBusId, 1500);
  const selectedBus   = buses.find(b => b.bus_id === selectedBusId);
  const camServerOnline = health?.status === 'ok';

  // Backend fleet stats
  const totalVehicles  = vehicles.length;
  const activeVehicles = vehicles.filter(v => v.status?.toLowerCase() === 'active').length;
  const totalOnBus     = buses.reduce((s, b) => s + (b.on_bus || 0), 0);

  const fetchBuses = useCallback(async () => {
    setBusesLoading(true);

    // 1. Backend DB is the source of truth for the full fleet
    let dbVehicles = [];
    try {
      const d = await getVehicles();
      dbVehicles = Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [];
    } catch {}
    setVehicles(dbVehicles);

    // 2. Camera server provides live on_bus counts for registered buses
    let camBuses = [];
    try {
      const res = await fetch(`${CAMERA_SERVER_REST}/api/buses`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        camBuses = Array.isArray(data.buses) ? data.buses : [];
      }
    } catch { /* camera server offline */ }

    // 3. Build selector list from ALL backend vehicles, augmented with live camera data
    const merged = dbVehicles.map(v => {
      const plateId = v.plate_number || String(v.vehicle_id ?? v.id ?? '');
      const cam = camBuses.find(b => b.bus_id === plateId);
      return {
        bus_id:       plateId,
        driver:       cam?.driver   || v.driver_name   || v.assigned_driver || '—',
        route:        cam?.route    || v.route_name    || v.assigned_route  || '—',
        on_bus:       cam?.on_bus   ?? 0,
        capacity:     cam?.capacity || v.capacity      || 50,
        active:       (v.status || '').toLowerCase() === 'active',
        vehicle_type: v.vehicle_type || v.type         || 'Bus',
      };
    });

    // Also include any camera-only buses not in the DB
    camBuses.forEach(cb => {
      if (!merged.find(m => m.bus_id === cb.bus_id)) {
        merged.push({
          bus_id: cb.bus_id, driver: cb.driver || '—', route: cb.route || '—',
          on_bus: cb.on_bus || 0, capacity: cb.capacity || 50,
          active: cb.active !== false, vehicle_type: 'Bus',
        });
      }
    });

    setBuses(merged);
    if (!selectedBusId && merged.length > 0) {
      const first = merged.find(b => b.active) || merged[0];
      if (first) setSelectedBusId(first.bus_id);
    }
    setBusesLoading(false);
  }, [selectedBusId]);

  // Register a vehicle with the camera server so it gets a live feed,
  // then update the selected bus — fire-and-forget, falls back to demo mode
  const handleSelectBus = useCallback((busId) => {
    setSelectedBusId(busId);
    fetch(`${CAMERA_SERVER_REST}/api/bus/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bus_id: busId, passenger_source: 0, driver_source: 0, capacity: 50 }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  const handleReset = async () => {
    if (window.confirm(`Reset passenger counter for ${selectedBusId}?`)) {
      await resetCounter();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: '2px solid #e5e7eb', paddingBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
            Passenger Counter
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
            Live 3-zone entry/exit detection · {totalVehicles} vehicles in fleet
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        backgroundColor: camServerOnline ? '#f0fdf4' : '#f9fafb',
                        color: camServerOnline ? '#166534' : '#6b7280',
                        border: `1px solid ${camServerOnline ? '#86efac' : '#d1d5db'}` }}>
            {camServerOnline ? '● Camera Server Online' : '○ Demo Mode'}
          </div>
          {selectedBusId && (
            <button onClick={handleReset} style={{
              padding: '7px 13px', borderRadius: 8, border: '2px solid #3b82f6',
              backgroundColor: '#fff', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            }}>
              ↺ Reset Counter
            </button>
          )}
        </div>
      </div>

      {/* Fleet stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Fleet',     value: totalVehicles,  color: '#2563EB', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Active Vehicles', value: activeVehicles, color: '#059669', bg: '#f0fdf4', border: '#86efac' },
          { label: 'On Bus Now',      value: totalOnBus,     color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
          { label: 'Active Buses',    value: buses.filter(b => b.active).length, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>

        {/* Left: fleet selector */}
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12,
                      border: '1px solid #e5e7eb', height: 'fit-content', position: 'sticky', top: 20 }}>
          <BusSelectorPanel buses={buses} selectedBusId={selectedBusId}
            onSelect={handleSelectBus} onRefresh={fetchBuses} loading={busesLoading} />
        </div>

        {/* Right: passenger camera + data */}
        <div key={selectedBusId} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {!selectedBusId ? (
            <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 48,
                          border: '2px dashed #d1d5db', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🚌</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Select an Active Bus
              </div>
              <div style={{ fontSize: 12 }}>Choose a bus from the fleet list on the left.</div>
            </div>
          ) : (
            <>
              {/* Camera feed */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14,
                            border: '1px solid #e5e7eb' }}>
                <PassengerCameraPanel busId={selectedBusId} counter={counter} />
              </div>

              {/* Status bar */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '11px 16px',
                            border: '1px solid #e5e7eb', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: 'Bus',          value: selectedBusId },
                  { label: 'Driver',       value: selectedBus?.driver  || '—' },
                  { label: 'Route',        value: selectedBus?.route   || '—' },
                  { label: 'On Bus',       value: counter.on_bus },
                  { label: 'Total Entered',value: counter.entered },
                  { label: 'Total Exited', value: counter.exited },
                  { label: 'Active Buses', value: buses.filter(b => b.active).length },
                  { label: 'Data Source',  value: camServerOnline ? 'Camera Server' : 'Demo', color: camServerOnline ? '#059669' : '#6b7280' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: color || '#111827', marginTop: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Passenger events log */}
              <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              marginBottom: showEvents || counter.last_event ? 10 : 0 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#111827' }}>
                    Passenger Events — {selectedBusId}
                  </h3>
                  <button onClick={() => setShowEvents(s => !s)} style={{
                    padding: '4px 12px', borderRadius: 6, border: '2px solid #059669',
                    backgroundColor: showEvents ? '#ecfdf5' : '#fff',
                    color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  }}>
                    {showEvents ? '▲ Hide' : '▼ Show'}
                  </button>
                </div>

                {counter.last_event ? (
                  <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#f9fafb',
                                border: counter.last_event.event === 'ENTER' ? '2px solid #93c5fd' : '2px solid #fca5a5',
                                display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {[
                      { label: 'Event',    value: counter.last_event.event === 'ENTER' ? '↓ ENTRY' : '↑ EXIT',
                        color: counter.last_event.event === 'ENTER' ? '#3b82f6' : '#ef4444' },
                      { label: 'Track ID', value: `#${counter.last_event.tid}`,  color: '#111827' },
                      { label: 'On Bus',   value: counter.last_event.on_bus,     color: '#059669' },
                      { label: 'Time',     value: new Date(counter.last_event.timestamp).toLocaleTimeString(), color: '#6b7280' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 10, backgroundColor: '#f9fafb', borderRadius: 8,
                                textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    No events yet for {selectedBusId}
                  </div>
                )}

                {showEvents && events.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 8 }}>
                    {events.map((evt, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        borderBottom: i < events.length - 1 ? '1px solid #f3f4f6' : 'none',
                        display: 'grid', gridTemplateColumns: '70px 60px 70px 80px 90px',
                        gap: 8, fontSize: 11, alignItems: 'center',
                      }}>
                        <span style={{ color: evt.event === 'ENTER' ? '#3b82f6' : '#ef4444', fontWeight: 700 }}>
                          {evt.event === 'ENTER' ? '↓ ENTER' : '↑ EXIT'}
                        </span>
                        <span style={{ color: '#374151' }}>#{evt.tid}</span>
                        <span style={{ color: '#6b7280' }}>F{evt.frame}</span>
                        <span style={{ color: '#059669', fontWeight: 600 }}>On: {evt.on_bus}</span>
                        <span style={{ color: '#9ca3af' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
