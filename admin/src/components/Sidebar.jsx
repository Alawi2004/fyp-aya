import { useState } from "react";
import {
  LayoutDashboard, MapPin, Camera, Users, UserCheck, UserRound,
  Bus, GitBranch, CalendarDays, BarChart3,
  Ticket, Bell, Star, LogOut, ChevronRight, Wallet, Shield, BadgeCheck, MessageSquareWarning, ScrollText, Settings, ClipboardList,
} from "lucide-react";

const NAV = [
  { section: "Overview" },
  { id: "dashboard",     label: "Dashboard",        icon: LayoutDashboard, badge: null },
  { id: "live",          label: "Live Tracking",     icon: MapPin,          badge: 8    },
  { id: "camera",        label: "Passenger Counter", icon: Camera,          badge: null },
  { section: "People" },
  { id: "users",         label: "All Users",         icon: Users,           badge: null },
  { id: "passengers",    label: "Passengers",        icon: UserRound,       badge: null },
  { id: "drivers",       label: "Drivers",           icon: UserCheck,       badge: null },
  { id: "staff",         label: "Staff Accounts",    icon: BadgeCheck,      badge: null },
  { section: "Fleet" },
  { id: "vehicles",      label: "Vehicles",          icon: Bus,             badge: null },
  { id: "routes",        label: "Routes & Stops",    icon: GitBranch,       badge: null },
  { id: "trips",         label: "Trips",             icon: CalendarDays,    badge: null },
  { section: "Reports" },
  { id: "analytics",     label: "Analytics",         icon: BarChart3,              badge: null },
  { id: "tickets",       label: "Tickets",           icon: Ticket,                 badge: null },
  { id: "notifications", label: "Notifications",     icon: Bell,                   badge: 3    },
  { id: "ratings",       label: "Ratings",           icon: Star,                   badge: null },
  { id: "wallet",        label: "Wallet",            icon: Wallet,                 badge: null },
  { id: "complaints",    label: "Complaints",        icon: MessageSquareWarning,   badge: null },
  { id: "issues",        label: "Issues Inbox",      icon: ClipboardList,          badge: null },
  { section: "Admin" },
  { id: "roles",     label: "Roles & Permissions", icon: Shield,      badge: null },
  { id: "auditlog",  label: "Audit Log",           icon: ScrollText,  badge: null },
  { id: "settings",  label: "System Settings",     icon: Settings,    badge: null },
];

export default function Sidebar({ activePage, onNavigate, collapsed }) {
  const [hovered, setHovered] = useState(null);
  const W = collapsed ? 70 : 252;

  return (
    <aside style={{
      width:    W,
      minWidth: W,
      maxWidth: W,
      height:   "100%",
      background: "#FFFFFF",
      display:  "flex",
      flexDirection: "column",
      transition: "width .25s cubic-bezier(.4,0,.2,1), min-width .25s, max-width .25s",
      flexShrink: 0,
      overflowY: "auto",
      overflowX: "hidden",
      position: "relative",
      zIndex:   20,
      borderRight: "1px solid #E2E8F0",
      boxShadow: "2px 0 12px rgba(0,0,0,.03)",
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: collapsed ? "18px 0" : "18px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10,
        borderBottom: "1px solid #F1F5F9",
        flexShrink: 0,
        minHeight: 64,
      }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(37,99,235,.30)",
          flexShrink: 0,
        }}>
          <Bus size={18} color="#fff" strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
              Yalla Transit
            </div>
            <div style={{ fontSize: 10, color: "#2563EB", fontWeight: 600, letterSpacing: ".5px", marginTop: 1 }}>
              TRANSIT SYSTEM
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.map((item, i) => {

          /* Section divider */
          if (item.section) {
            if (collapsed) return (
              <div key={i} style={{ height: 1, margin: "10px 14px", background: "#F1F5F9" }} />
            );
            return (
              <div key={i} className="sidebar-section">
                {item.section}
              </div>
            );
          }

          const active = activePage === item.id;
          const Icon   = item.icon;
          const isHov  = hovered === item.id;

          return (
            <div
              key={item.id}
              className="nav-item"
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              data-tooltip={collapsed ? item.label : undefined}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding:        collapsed ? "10px 0" : "9px 12px",
                margin:         "1px 8px",
                borderRadius:   10,
                cursor:         "pointer",
                position:       "relative",
                background:     active
                  ? "#EFF6FF"
                  : isHov
                  ? "#F8FAFC"
                  : "transparent",
              }}
            >
              {/* Active left accent */}
              {active && (
                <div style={{
                  position:  "absolute",
                  left:      -8,
                  top:       "18%",
                  bottom:    "18%",
                  width:     3,
                  borderRadius: "0 4px 4px 0",
                  background: "#2563EB",
                }} />
              )}

              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? "#2563EB" : isHov ? "#475569" : "#94A3B8"}
                style={{ flexShrink: 0, transition: "color .14s" }}
              />

              {!collapsed && (
                <span style={{
                  flex:       1,
                  fontSize:   13,
                  fontWeight: active ? 600 : 400,
                  color:      active ? "#1E40AF" : isHov ? "#334155" : "#64748B",
                  whiteSpace: "nowrap",
                  overflow:   "hidden",
                  transition: "color .14s",
                }}>
                  {item.label}
                </span>
              )}

              {/* Badge (expanded) */}
              {item.badge != null && !collapsed && (
                <span style={{
                  background:   active ? "#2563EB" : "#EF4444",
                  color:        "#fff",
                  fontSize:     9,
                  fontWeight:   700,
                  padding:      "2px 6px",
                  borderRadius: 10,
                  minWidth:     18,
                  textAlign:    "center",
                }}>
                  {item.badge}
                </span>
              )}

              {/* Badge dot (collapsed) */}
              {item.badge != null && collapsed && (
                <div style={{
                  position:    "absolute",
                  top:         7,
                  right:       8,
                  width:       7,
                  height:      7,
                  borderRadius: "50%",
                  background:  "#EF4444",
                  border:      "1.5px solid #fff",
                }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{
        padding:    collapsed ? "12px 0" : "10px 12px",
        borderTop:  "1px solid #F1F5F9",
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff",
              boxShadow: "0 2px 8px rgba(37,99,235,.25)",
            }}>
              AD
            </div>
          </div>
        ) : (
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            padding:      "9px 10px",
            borderRadius: 10,
            background:   "#F8FAFC",
            border:       "1px solid #F1F5F9",
            cursor:       "pointer",
            transition:   "background .14s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
            onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(37,99,235,.22)",
            }}>
              AD
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Admin User
              </div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>
                Administrator
              </div>
            </div>
            <LogOut size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />
          </div>
        )}
      </div>
    </aside>
  );
}
