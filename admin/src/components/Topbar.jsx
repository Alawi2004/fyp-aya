import { useState, useEffect, useRef } from "react";
import { Menu, Search, Bell, ChevronDown, Settings, User, LogOut, Zap, Smartphone, Monitor, Globe, AlertTriangle, Clock, Wrench, Bus, UserCircle, MapPin, Route } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getTrips, getDrivers, getVehicles, getRoutes } from "../api/endpoints";

const PAGE_LABELS = {
  dashboard:     "Dashboard",
  live:          "Live Tracking",
  camera:        "Passenger Counter",
  users:         "All Users",
  passengers:    "Passengers",
  drivers:       "Drivers",
  staff:         "Staff Accounts",
  vehicles:      "Vehicles",
  routes:        "Routes & Stops",
  trips:         "Trips",
  analytics:     "Analytics",
  tickets:       "Tickets",
  notifications: "Notifications",
  ratings:       "Ratings",
  wallet:        "Wallet",
  complaints:    "Complaints",
  issues:        "Issues Inbox",
  auditlog:      "Audit Log",
  settings:      "System Settings",
};

function deviceIcon(name = "") {
  if (/iPhone|iPad|Android/.test(name)) return <Smartphone size={18} />;
  if (/Mac/.test(name))    return <Monitor size={18} />;
  if (/Windows/.test(name)) return <Monitor size={18} />;
  return <Globe size={18} />;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SessionsModal({ onClose }) {
  const { getSessions, revokeSession, revokeAllOtherSessions } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    getSessions().then(setSessions).catch(() => setSessions([]));
  }, [getSessions]);

  const revoke = async (id) => {
    setBusy(true);
    try {
      await revokeSession(id);
      setSessions(s => s.filter(x => x.session_id !== id));
    } finally { setBusy(false); }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      await revokeAllOtherSessions();
      setSessions(s => s.filter(x => x.is_current));
    } finally { setBusy(false); }
  };

  const others = sessions?.filter(s => !s.is_current) ?? [];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: 420, maxHeight: "80vh",
        boxShadow: "0 24px 64px rgba(0,0,0,.18)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Active Sessions</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Devices currently signed in</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Session list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {sessions === null ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No active sessions</div>
          ) : sessions.map(s => (
            <div key={s.session_id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 20px",
              borderBottom: "1px solid #F8FAFC",
            }}>
              <span style={{ flexShrink: 0, color: "#64748B" }}>{deviceIcon(s.device_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", display: "flex", alignItems: "center", gap: 6 }}>
                  {s.device_name || "Unknown Device"}
                  {s.is_current && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 20, padding: "1px 7px" }}>
                      Current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                  {s.ip_address} · {timeAgo(s.last_active_at)}
                </div>
              </div>
              {!s.is_current && (
                <button
                  onClick={() => revoke(s.session_id)}
                  disabled={busy}
                  style={{
                    background: "none", border: "1px solid #FECACA", borderRadius: 6,
                    color: "#EF4444", fontSize: 11, fontWeight: 600,
                    padding: "4px 10px", cursor: busy ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {others.length > 0 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9" }}>
            <button
              onClick={revokeOthers}
              disabled={busy}
              style={{
                width: "100%", padding: "9px", background: "#FEF2F2",
                border: "1px solid #FECACA", borderRadius: 8,
                color: "#DC2626", fontSize: 13, fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Sign out all other devices ({others.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SEARCH_CATEGORIES = {
  trips:    { label: "Trip",    icon: Zap,        color: "#6D28D9", bg: "#F5F3FF" },
  drivers:  { label: "Driver",  icon: UserCircle,  color: "#0891B2", bg: "#ECFEFF" },
  vehicles: { label: "Vehicle", icon: Bus,         color: "#059669", bg: "#ECFDF5" },
  routes:   { label: "Route",   icon: Route,       color: "#D97706", bg: "#FFFBEB" },
};

export default function Topbar({ onToggleSidebar, collapsed, activePage, onNavigate }) {
  const [showProfile,   setShowProfile]   = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [showSessions,  setShowSessions]  = useState(false);
  const [query,         setQuery]         = useState("");
  const [results,       setResults]       = useState([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [allData,       setAllData]       = useState(null);
  const searchRef = useRef(null);
  const { user, logout } = useAuth();

  const pageLabel = PAGE_LABELS[activePage] || "Dashboard";

  // Load all searchable data once
  useEffect(() => {
    Promise.allSettled([getTrips(), getDrivers(), getVehicles(), getRoutes()])
      .then(([t, d, v, r]) => {
        setAllData({
          trips:    (t.value?.data ?? t.value ?? []).slice(0, 300),
          drivers:  (d.value?.data ?? d.value ?? []).slice(0, 300),
          vehicles: (v.value?.data ?? v.value ?? []).slice(0, 300),
          routes:   (r.value?.data ?? r.value ?? []).slice(0, 300),
        });
      });
  }, []);

  // Filter results as user types
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !allData) { setResults([]); return; }

    const hits = [];

    (allData.trips || []).filter(t =>
      String(t.trip_id ?? t.id ?? "").toLowerCase().includes(q) ||
      (t.route_name ?? t.route ?? "").toLowerCase().includes(q) ||
      (t.driver_name ?? t.driver ?? "").toLowerCase().includes(q) ||
      (t.plate_number ?? t.vehicle ?? "").toLowerCase().includes(q)
    ).slice(0, 4).forEach(t => hits.push({
      type:  "trips",
      label: `Trip ${t.trip_id ?? t.id} — ${t.route_name ?? t.route ?? ""}`,
      sub:   t.driver_name ?? t.driver ?? "",
    }));

    (allData.drivers || []).filter(d =>
      (d.full_name ?? d.name ?? "").toLowerCase().includes(q) ||
      (d.license_number ?? "").toLowerCase().includes(q) ||
      (d.phone ?? "").toLowerCase().includes(q)
    ).slice(0, 4).forEach(d => hits.push({
      type:  "drivers",
      label: d.full_name ?? d.name ?? "",
      sub:   d.license_number ?? d.phone ?? "",
    }));

    (allData.vehicles || []).filter(v =>
      (v.plate_number ?? v.plate ?? "").toLowerCase().includes(q) ||
      (v.model ?? "").toLowerCase().includes(q) ||
      (v.type ?? "").toLowerCase().includes(q)
    ).slice(0, 4).forEach(v => hits.push({
      type:  "vehicles",
      label: v.plate_number ?? v.plate ?? "",
      sub:   [v.type, v.model].filter(Boolean).join(" · "),
    }));

    (allData.routes || []).filter(r =>
      (r.route_name ?? r.name ?? "").toLowerCase().includes(q) ||
      (r.start_location ?? "").toLowerCase().includes(q) ||
      (r.end_location ?? "").toLowerCase().includes(q)
    ).slice(0, 4).forEach(r => hits.push({
      type:  "routes",
      label: r.route_name ?? r.name ?? "",
      sub:   [r.start_location, r.end_location].filter(Boolean).join(" → "),
    }));

    setResults(hits);
  }, [query, allData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
    <header style={{
      height:     64,
      background: "#FFFFFF",
      display:    "flex",
      alignItems: "center",
      padding:    "0 20px",
      gap:        14,
      flexShrink: 0,
      position:   "sticky",
      top:        0,
      zIndex:     100,
      borderBottom: "1px solid #E2E8F0",
      boxShadow:  "0 1px 0 #F1F5F9, 0 4px 16px rgba(0,0,0,.04)",
    }}>

      {/* ── Hamburger + Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "#F8FAFC",
            border:     "1px solid #E2E8F0",
            borderRadius: 9,
            cursor:     "pointer",
            padding:    "7px 8px",
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background .14s, border-color .14s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#F1F5F9";
            e.currentTarget.style.borderColor = "#CBD5E1";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "#F8FAFC";
            e.currentTarget.style.borderColor = "#E2E8F0";
          }}
        >
          <Menu size={16} color="#64748B" />
        </button>

        {/* Logo mark when sidebar collapsed */}
        {collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg,#6D28D9,#4C1D95)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/>
                <path d="M18 18H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", letterSpacing: "-.3px" }}>
              Yalla Transit
            </span>
          </div>
        )}

        {/* Breadcrumb */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>Yalla Transit</span>
            <span style={{ color: "#CBD5E1", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{pageLabel}</span>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div ref={searchRef} style={{ flex: 1, maxWidth: 440, margin: "0 auto", position: "relative" }}>
        <Search
          size={14}
          color="#94A3B8"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}
        />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
          onFocus={e => {
            setSearchOpen(true);
            e.target.style.borderColor = "#C4B5FD";
            e.target.style.background  = "#fff";
            e.target.style.boxShadow   = "0 0 0 3px rgba(109,40,217,.08)";
          }}
          onBlur={e => {
            e.target.style.borderColor = "#E2E8F0";
            e.target.style.background  = "#F8FAFC";
            e.target.style.boxShadow   = "none";
          }}
          onKeyDown={e => { if (e.key === "Escape") { setSearchOpen(false); setQuery(""); } }}
          placeholder="Search vehicles, drivers, trips…"
          style={{
            width:        "100%",
            padding:      "9px 14px 9px 36px",
            background:   "#F8FAFC",
            border:       "1.5px solid #E2E8F0",
            borderRadius: 10,
            color:        "#1E293B",
            fontSize:     13,
            outline:      "none",
            transition:   "border-color .14s, background .14s",
          }}
        />

        {/* Dropdown */}
        {searchOpen && query.trim().length >= 2 && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
            background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
            boxShadow: "0 16px 48px rgba(0,0,0,.12)", zIndex: 500,
            overflow: "hidden", animation: "slideInDown .12s ease",
          }}>
            {results.length === 0 ? (
              <div style={{ padding: "16px 18px", fontSize: 13, color: "#94A3B8", textAlign: "center" }}>
                No results for "{query.trim()}"
              </div>
            ) : (
              <>
                {results.map((r, i) => {
                  const cat = SEARCH_CATEGORIES[r.type];
                  const Icon = cat.icon;
                  return (
                    <div
                      key={i}
                      onMouseDown={() => {
                        onNavigate?.(r.type);
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 16px",
                        cursor: "pointer",
                        borderBottom: i < results.length - 1 ? "1px solid #F8FAFC" : "none",
                        transition: "background .1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={15} color={cat.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.label}
                        </div>
                        {r.sub && (
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.sub}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: cat.bg, color: cat.color, flexShrink: 0,
                      }}>
                        {cat.label}
                      </span>
                    </div>
                  );
                })}
                <div style={{ padding: "8px 16px", borderTop: "1px solid #F1F5F9", fontSize: 11, color: "#94A3B8", textAlign: "center" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""} · click to navigate
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* System live pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 11px",
          background: "#ECFDF5",
          borderRadius: 8,
          border: "1px solid #A7F3D0",
        }}>
          <span className="live-dot" />
          <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
            System Live
          </span>
        </div>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => { setNotifOpen(o => !o); setShowProfile(false); }}
            style={{
              background:   "#F8FAFC",
              border:       "1.5px solid #E2E8F0",
              borderRadius: 9,
              cursor:       "pointer",
              width:        36,
              height:       36,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              position:     "relative",
              transition:   "background .14s, border-color .14s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#F1F5F9";
              e.currentTarget.style.borderColor = "#CBD5E1";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#F8FAFC";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <Bell size={16} color="#64748B" />
            <span style={{
              position:    "absolute",
              top:         3, right: 3,
              width:       15, height: 15,
              borderRadius: "50%",
              background:  "#EF4444",
              color:       "#fff",
              fontSize:    8,
              fontWeight:  700,
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              border:      "2px solid #fff",
            }}>
              3
            </span>
          </button>

          {notifOpen && (
            <div style={{
              position:    "absolute",
              top:         "calc(100% + 10px)",
              right:       0,
              width:       320,
              background:  "#fff",
              borderRadius: 14,
              border:      "1px solid #E2E8F0",
              boxShadow:   "0 16px 48px rgba(0,0,0,.12)",
              zIndex:      999,
              overflow:    "hidden",
              animation:   "slideInDown .15s ease",
            }}>
              <div style={{
                padding: "13px 16px 10px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Notifications</span>
                <span style={{ fontSize: 11, color: "#6D28D9", cursor: "pointer", fontWeight: 500 }}>Mark all read</span>
              </div>
              {[
                { Icon: AlertTriangle, text: "Emergency alert — Driver K. Moussa", sub: "Trip #TRP-041 · 2m ago",  dot: "#EF4444" },
                { Icon: Clock,         text: "Trip #TRP-038 delayed 15 min",       sub: "Route 7B · 11m ago",    dot: "#F59E0B" },
                { Icon: Wrench,        text: "Vehicle BUS-07 needs maintenance",    sub: "Fleet alert · 34m ago", dot: "#F59E0B" },
              ].map((n, i) => (
                <div key={i} style={{
                  padding: "12px 16px",
                  display: "flex", gap: 12, alignItems: "flex-start",
                  borderBottom: i < 2 ? "1px solid #F8FAFC" : "none",
                  cursor: "pointer", transition: "background .1s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.dot, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B", marginBottom: 2 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{n.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin profile */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => { setShowProfile(o => !o); setNotifOpen(false); }}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              padding:      "4px 10px 4px 4px",
              background:   "#F8FAFC",
              border:       "1.5px solid #E2E8F0",
              borderRadius: 10,
              cursor:       "pointer",
              transition:   "background .14s, border-color .14s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#F1F5F9";
              e.currentTarget.style.borderColor = "#CBD5E1";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#F8FAFC";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg,#6D28D9,#8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#fff",
            }}>
              AD
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B", lineHeight: 1.2 }}>Admin</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>Administrator</div>
            </div>
            <ChevronDown size={13} color="#94A3B8" />
          </button>

          {showProfile && (
            <div style={{
              position:    "absolute",
              top:         "calc(100% + 10px)",
              right:       0,
              width:       210,
              background:  "#fff",
              borderRadius: 14,
              border:      "1px solid #E2E8F0",
              boxShadow:   "0 16px 48px rgba(0,0,0,.12)",
              zIndex:      999,
              overflow:    "hidden",
              animation:   "slideInDown .15s ease",
            }}>
              <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{user?.full_name || "Admin"}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{user?.email || ""}</div>
              </div>
              {[
                { icon: User,     label: "Profile",         danger: false, onClick: null },
                { icon: Settings, label: "Active Sessions", danger: false, onClick: () => setShowSessions(true) },
                { icon: LogOut,   label: "Log out",         danger: true,  onClick: logout },
              ].map(({ icon: Icon, label, danger, onClick }) => (
                <div key={label}
                  onClick={() => { setShowProfile(false); onClick?.(); }}
                  style={{
                    padding: "10px 16px",
                    display: "flex", gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
                    color:  danger ? "#EF4444" : "#475569",
                    fontSize: 13, fontWeight: 500,
                    borderTop: label === "Log out" ? "1px solid #F1F5F9" : "none",
                    transition: "background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Icon size={14} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>

    {showSessions && <SessionsModal onClose={() => setShowSessions(false)} />}
  </>
  );
}
