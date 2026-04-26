// pages/LiveTrackingPage.jsx
import { useState, useEffect, useRef } from 'react';
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function LiveTrackingPage() {
  const [buses,    setBuses]    = useState(INITIAL_BUSES);
  const [selected, setSelected] = useState(INITIAL_BUSES[0].id);
  const [filter,   setFilter]   = useState('All');
  const tickRef = useRef(0);

  // Simulate real-time bus movement for Ongoing buses
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setBuses((prev) =>
        prev.map((bus) => {
          if (bus.status !== 'Ongoing' || (bus._dlat === 0 && bus._dlng === 0)) {
            return bus;
          }
          // Slight jitter so it looks organic
          const jitter = (Math.random() - 0.5) * 0.00004;
          return {
            ...bus,
            lat: bus.lat + bus._dlat + jitter,
            lng: bus.lng + bus._dlng + jitter,
          };
        })
      );
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const filteredBuses = filter === 'All'
    ? buses
    : buses.filter((b) => b.status === filter);

  const selectedBus = buses.find((b) => b.id === selected);

  const counts = {
    Ongoing:   buses.filter((b) => b.status === 'Ongoing').length,
    Delayed:   buses.filter((b) => b.status === 'Delayed').length,
    Scheduled: buses.filter((b) => b.status === 'Scheduled').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Live Tracking
          </h1>
          <p style={{ fontSize: 12, color: '#64748B', margin: '3px 0 0' }}>
            Real-time GPS positions — Lebanon · updates every 2.5s
          </p>
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

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'Active buses',   value: counts.Ongoing,   color: '#10B981', bg: '#ECFDF5' },
          { label: 'Delayed',        value: counts.Delayed,   color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Scheduled',      value: counts.Scheduled, color: '#64748B', bg: '#F1F5F9' },
          { label: 'Total passengers',
            value: buses.reduce((s, b) => s + b.passengerCount, 0),
            color: '#2563EB', bg: '#EFF6FF' },
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
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9',
                        display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', flex: 1 }}>
              GPS map — Lebanon (OpenStreetMap)
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['#10B981', 'Ongoing'], ['#F59E0B', 'Delayed'], ['#94A3B8', 'Scheduled']].map(([c, l]) => (
                <span key={l} style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Leaflet map fills the remaining space */}
          <div style={{ flex: 1, position: 'relative' }}>
            <LiveMap
              buses={filteredBuses}
              routes={ROUTES}
              selectedId={selected}
              onSelect={setSelected}
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
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>ETA {bus.eta}</span>
                  <span style={{ color: '#555' }}>{bus.seats} · {bus.speed} km/h</span>
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
              {[
                ['Trip ID',  selectedBus.id],
                ['Route',    `${selectedBus.route} — ${selectedBus.routeLabel}`],
                ['Driver',   selectedBus.driver],
                ['Vehicle',  selectedBus.vehicle],
                ['Seats',    selectedBus.seats],
                ['Speed',    `${selectedBus.speed} km/h`],
                ['ETA',      selectedBus.eta],
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
