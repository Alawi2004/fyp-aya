// pages/DashboardPage.jsx — Premium Fleet Management Dashboard
import { useState, useEffect } from "react";
import {
  Bus, Users, MapPin, TrendingUp, Star,
  AlertTriangle, Clock, Fuel, Activity,
  BarChart3, ArrowUpRight, ArrowDownRight,
  CheckCircle, XCircle, Zap,
} from "lucide-react";
import { Panel }    from "../components/Panel";
import { StatCard } from "../components/StatCard";
import DashboardMap from "../components/map/DashboardMap";
import { TripModal } from "../components/TripModal";
import { getDashboardStats, getDashboardOverview, getEmergencyAlerts, createTrip, getRoutes, getDrivers, getVehicles } from "../api/endpoints";

const ALERT_CFG = {
  emergency: { dot: "#EF4444", bg: "#FEF2F2", color: "#DC2626", label: "Emergency" },
  delay:     { dot: "#F59E0B", bg: "#FFFBEB", color: "#D97706", label: "Warning"   },
  info:      { dot: "#3B82F6", bg: "#EFF6FF", color: "#2563EB", label: "Info"      },
};


// ─── Mini helpers ─────────────────────────────────────────────────────────────

function Stars({ rating }) {
  return (
    <span style={{ fontSize: 12, letterSpacing: 1.5 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? "#F59E0B" : "#E2E8F0" }}>★</span>
      ))}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Active:    "status-active",
    Ongoing:   "status-ongoing",
    Delayed:   "status-delayed",
    Idle:      "status-idle",
    Alert:     "status-alert",
    Offline:   "status-offline",
    Scheduled: "status-scheduled",
  };
  return (
    <span className={map[status] || "status-idle"} style={{
      fontSize:     10,
      fontWeight:   700,
      padding:      "3px 9px",
      borderRadius: 20,
      letterSpacing: ".04em",
      whiteSpace:   "nowrap",
    }}>
      {status}
    </span>
  );
}

