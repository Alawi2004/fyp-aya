// pages/DashboardPage.jsx
import { useState, useEffect } from "react";
import {
  MapPin, Clock,
  AlertTriangle, Zap,
  DollarSign, MessageSquareWarning, UserCheck, Bell, Star,
} from "lucide-react";
import { Panel }     from "../components/Panel";
import DashboardMap  from "../components/map/DashboardMap";
import { TripModal } from "../components/TripModal";
import { useSettings } from "../context/SettingsContext";
import { fmtMoneyRound } from "../utils/fmt";
import {
  getDashboardStats, getDashboardOverview, getEmergencyAlerts,
  createTrip, getRoutes, getDrivers, getVehicles,
  getComplaints, getRatings, getNotifications,
} from "../api/endpoints";

function fmtAgo(dt) {
  if (!dt) return "—";
  const min = Math.floor((Date.now() - new Date(dt)) / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TRIP_STATUS = {
  Ongoing:   { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", dot: "#10B981" },
  Delayed:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", dot: "#F59E0B" },
  Scheduled: { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE", dot: "#3B82F6" },
  Completed: { bg: "#F8FAFC", color: "#94A3B8", border: "#E2E8F0", dot: "#CBD5E1" },
  Active:    { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", dot: "#10B981" },
};

function TripBadge({ status }) {
  const c = TRIP_STATUS[status] ?? TRIP_STATUS.Scheduled;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "3px 9px",
      borderRadius: 20, background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, display: "inline-block", flexShrink: 0 }} />
      {status}
    </span>
  );
}

function QuickTile({ label, value, sub, icon, iconBg, accent = "#6D28D9", onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        backgroundImage: `linear-gradient(160deg, ${accent}0D 0%, transparent 55%)`,
        borderRadius: 12,
        padding: "13px 16px",
        border: `1px solid ${accent}22`,
        cursor: "pointer",
        boxShadow: `0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)`,
        display: "flex", flexDirection: "column", gap: 6,
        transition: "box-shadow .2s, transform .18s",
        animation: "fadeInUp .45s ease both",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 28px ${accent}22, 0 2px 8px rgba(0,0,0,.06)`;
        e.currentTarget.style.transform = "translateY(-3px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Colored top stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
        borderRadius: "14px 14px 0 0",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <span style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.85 }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: iconBg,
          border: `1.5px solid ${accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 2px 8px ${accent}20`,
        }}>
          {icon}
        </div>
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-.6px", lineHeight: 1 }}>
        {value}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        paddingTop: 6, borderTop: `1px solid ${accent}18`,
      }}>
        <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{sub}</span>
      </div>
    </div>
  );
}

export default function DashboardPage({ onNavigate }) {
  const { currency, exchangeRate } = useSettings();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const EMPTY = {
    totalVehicles: 0, activeVehicles: 0, activeTrips: 0,
    totalUsers: 0, avgRating: 0, todayRevenue: 0,
    totalDrivers: 0, pendingComplaints: 0,
  };

  const [stats,         setStats]         = useState(EMPTY);
  const [trips,         setTrips]         = useState([]);
  const [emergencies,   setEmergencies]   = useState([]);
  const [tripModal,     setTripModal]     = useState(null);
  const [selectedTrip,  setSelectedTrip]  = useState(null);
  const [routeOpts,     setRouteOpts]     = useState([]);
  const [driverOpts,    setDriverOpts]    = useState([]);
  const [vehicleOpts,   setVehicleOpts]   = useState([]);
  const [statsError,    setStatsError]    = useState(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [recentRatings,    setRecentRatings]    = useState([]);
  const [recentNotifs,     setRecentNotifs]     = useState([]);

  useEffect(() => {
    getDashboardStats()
      .then(d => { setStats(d); setStatsError(null); })
      .catch(err => setStatsError(err?.message ?? "Failed to load dashboard stats"));
    getDashboardOverview().then(d => {
      if (d.trips) setTrips(d.trips ?? []);
    }).catch(() => {});
    getEmergencyAlerts().then(d => { if (Array.isArray(d)) setEmergencies(d); }).catch(() => {});
    getRoutes().then(d => setRouteOpts(Array.isArray(d) ? d : [])).catch(() => {});
    getDrivers().then(d => setDriverOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});
    getVehicles().then(d => setVehicleOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});
    getComplaints().then(d => setRecentComplaints((Array.isArray(d) ? d : (d?.data ?? [])).slice(0, 4))).catch(() => {});
    getRatings().then(d => setRecentRatings((Array.isArray(d) ? d : (d?.data ?? [])).slice(0, 4))).catch(() => {});
    getNotifications().then(d => setRecentNotifs((Array.isArray(d) ? d : (d?.data ?? [])).slice(0, 4))).catch(() => {});
  }, []);

  async function handleSaveTrip(form) {
    try {
      await createTrip({
        route_id:   form.route_id   ?? null,
        driver_id:  form.driver_id  ?? null,
        vehicle_id: form.vehicle_id ?? null,
        start_time: `${form.date}T${form.time}:00.000Z`,
        status:     form.status.toLowerCase(),
      });
      getDashboardStats().then(d => setStats(d)).catch(() => {});
      return null;
    } catch (err) {
      return err?.message ?? "Failed to create trip.";
    }
  }

  const activeEmergencies = emergencies.filter(e => e.status === "active");
  const hasActive         = activeEmergencies.length > 0;
  const visibleTrips      = trips.slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn .3s ease" }}>

      {/* ── Backend connectivity error ─────────────────────────── */}
      {statsError && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
        }}>
          <AlertTriangle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>
            Could not load dashboard data — {statsError}
          </span>
          <button
            onClick={() => getDashboardStats().then(d => { setStats(d); setStatsError(null); }).catch(err => setStatsError(err?.message ?? "Failed to load"))}
            style={{ marginLeft: "auto", fontSize: 12, color: "#EF4444", background: "#FEE2E2", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 1. Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 3 }}>{today}</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.5px" }}>
            {greeting}, Admin
          </h1>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasActive && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 9,
              background: "#FEF2F2", border: "1px solid #FECACA",
            }}>
              <AlertTriangle size={13} color="#EF4444" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>
                {activeEmergencies.length} Emergency
              </span>
            </div>
          )}
          <button
            className="btn-primary"
            onClick={() => setTripModal(false)}
            style={{
              background: "#6D28D9", color: "#fff", border: "none",
              borderRadius: 9, padding: "9px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 4px 14px rgba(109,40,217,.3)",
            }}
          >
            <Zap size={13} />
            New Trip
          </button>
        </div>
      </div>

      {/* ── 2. Quick Stats Tiles ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <QuickTile
          label="Today's Revenue"
          value={fmtMoneyRound(stats.todayRevenue || 0, currency, exchangeRate)}
          sub="View Analytics →"
          accent="#10B981"
          iconBg="#F0FDF4"
          icon={<DollarSign size={16} color="#10B981" />}
          onClick={() => onNavigate?.("analytics")}
        />
        <QuickTile
          label="Pending Complaints"
          value={stats.pendingComplaints ?? 0}
          sub="View Complaints →"
          accent="#EF4444"
          iconBg="#FEF2F2"
          icon={<MessageSquareWarning size={16} color="#EF4444" />}
          onClick={() => onNavigate?.("complaints")}
        />
        <QuickTile
          label="Total Drivers"
          value={stats.totalDrivers ?? 0}
          sub="View Drivers →"
          accent="#6D28D9"
          iconBg="#F5F3FF"
          icon={<UserCheck size={16} color="#6D28D9" />}
          onClick={() => onNavigate?.("drivers")}
        />
        <QuickTile
          label="Active Alerts"
          value={activeEmergencies.length}
          sub="View Issues →"
          accent="#F59E0B"
          iconBg="#FFFBEB"
          icon={<Bell size={16} color="#F59E0B" />}
          onClick={() => onNavigate?.("issues")}
        />
      </div>

      {/* ── 3. Emergency Alert Tray — only when active ─────────── */}
      {hasActive && (
        <div style={{
          border: "2px solid #FECACA", borderRadius: 12,
          background: "#FFF5F5", overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px",
            background: "#FEF2F2",
            borderBottom: "1px solid #FECACA",
          }}>
            <AlertTriangle size={14} color="#EF4444" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#B91C1C", flex: 1 }}>
              Emergency Alerts
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
              background: "#EF4444", color: "#fff",
            }}>
              {activeEmergencies.length} ACTIVE
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#FEF2F2" }}>
                  {["Status", "Driver", "Vehicle", "Trip", "Message", "GPS", "Time", ""].map(h => (
                    <th key={h} style={{
                      padding: "6px 12px", textAlign: "left",
                      fontSize: 9, fontWeight: 700, color: "#B91C1C",
                      textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap",
                      borderBottom: "1px solid #FECACA",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emergencies.map((e, i) => {
                  const isActive = e.status === "active";
                  return (
                    <tr key={e.id} style={{
                      borderBottom: i < emergencies.length - 1 ? "1px solid #FEE2E2" : "none",
                      background: i % 2 === 0 ? "#FFF5F5" : "#FFF0F0",
                      opacity: isActive ? 1 : 0.65,
                    }}>
                      <td style={{ padding: "7px 12px" }}>
                        {isActive ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", position: "relative", zIndex: 1 }} />
                              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#EF4444", animation: "pulse-ring 1.5s ease-out infinite" }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>Active</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 9, fontWeight: 600, color: "#10B981" }}>✓ Resolved</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 12px", fontWeight: 700, color: "#0F172A" }}>{e.driver_name ?? "—"}</td>
                      <td style={{ padding: "7px 12px" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#6D28D9" }}>{e.vehicle ?? "—"}</span>
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748B" }}>{e.trip_ref ?? "—"}</span>
                      </td>
                      <td style={{ padding: "7px 12px", maxWidth: 220 }}>
                        <span style={{ color: "#B91C1C", fontWeight: 600 }}>{e.message}</span>
                      </td>
                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                        {e.latitude != null ? (
                          <span style={{ fontSize: 10, color: "#64748B", fontFamily: "monospace" }}>
                            {Number(e.latitude).toFixed(4)}, {Number(e.longitude).toFixed(4)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "#CBD5E1" }}>No GPS</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 12px", fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>{fmtAgo(e.created_at)}</td>
                      <td style={{ padding: "7px 12px" }}>
                        {isActive && (
                          <button
                            onClick={() => setEmergencies(prev => prev.map(x => x.id === e.id ? { ...x, status: "resolved" } : x))}
                            style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, border: "none", background: "#ECFDF5", color: "#059669", cursor: "pointer" }}
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
        </div>
      )}

      {/* ── 4. Map + Active Trips ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>

        <Panel
          title="Live GPS Map"
          action="Full Screen ↗"
          onAction={() => onNavigate?.("live")}
          icon={<MapPin size={14} color="#6D28D9" />}
          accent="#6D28D9"
          noPad
        >
          <div style={{ padding: "8px 12px" }}>
            <DashboardMap
              selectedTrip={selectedTrip}
            />
          </div>
        </Panel>

        <Panel
          title="Active Trips"
          action="View all"
          onAction={() => onNavigate?.("trips")}
          icon={<Clock size={14} color="#6D28D9" />}
          accent="#6D28D9"
          extra={selectedTrip && (
            <button
              onClick={() => setSelectedTrip(null)}
              style={{
                fontSize: 10, fontWeight: 600, color: "#64748B",
                background: "#F1F5F9", border: "1px solid #E2E8F0",
                borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                marginRight: 6,
              }}
            >
              ✕ Clear
            </button>
          )}
        >
          {visibleTrips.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>
              No active trips right now
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {visibleTrips.map((t, i) => {
                const isSelected = selectedTrip?.id === t.id;
                const sc = TRIP_STATUS[t.status] ?? TRIP_STATUS.Scheduled;
                return (
                  <div
                    key={t.id ?? i}
                    onClick={() => setSelectedTrip(isSelected ? null : t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 8px",
                      borderRadius: 8,
                      marginBottom: i < visibleTrips.length - 1 ? 3 : 0,
                      cursor: "pointer",
                      background: isSelected ? "#F5F3FF" : "#F8FAFC",
                      border: isSelected ? `1px solid #DDD6FE` : "1px solid #F1F5F9",
                      transition: "background .15s, border-color .15s",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F1F5F9"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#F8FAFC"; }}
                  >
                    {/* Status-colored left bar */}
                    <div style={{
                      width: 3, height: 36, borderRadius: 2,
                      background: isSelected ? "#6D28D9" : sc.dot,
                      flexShrink: 0,
                    }} />

                    {/* Trip ID chip */}
                    <span style={{
                      fontFamily: "monospace", fontWeight: 700,
                      fontSize: 10, flexShrink: 0,
                      padding: "2px 7px", borderRadius: 6,
                      background: isSelected ? "#DBEAFE" : `${sc.dot}18`,
                      color: isSelected ? "#4C1D95" : sc.color,
                      border: `1px solid ${isSelected ? "#DDD6FE" : sc.dot + "33"}`,
                    }}>
                      {t.id}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 700,
                        color: isSelected ? "#1E3A8A" : "#0F172A",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {t.route}
                      </div>
                      {t.name && (
                        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                      )}
                    </div>
                    {t.eta && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <Clock size={10} color="#94A3B8" />
                        <span style={{ fontSize: 11, color: "#64748B" }}>{t.eta}</span>
                      </div>
                    )}
                    <TripBadge status={t.status} />
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: "1px solid #F1F5F9",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              {stats.activeTrips} trips active
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10B981" }}>
              {trips.filter(t => t.status === "Ongoing" || t.status === "Active").length} ongoing
            </span>
          </div>
        </Panel>
      </div>

      {/* ── 5. Quick Previews ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>

        {/* Recent Complaints */}
        <Panel
          title="Recent Complaints"
          action="View All →"
          onAction={() => onNavigate?.("complaints")}
          icon={<MessageSquareWarning size={14} color="#EF4444" />}
          accent="#EF4444"
        >
          {recentComplaints.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "14px 0" }}>No complaints</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentComplaints.map((c, i) => (
                <div key={c.complaint_id ?? i} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                  borderBottom: i < recentComplaints.length - 1 ? "1px solid #F8FAFC" : "none",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0,
                    background: c.status === "pending" || c.status === "open" ? "#FEF2F2" : "#ECFDF5",
                    color:      c.status === "pending" || c.status === "open" ? "#DC2626"  : "#059669",
                    border:     `1px solid ${c.status === "pending" || c.status === "open" ? "#FECACA" : "#A7F3D0"}`,
                  }}>
                    {c.status ?? "open"}
                  </span>
                  <span style={{ flex: 1, fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.subject ?? c.message ?? c.description ?? "Complaint"}
                  </span>
                  <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{fmtAgo(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Ratings */}
        <Panel
          title="Recent Ratings"
          action="View All →"
          onAction={() => onNavigate?.("ratings")}
          icon={<Star size={14} color="#F59E0B" />}
          accent="#F59E0B"
        >
          {recentRatings.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "14px 0" }}>No ratings yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentRatings.map((r, i) => {
                const score = r.rating ?? r.score ?? r.stars ?? 0;
                return (
                  <div key={r.rating_id ?? i} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    borderBottom: i < recentRatings.length - 1 ? "1px solid #F8FAFC" : "none",
                  }}>
                    <span style={{ fontSize: 11, color: "#F59E0B", flexShrink: 0, letterSpacing: 1 }}>
                      {"★".repeat(Math.round(score))}{"☆".repeat(Math.max(0, 5 - Math.round(score)))}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.passenger_name ?? r.user_name ?? r.full_name ?? "Passenger"}
                    </span>
                    <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{fmtAgo(r.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Recent Notifications */}
        <Panel
          title="Recent Notifications"
          action="View All →"
          onAction={() => onNavigate?.("notifications")}
          icon={<Bell size={14} color="#3B82F6" />}
          accent="#3B82F6"
        >
          {recentNotifs.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "14px 0" }}>No notifications</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {recentNotifs.map((n, i) => (
                <div key={n.notification_id ?? n.id ?? i} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                  borderBottom: i < recentNotifs.length - 1 ? "1px solid #F8FAFC" : "none",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0,
                    background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE",
                    maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {n.type ?? "system"}
                  </span>
                  <span style={{ flex: 1, fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title ?? n.message ?? n.body ?? "Notification"}
                  </span>
                  <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{fmtAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

      </div>

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


