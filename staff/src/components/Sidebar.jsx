import { useState } from "react";
import { Wallet, History, LogOut, Coins, Clock, FileText, CalendarDays } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useShift } from "../context/ShiftContext";
import { C } from "../styles/themes";

const NAV = [
  { id: "shift",         label: "Shift Management", icon: Clock       },
  { id: "topup",         label: "Wallet Top-Up",    icon: Wallet      },
  { id: "report",        label: "Cash Report",      icon: FileText    },
  { id: "history",       label: "Top-Up History",   icon: History     },
  { id: "shift-history", label: "Shift History",    icon: CalendarDays },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }) {
  const { user, logout }   = useAuth();
  const { isShiftOpen }    = useShift();
  const [hovered, setHovered] = useState(null);
  const W = collapsed ? 68 : 240;

  const initials = (user?.full_name ?? user?.name ?? "ST")
    .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <aside style={{
      width: W, minWidth: W, maxWidth: W,
      height: "100%",
      background: "#0F172A",
      display: "flex", flexDirection: "column",
      transition: "width .22s cubic-bezier(.4,0,.2,1), min-width .22s, max-width .22s",
      flexShrink: 0,
      overflowX: "hidden",
      position: "relative",
      zIndex: 20,
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: collapsed ? "16px 0" : "16px 16px",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        minHeight: 62, flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px rgba(37,99,235,.35)`,
            }}>
              <Coins size={16} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-.3px" }}>Yalla Transit</div>
              <div style={{ fontSize: 10, color: C.primary, fontWeight: 600, letterSpacing: ".4px" }}>STAFF PORTAL</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Coins size={16} color="#fff" strokeWidth={2.2} />
          </div>
        )}
      </div>

      {/* ── Shift status pill ── */}
      {!collapsed && (
        <div style={{
          margin: "10px 10px 2px",
          padding: "7px 10px",
          borderRadius: 8,
          background: isShiftOpen ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.10)",
          border: `1px solid ${isShiftOpen ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.25)"}`,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: isShiftOpen ? C.primary : C.danger,
            boxShadow: isShiftOpen ? `0 0 0 3px rgba(34,197,94,.2)` : `0 0 0 3px rgba(239,68,68,.2)`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: isShiftOpen ? "#86EFAC" : "#FCA5A5" }}>
            {isShiftOpen ? "Shift Active" : "No Active Shift"}
          </span>
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.map(item => {
          const active = activePage === item.id;
          const isHov  = hovered === item.id;
          const Icon   = item.icon;
          // Show a dot badge on Shift item when no shift is open
          const showBadge = item.id === "shift" && !isShiftOpen;

          return (
            <div
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "11px 0" : "10px 14px",
                margin: "2px 8px",
                borderRadius: 10,
                cursor: "pointer",
                position: "relative",
                background: active
                  ? "rgba(37,99,235,.20)"
                  : isHov ? "rgba(255,255,255,.05)"
                  : "transparent",
                transition: "background .13s",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute", left: -8, top: "18%", bottom: "18%",
                  width: 3, borderRadius: "0 4px 4px 0",
                  background: C.primary,
                }} />
              )}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Icon
                  size={18}
                  strokeWidth={active ? 2.2 : 1.8}
                  color={active ? C.primary : isHov ? "#CBD5E1" : "#64748B"}
                />
                {showBadge && (
                  <div style={{
                    position: "absolute", top: -3, right: -3,
                    width: 8, height: 8, borderRadius: "50%",
                    background: C.danger, border: "1.5px solid #0F172A",
                  }} />
                )}
              </div>
              {!collapsed && (
                <span style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#F0FDF4" : isHov ? "#CBD5E1" : "#94A3B8",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}>
                  {item.label}
                </span>
              )}
              {!collapsed && showBadge && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99,
                  background: C.danger, color: "#fff",
                }}>
                  START
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{
        padding: collapsed ? "12px 0" : "10px 12px",
        borderTop: "1px solid rgba(255,255,255,.07)",
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>
              {initials}
            </div>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 10,
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.07)",
            cursor: "pointer",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name ?? user?.name ?? "Staff Member"}
              </div>
              <div style={{ fontSize: 10, color: C.primary, fontWeight: 600 }}>Staff</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
            >
              <LogOut size={13} color="#64748B" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
