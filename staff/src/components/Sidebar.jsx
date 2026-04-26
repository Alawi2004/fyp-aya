import { useState } from "react";
import { Wallet, History, LogOut, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { C } from "../styles/themes";

const NAV = [
  { id: "topup",   label: "Wallet Top-Up",    icon: Wallet  },
  { id: "history", label: "My Top-Up History", icon: History },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }) {
  const { user, logout } = useAuth();
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
              boxShadow: `0 4px 12px rgba(5,150,105,.35)`,
            }}>
              <Coins size={16} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F8FAFC", letterSpacing: "-.3px" }}>Staff Portal</div>
              <div style={{ fontSize: 10, color: C.primary, fontWeight: 600, letterSpacing: ".4px" }}>WALLET TOP-UP</div>
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
        <button
          onClick={onToggle}
          style={{
            background: "rgba(255,255,255,.06)",
            border: "none", borderRadius: 6,
            width: 26, height: 26,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
            ...(collapsed && { position: "absolute", bottom: -20, right: -14, display: "none" }),
          }}
        >
          {collapsed
            ? <ChevronRight size={13} color="#94A3B8" />
            : <ChevronLeft  size={13} color="#94A3B8" />
          }
        </button>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto", overflowX: "hidden" }}>
        {NAV.map(item => {
          const active = activePage === item.id;
          const isHov  = hovered === item.id;
          const Icon   = item.icon;

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
                  ? "rgba(5,150,105,.18)"
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
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? C.primary : isHov ? "#CBD5E1" : "#64748B"}
                style={{ flexShrink: 0 }}
              />
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