function FuelBar({ pct }) {
  const color = pct > 50 ? "#10B981" : pct > 20 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{
        width: 64, height: 6, background: "#F1F5F9",
        borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       "100%",
          background:   color,
          borderRadius: 3,
          transition:   "width .5s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function BarChartInline({ data, valueKey, color, height = 80 }) {
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
      {data.map((d, i) => {
        const h   = Math.round((d[valueKey] / max) * (height - 18));
        const isCur = i === 5;
        return (
          <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{
              width:          "100%",
              height:         h,
              borderRadius:   "4px 4px 0 0",
              background:     isCur
                ? color
                : `${color}55`,
              transition:     "height .5s ease",
              cursor:         "default",
            }} />
            <span style={{ fontSize: 9, color: isCur ? "#0F172A" : "#94A3B8", fontWeight: isCur ? 700 : 400 }}>
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadChart({ data }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
      {data.map(({ label, pct, current, future }) => (
        <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            width:        "100%",
            height:       Math.round(pct * 0.62),
            borderRadius: "4px 4px 0 0",
            background:   current ? "#2563EB" : future ? "#CBD5E1" : "#93C5FD",
            opacity:      future ? .5 : 1,
            transition:   "height .5s ease",
          }} />
          <span style={{ fontSize: 9, color: current ? "#2563EB" : "#94A3B8", fontWeight: current ? 700 : 400 }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage({ onNavigate }) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const EMPTY_STATS = { totalVehicles: 0, activeVehicles: 0, activeTrips: 0, totalUsers: 0, avgRating: 0, todayRevenue: 0, totalDrivers: 0, pendingComplaints: 0 };
  const [stats,     setStats]     = useState(EMPTY_STATS);
  const [alerts,    setAlerts]    = useState([]);
  const [trips,     setTrips]     = useState([]);
  const [vehicles,  setVehicles]  = useState([]);
  const [fleet,     setFleet]     = useState([]);
  const [drivers,   setDrivers]   = useState([]);
  const [week,      setWeek]      = useState([]);
  const [loadHours, setLoadHours] = useState([]);
  const [revSummary,   setRevSummary]   = useState({ this_week: 0, last_week: 0, change_pct: 0 });
  const [emergencies,  setEmergencies]  = useState([]);
  const [tripModal,    setTripModal]    = useState(null);
  const [routeOpts,    setRouteOpts]    = useState([]);
  const [driverOpts,   setDriverOpts]   = useState([]);
  const [vehicleOpts,  setVehicleOpts]  = useState([]);

  useEffect(() => {
    getDashboardStats()
      .then(d => setStats(d))
      .catch(() => {});

    getDashboardOverview()
      .then(d => {
        if (d.alerts)     setAlerts(d.alerts ?? []);
        if (d.trips)      setTrips(d.trips ?? []);
        if (d.vehicles)   setVehicles(d.vehicles ?? []);
        if (d.fleet)      setFleet(d.fleet ?? []);
        if (d.drivers)    setDrivers(d.drivers ?? []);
        if (d.week)       setWeek(d.week ?? []);
        if (d.load_hours) setLoadHours(d.load_hours ?? []);
        if (d.rev_summary) setRevSummary(d.rev_summary);
      })
      .catch(() => {});

    getEmergencyAlerts()
      .then(d => { if (Array.isArray(d)) setEmergencies(d); })
      .catch(() => {});

    getRoutes().then(d => setRouteOpts(Array.isArray(d) ? d : [])).catch(() => {});
    getDrivers().then(d => setDriverOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});
    getVehicles().then(d => setVehicleOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});
  }, []);

  async function handleSaveTrip(form) {
    try {
      await createTrip({
        route_id:   form.route_id   ?? null,
        driver_id:  form.driver_id  ?? null,
        vehicle_id: form.vehicle_id ?? null,
        start_time: `${form.date}T${form.time}:00`,
        status:     form.status.toLowerCase(),
      });
      getDashboardStats().then(d => setStats(d)).catch(() => {});
      return null;
    } catch (err) {
      return err?.message ?? "Failed to create trip.";
    }
  }

  const KPI = [
    {
      label:    "Total Fleet",
      value:    String(stats.totalVehicles ?? fleet[0]?.total ?? "—"),
      delta:    `${fleet.find(f => f.label === "Maintenance")?.count ?? "?"} in maintenance`,
      up:       null,
      accent:   "#2563EB",
      gradient: "linear-gradient(135deg,#DBEAFE,#EFF6FF)",
      icon:     <Bus size={20} color="#2563EB" strokeWidth={2} />,
    },
    {
      label:    "Active Vehicles",
      value:    String(stats.activeVehicles),
      delta:    "on road now",
      up:       true,
      accent:   "#10B981",
      gradient: "linear-gradient(135deg,#D1FAE5,#ECFDF5)",
      icon:     <Activity size={20} color="#10B981" strokeWidth={2} />,
    },
    {
      label:    "Active Trips",
      value:    String(stats.activeTrips),
      delta:    "in progress",
      up:       null,
      accent:   "#3B82F6",
      gradient: "linear-gradient(135deg,#BFDBFE,#EFF6FF)",
      icon:     <MapPin size={20} color="#3B82F6" strokeWidth={2} />,
    },
    {
      label:    "Total Users",
      value:    stats.totalUsers.toLocaleString(),
      delta:    "+12 this week",
      up:       true,
      accent:   "#8B5CF6",
      gradient: "linear-gradient(135deg,#EDE9FE,#F5F3FF)",
      icon:     <Users size={20} color="#8B5CF6" strokeWidth={2} />,
    },
    {
      label:    "Avg Rating",
      value:    Number(stats.avgRating).toFixed(1),
      delta:    "out of 5 stars",
      up:       true,
      accent:   "#F59E0B",
      gradient: "linear-gradient(135deg,#FDE68A,#FFFBEB)",
      icon:     <Star size={20} color="#F59E0B" strokeWidth={2} />,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fadeIn .3s ease" }}>

      {/* ── 1. Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 4 }}>
            {today}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.5px" }}>
            {greeting}, Admin
          </h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0", fontWeight: 400 }}>
            Here's what's happening with your fleet today.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Alert pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 14px", borderRadius: 10,
            background: "#FEF2F2", border: "1px solid #FECACA",
          }}>
            <AlertTriangle size={14} color="#EF4444" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>{alerts.filter(a => a.type !== "info").length} Active Alerts</span>
          </div>

          <button
            className="btn-primary"
            onClick={() => setTripModal(false)}
            style={{
              background:   "#2563EB",
              color:        "#fff",
              border:       "none",
              borderRadius: 10,
              padding:      "10px 18px",
              fontSize:     13,
              fontWeight:   700,
              cursor:       "pointer",
              display:      "flex",
              alignItems:   "center",
              gap:          7,
              boxShadow:    "0 4px 14px rgba(37,99,235,.3)",
            }}
          >
            <Zap size={14} />
            New Trip
          </button>
        </div>
      </div>

      {/* ── 2. KPI cards (5 col) ───────────────────────────────── */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(5, minmax(0,1fr))",
        gap:                 14,
      }}>
        {KPI.map((k, i) => (
          <div key={k.label} style={{ animationDelay: `${i * 70}ms` }}>
            <StatCard {...k} />
          </div>
        ))}
      </div>

      {/* ── 2.5. Emergency Alert Tray ──────────────────────────── */}
      {(() => {
        const active   = emergencies.filter(e => e.status === "active");
        const hasActive = active.length > 0;

        function fmtAgo(dt) {
          if (!dt) return "—";
          const min = Math.floor((Date.now() - new Date(dt)) / 60000);
          if (min < 1)  return "just now";
          if (min < 60) return `${min}m ago`;
          const h = Math.floor(min / 60);
          if (h < 24)   return `${h}h ago`;
          return `${Math.floor(h / 24)}d ago`;
        }

        return (
          <div style={{
            border:       `2px solid ${hasActive ? "#FECACA" : "#A7F3D0"}`,
            borderRadius: 14,
            background:   hasActive ? "#FFF5F5" : "#F0FDF4",
            overflow:     "hidden",
            ...(hasActive ? { animation: "pulse-border 2s ease-in-out infinite" } : {}),
          }}>
            {/* Header */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              gap:            10,
              padding:        "12px 18px",
              background:     hasActive ? "#FEF2F2" : "#ECFDF5",
              borderBottom:   `1px solid ${hasActive ? "#FECACA" : "#A7F3D0"}`,
            }}>
              <AlertTriangle size={16} color={hasActive ? "#EF4444" : "#10B981"} />
              <span style={{ fontSize: 13, fontWeight: 700, color: hasActive ? "#B91C1C" : "#065F46", flex: 1 }}>
                Emergency Alerts
              </span>
              {hasActive ? (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: "#EF4444", color: "#fff",
                }}>
                  {active.length} ACTIVE
                </span>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                  background: "#D1FAE5", color: "#065F46",
                }}>
                  All clear
                </span>
              )}
            </div>

            {!hasActive && emergencies.length === 0 ? (
              <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>✓</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>No emergency alerts</div>
                  <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 2 }}>All drivers are operating normally.</div>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: hasActive ? "#FEF2F2" : "#ECFDF5" }}>
                      {["Status", "Driver", "Vehicle", "Trip", "Message", "GPS", "Time", ""].map(h => (
                        <th key={h} style={{
                          padding: "8px 14px", textAlign: "left",
                          fontSize: 10, fontWeight: 700, color: hasActive ? "#B91C1C" : "#065F46",
                          textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap",
                          borderBottom: `1px solid ${hasActive ? "#FECACA" : "#A7F3D0"}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emergencies.map((e, i) => {
                      const isActive = e.status === "active";
                      return (
                        <tr key={e.id} style={{
                          borderBottom: i < emergencies.length - 1 ? `1px solid ${hasActive ? "#FEE2E2" : "#D1FAE5"}` : "none",
                          background: isActive
                            ? (i % 2 === 0 ? "#FFF5F5" : "#FFF0F0")
                            : (i % 2 === 0 ? "#F8FAFC" : "#F0FDF4"),
                          opacity: isActive ? 1 : 0.7,
                        }}>
                          <td style={{ padding: "10px 14px" }}>
                            {isActive ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
                                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#EF4444", position: "relative", zIndex: 1 }} />
                                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#EF4444", animation: "pulse-ring 1.5s ease-out infinite" }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>Active</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#10B981" }}>✓ Resolved</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 12 }}>{e.driver_name ?? "—"}</div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563EB", fontSize: 12 }}>{e.vehicle ?? "—"}</span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B" }}>{e.trip_ref ?? "—"}</span>
                          </td>
                          <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                            <span style={{ fontSize: 12, color: isActive ? "#B91C1C" : "#475569", fontWeight: isActive ? 600 : 400 }}>
                              {e.message}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {e.latitude != null && e.longitude != null ? (
                              <span style={{ fontSize: 10, color: "#64748B", fontFamily: "monospace" }}>
                                {Number(e.latitude).toFixed(4)}, {Number(e.longitude).toFixed(4)}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: "#CBD5E1" }}>No GPS</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>
                            {fmtAgo(e.created_at)}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {isActive && (
                              <button
                                onClick={() => setEmergencies(prev => prev.map(x => x.id === e.id ? { ...x, status: "resolved" } : x))}
                                style={{
                                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, border: "none",
                                  background: "#ECFDF5", color: "#059669", cursor: "pointer",
                                }}
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 3. Map + Alerts ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>

        <Panel
          title="Live GPS Map — Lebanon"
          action="Full Screen ↗"
          onAction={() => onNavigate?.("live")}
          icon={<MapPin size={14} color="#2563EB" />}
          accent="#2563EB"
          noPad
        >
          <div style={{ padding: "14px 18px" }}>
            <DashboardMap onFullScreen={() => onNavigate?.("live")} />
          </div>
        </Panel>

        <Panel
          title="Incidents & Alerts"
          action="Mark all read"
          icon={<AlertTriangle size={14} color="#F59E0B" />}
          accent="#F59E0B"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {alerts.map((a, i) => {
              const c = ALERT_CFG[a.type];
              return (
                <div key={i} style={{
                  display:      "flex",
                  gap:          12,
                  alignItems:   "flex-start",
                  padding:      "10px 12px",
                  borderRadius: 10,
                  background:   i === 0 ? c.bg : "transparent",
                  cursor:       "pointer",
                  transition:   "background .12s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = c.bg}
                  onMouseLeave={e => e.currentTarget.style.background = i === 0 ? c.bg : "transparent"}
                >
                  <div style={{
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   c.dot,
                    flexShrink:   0,
                    marginTop:    5,
                  }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: c.color,
                                   textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {c.label}
                    </span>
                    <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.45, marginTop: 2 }}>
                      {a.text}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap", marginTop: 2 }}>
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Summary bar */}
          <div style={{
            marginTop:    14,
            paddingTop:   12,
            borderTop:    "1px solid #F1F5F9",
            display:      "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap:          8,
          }}>
            {[
              { label: "Critical", count: alerts.filter(a => a.type === "emergency").length, color: "#EF4444", bg: "#FEF2F2" },
              { label: "Warnings", count: alerts.filter(a => a.type === "delay").length,     color: "#F59E0B", bg: "#FFFBEB" },
              { label: "Info",     count: alerts.filter(a => a.type === "info").length,       color: "#3B82F6", bg: "#EFF6FF" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{
                textAlign: "center", padding: "8px 4px",
                borderRadius: 8, background: bg,
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 9, color, fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── 4. Active trips + Sidebar widgets ─────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>

        {/* Trips table */}
        <Panel
          title="Active Trips"
          action="View all"
          onAction={() => onNavigate?.("trips")}
          icon={<MapPin size={14} color="#2563EB" />}
          accent="#2563EB"
          noPad
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Trip ID", "Route", "Occupancy", "ETA", "Status"].map(h => (
                    <th key={h} style={{
                      padding:       "10px 16px",
                      textAlign:     "left",
                      fontSize:      10,
                      fontWeight:    700,
                      color:         "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: ".06em",
                      borderBottom:  "1px solid #F1F5F9",
                      whiteSpace:    "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trips.map((t, i) => (
                  <tr key={t.id} className="table-row" style={{
                    borderBottom: i < trips.length - 1 ? "1px solid #F8FAFC" : "none",
                    cursor: "pointer",
                  }}>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700,
                                     color: "#2563EB", fontSize: 12 }}>
                        {t.id}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 12 }}>{t.route}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{t.name}</div>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {(() => {
                          const [used, cap] = t.seats.split("/").map(Number);
                          const pct = (used / cap) * 100;
                          return (
                            <>
                              <div style={{ width: 48, height: 4, background: "#F1F5F9",
                                            borderRadius: 2, overflow: "hidden" }}>
                                <div style={{
                                  width:      `${pct}%`,
                                  height:     "100%",
                                  background: pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#10B981",
                                  borderRadius: 2,
                                }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>
                                {t.seats}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={11} color="#94A3B8" />
                        <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{t.eta}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Right: Load + Fleet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <Panel
            title="Passenger Load — Today"
            icon={<BarChart3 size={14} color="#2563EB" />}
            accent="#2563EB"
          >
            <LoadChart data={loadHours} />
            <div style={{ display: "flex", justifyContent: "space-between",
                          marginTop: 10, paddingTop: 8, borderTop: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>
                Peak: {loadHours.reduce((p, h) => h.pct > p.pct ? h : p, loadHours[0])?.label ?? "—"}
              </span>
              <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 600 }}>
                ↑ {loadHours.find(h => h.current)?.pct ?? 0}% capacity now
              </span>
            </div>
          </Panel>

          <Panel
            title="Fleet Status"
            icon={<Bus size={14} color="#2563EB" />}
            accent="#2563EB"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {fleet.map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: f.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: "#475569", width: 90, flexShrink: 0 }}>
                    {f.label}
                  </span>
                  <div style={{
                    flex: 1, height: 7, background: "#F1F5F9",
                    borderRadius: 4, overflow: "hidden",
                  }}>
                    <div style={{
                      width:        `${(f.count / f.total) * 100}%`,
                      height:       "100%",
                      background:   f.color,
                      borderRadius: 4,
                      transition:   "width .6s ease",
                    }} />
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800, color: f.color,
                    minWidth: 18, textAlign: "right",
                  }}>
                    {f.count}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop:    12,
              paddingTop:   10,
              borderTop:    "1px solid #F1F5F9",
              display:      "flex",
              justifyContent: "space-between",
              alignItems:   "center",
            }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Total fleet</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{fleet[0]?.total ?? "—"} vehicles</span>
            </div>
          </Panel>
        </div>
      </div>

      {/* ── 5. Drivers + Revenue chart ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        <Panel
          title="Driver Leaderboard"
          action="View all"
          onAction={() => onNavigate?.("drivers")}
          icon={<Star size={14} color="#F59E0B" />}
          accent="#F59E0B"
        >
          {drivers.map((d, i) => (
            <div key={d.name} style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              padding:      "10px 0",
              borderBottom: i < drivers.length - 1 ? "1px solid #F8FAFC" : "none",
            }}>
              {/* Rank */}
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                background: i === 0 ? "#FEF3C7" : "#F8FAFC",
                color:      i === 0 ? "#D97706" : "#94A3B8",
                fontSize:   11, fontWeight: 800,
                display:    "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </span>

              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, hsl(${i * 60 + 200},70%,60%), hsl(${i * 60 + 240},70%,50%))`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}>
                {d.initials}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{d.trips} trips today</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <Stars rating={d.rating} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{d.rating}</span>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: d.change.startsWith("+") ? "#10B981" : "#EF4444",
                  marginTop: 2,
                }}>
                  {d.change}
                </div>
              </div>
            </div>
          ))}
        </Panel>

        <Panel
          title="Weekly Revenue"
          icon={<TrendingUp size={14} color="#10B981" />}
          accent="#10B981"
        >
          <BarChartInline data={week} valueKey="rev" color="#2563EB" height={90} />

          <div style={{
            display:     "flex",
            justifyContent: "space-between",
            marginTop:   14,
            paddingTop:  12,
            borderTop:   "1px solid #F1F5F9",
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500, marginBottom: 3 }}>
                This week
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.5px" }}>
                ${revSummary.this_week.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500, marginBottom: 3 }}>
                vs last week
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800,
                color: revSummary.change_pct >= 0 ? "#10B981" : "#EF4444",
                letterSpacing: "-.5px",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {revSummary.change_pct >= 0
                  ? <ArrowUpRight size={18} color="#10B981" />
                  : <ArrowDownRight size={18} color="#EF4444" />}
                {revSummary.change_pct >= 0 ? "+" : ""}{revSummary.change_pct}%
              </div>
            </div>
          </div>

          {/* Trip volume secondary chart */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
              Daily trip volume
            </div>
            <BarChartInline data={week} valueKey="trips" color="#10B981" height={50} />
          </div>
        </Panel>
      </div>

      {/* ── 6. Live vehicle tracking table ─────────────────────── */}
      <Panel
        title="Live Vehicle Tracking"
        action="Open live map"
        onAction={() => onNavigate?.("live")}
        icon={<Activity size={14} color="#2563EB" />}
        accent="#2563EB"
        noPad
      >
        {/* Header strip */}
        <div style={{
          padding:    "10px 18px",
          background: "#F8FAFC",
          display:    "flex",
          alignItems: "center",
          gap:        8,
          borderBottom: "1px solid #F1F5F9",
        }}>
          <div style={{ position: "relative", width: 9, height: 9 }}>
            <div style={{
              width: 9, height: 9, borderRadius: "50%",
              background: "#10B981",
              position: "relative", zIndex: 1,
            }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "#10B981",
              animation: "pulse-ring 1.5s ease-out infinite",
            }} />
          </div>
          <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>
            {vehicles.length} vehicles tracked · Updated live
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#FAFAFA" }}>
                {["Vehicle", "Driver", "Speed", "Location", "Fuel", "Status"].map(h => (
                  <th key={h} style={{
                    padding:       "10px 16px",
                    textAlign:     "left",
                    fontSize:      10,
                    fontWeight:    700,
                    color:         "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    borderBottom:  "1px solid #F1F5F9",
                    whiteSpace:    "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr key={v.id} className="table-row" style={{
                  borderBottom: i < vehicles.length - 1 ? "1px solid #F8FAFC" : "none",
                  cursor: "pointer",
                }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: v.status === "Active"
                          ? "linear-gradient(135deg,#DBEAFE,#EFF6FF)"
                          : v.status === "Alert"
                          ? "linear-gradient(135deg,#FEE2E2,#FEF2F2)"
                          : "linear-gradient(135deg,#F1F5F9,#F8FAFC)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Bus size={15}
                          color={v.status === "Active" ? "#2563EB" : v.status === "Alert" ? "#EF4444" : "#94A3B8"}
                          strokeWidth={2}
                        />
                      </div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                        {v.id}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>{v.driver}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {v.speed > 0 ? (
                        <>
                          <Activity size={12} color="#10B981" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{v.speed}</span>
                          <span style={{ fontSize: 10, color: "#94A3B8" }}>km/h</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>Stopped</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={11} color="#94A3B8" />
                      <span style={{ fontSize: 11, color: "#475569" }}>{v.location}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {v.fuel != null
                      ? <FuelBar pct={v.fuel} />
                      : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {tripModal !== null && (
        <TripModal
          trip={tripModal || null}
          allTrips={[]}
          onClose={() => setTripModal(null)}
          onSave={handleSaveTrip}
          routeOpts={routeOpts}
          driverOpts={driverOpts}
          vehicleOpts={vehicleOpts}
        />
      )}

    </div>
  );
}
