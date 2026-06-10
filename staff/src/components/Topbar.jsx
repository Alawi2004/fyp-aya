import { useState, useEffect } from "react";
import { Menu, Bell, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/apiClient";
import { C } from "../styles/themes";

export default function Topbar({ onMenuToggle, pageTitle }) {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/staff/wallet/stats");
      setStats(data);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <header style={{
      height:          60,
      background:      "#fff",
      borderBottom:    "1px solid #E2E8F0",
      display:         "flex",
      alignItems:      "center",
      padding:         "0 20px",
      gap:             16,
      flexShrink:      0,
      boxShadow:       "0 1px 4px rgba(0,0,0,.04)",
    }}>

      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
      >
        <Menu size={18} color="#64748B" />
      </button>

      {/* Page title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flex: 1 }}>
        {pageTitle}
      </div>

      {/* Today's quick stats */}
      {stats && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: C.primaryLight,
          border: `1px solid ${C.primaryBorder}`,
          borderRadius: 8, padding: "5px 12px",
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

      {/* Refresh stats */}
      <button
        onClick={fetchStats}
        title="Refresh stats"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
      >
        <RefreshCw size={14} color={loading ? C.primary : "#94A3B8"} style={{ transition: "color .2s" }} />
      </button>

      {/* Staff badge */}
      <div style={{
        background: C.primaryLight,
        border: `1px solid ${C.primaryBorder}`,
        borderRadius: 20, padding: "4px 12px",
        fontSize: 11, fontWeight: 700,
        color: C.primary, letterSpacing: ".3px",
      }}>
        STAFF
      </div>
    </header>
  );
}
