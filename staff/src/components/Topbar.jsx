import { useState, useEffect } from "react";
import { Menu, RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useShift } from "../context/ShiftContext";
import apiClient from "../api/apiClient";
import { C } from "../styles/themes";

export default function Topbar({ onMenuToggle, pageTitle }) {
  const { user }                 = useAuth();
  const { isShiftOpen, shift }   = useShift();
  const [stats,   setStats]      = useState(null);
  const [loading, setLoading]    = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/staff/wallet/stats");
      setStats(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  const initials = (user?.full_name ?? user?.name ?? "ST")
    .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header style={{
      height: 60,
      background: "#fff",
      borderBottom: "1px solid #E2E8F0",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 14,
      flexShrink: 0,
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>

      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}
      >
        <Menu size={18} color="#64748B" />
      </button>

      {/* Page title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
        {pageTitle}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "#E2E8F0", flexShrink: 0 }} />

      {/* Shift status pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 11px", borderRadius: 8,
        background: isShiftOpen ? C.successBg : "#F8FAFC",
        border: `1px solid ${isShiftOpen ? "#BBF7D0" : C.border}`,
        flexShrink: 0,
      }}>
        {isShiftOpen
          ? <CheckCircle size={12} color={C.success} />
          : <AlertCircle size={12} color={C.textMuted} />
        }
        <span style={{ fontSize: 11, fontWeight: 700, color: isShiftOpen ? "#064E3B" : C.textMuted, whiteSpace: "nowrap" }}>
          {isShiftOpen ? `Shift ${shift?.shift_id ?? "Active"}` : "No Active Shift"}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Date */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <Clock size={12} color={C.textMuted} />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{today}</span>
      </div>

      {/* Today stats */}
      {stats && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: C.primaryLight,
          border: `1px solid ${C.primaryBorder}`,
          borderRadius: 8, padding: "5px 12px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>Today:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.primaryDark }}>
            {stats.today_count} top-up{stats.today_count !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.primaryDark }}>
            ${parseFloat(stats.today_amount).toFixed(2)}
          </span>
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={fetchStats}
        title="Refresh stats"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}
      >
        <RefreshCw size={13} color={loading ? C.primary : "#CBD5E1"} style={{ transition: "color .2s" }} />
      </button>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
        boxShadow: `0 2px 8px rgba(37,99,235,.3)`,
      }} title={user?.full_name ?? "Staff"}>
        {initials}
      </div>
    </header>
  );
}
