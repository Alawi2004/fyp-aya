import { useState } from "react";
import { Menu, Search, Bell, ChevronDown, Settings, User, LogOut, Zap } from "lucide-react";

const PAGE_LABELS = {
  dashboard:     "Dashboard",
  live:          "Live Tracking",
  camera:        "Passenger Counter",
  users:         "Users",
  drivers:       "Drivers",
  vehicles:      "Vehicles",
  routes:        "Routes & Stops",
  trips:         "Trips",
  analytics:     "Analytics",
  tickets:       "Tickets",
  notifications: "Notifications",
  ratings:       "Ratings",
};

export default function Topbar({ onToggleSidebar, collapsed, activePage }) {
  const [showProfile, setShowProfile] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);

  const pageLabel = PAGE_LABELS[activePage] || "Dashboard";

  return (
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
              background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/>
                <path d="M18 18H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", letterSpacing: "-.3px" }}>
              SmartTrack
            </span>
          </div>
        )}

        {/* Breadcrumb */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>SmartTrack</span>
            <span style={{ color: "#CBD5E1", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{pageLabel}</span>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div style={{ flex: 1, maxWidth: 440, margin: "0 auto", position: "relative" }}>
        <Search
          size={14}
          color="#94A3B8"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        <input
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
          onFocus={e => {
            e.target.style.borderColor = "#93C5FD";
            e.target.style.background  = "#fff";
            e.target.style.boxShadow   = "0 0 0 3px rgba(37,99,235,.08)";
          }}
          onBlur={e => {
            e.target.style.borderColor = "#E2E8F0";
            e.target.style.background  = "#F8FAFC";
            e.target.style.boxShadow   = "none";
          }}
        />
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
                <span style={{ fontSize: 11, color: "#2563EB", cursor: "pointer", fontWeight: 500 }}>Mark all read</span>
              </div>
              {[
                { icon: "🚨", text: "Emergency alert — Driver K. Moussa", sub: "Trip #TRP-041 · 2m ago",  dot: "#EF4444" },
                { icon: "⏱",  text: "Trip #TRP-038 delayed 15 min",       sub: "Route 7B · 11m ago",    dot: "#F59E0B" },
                { icon: "🔧", text: "Vehicle BUS-07 needs maintenance",    sub: "Fleet alert · 34m ago", dot: "#F59E0B" },
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
              background: "linear-gradient(135deg,#2563EB,#7C3AED)",
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Admin User</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>admin@smarttrack.com</div>
              </div>
              {[
                { icon: User,     label: "Profile",  danger: false },
                { icon: Settings, label: "Settings", danger: false },
                { icon: LogOut,   label: "Log out",  danger: true  },
              ].map(({ icon: Icon, label, danger }) => (
                <div key={label} style={{
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
  );
}
