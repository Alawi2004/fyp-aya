import { useState, useEffect, useCallback } from "react";
import { History, Filter, RefreshCw, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import apiClient from "../api/apiClient";
import { C, cardStyle } from "../styles/themes";
import { useSettings } from "../context/SettingsContext";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt      = (n, cur = "USD", rate = 1) => { const v = (parseFloat(n ?? 0)) * rate; const dec = rate >= 100 ? 0 : 2; return `${cur} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`; };
const fmtDate  = (d) => d
  ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

const STATUS_STYLE = {
  completed: { bg: "#D1FAE5", color: "#065F46" },
  pending:   { bg: "#FEF3C7", color: "#92400E" },
  reversed:  { bg: "#FEE2E2", color: "#991B1B" },
};

const thStyle = {
  padding: "10px 14px", textAlign: "left", fontSize: 11,
  fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
  letterSpacing: ".5px", whiteSpace: "nowrap", background: "#F8FAFC",
  borderBottom: "1px solid #F1F5F9",
};
const tdStyle = { padding: "13px 14px", verticalAlign: "middle" };

// ─── HistoryPage ─────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const { currency, exchangeRate } = useSettings();
  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");
  const [filterUser,   setFilterUser]   = useState("");
  const [filterLoc,    setFilterLoc]    = useState("");
  const [detailRow,    setDetailRow]    = useState(null);

  // ── totals ───────────────────────────────────────────────────────────────
  const totalAmount = records.reduce((s, r) => s + parseFloat(r.amount ?? 0), 0);
  const todayCount  = records.filter(r => {
    try { return new Date(r.created_at).toDateString() === new Date().toDateString(); } catch { return false; }
  }).length;

  // ── load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to",   filterTo);
    if (filterUser) params.set("user_id", filterUser);
    if (filterLoc)  params.set("location", filterLoc);
    try {
      const data = await apiClient.get(`/staff/wallet/history?${params}`);
      setRecords(data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo, filterUser, filterLoc]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => { setFilterFrom(""); setFilterTo(""); setFilterUser(""); setFilterLoc(""); };
  const hasFilters   = filterFrom || filterTo || filterUser || filterLoc;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
          My Top-Up History
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
          All wallet recharges you have processed
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Total Top-Ups"     value={records.length}           sub="all time (filtered)" />
        <SummaryCard label="Total Amount"      value={fmt(totalAmount, currency, exchangeRate)}         sub="all time (filtered)" accent />
        <SummaryCard label="Today's Top-Ups"   value={todayCount}               sub="processed today" />
      </div>

      {/* Table card */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>

        {/* Card header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <History size={16} color={C.primary} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flex: 1 }}>
            Transaction Log
          </span>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: filtersOpen || hasFilters ? C.primaryLight : "#F8FAFC",
              border: `1px solid ${filtersOpen || hasFilters ? C.primaryBorder : C.border}`,
              borderRadius: 8, padding: "7px 12px",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              color: filtersOpen || hasFilters ? C.primary : C.textMuted,
            }}
          >
            <Filter size={13} />
            Filters
            {hasFilters && <span style={{ background: C.primary, color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>ON</span>}
            {filtersOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Refresh */}
          <button onClick={load} style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Refresh">
            <RefreshCw size={13} color={C.textMuted} />
          </button>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div style={{
            padding: "14px 20px", background: "#FAFBFC",
            borderBottom: "1px solid #F1F5F9",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
            gap: 10, alignItems: "end",
          }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>From Date</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1.5px solid ${C.border}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>To Date</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1.5px solid ${C.border}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>User ID</label>
              <input type="number" value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="e.g. 42"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1.5px solid ${C.border}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>Location</label>
              <input value={filterLoc} onChange={e => setFilterLoc(e.target.value)} placeholder="e.g. Central Bus"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1.5px solid ${C.border}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} style={{ display: "flex", alignItems: "center", gap: 4, background: "#F1F5F9", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textSecond }}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 56, textAlign: "center", color: C.textMuted, fontSize: 14 }}>Loading…</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center" }}>
            <History size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No records found</div>
            <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>
              {hasFilters ? "Try adjusting your filters" : "Your processed top-ups will appear here"}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Date & Time", "Passenger", "Amount", "Paid", "Location", "Reference", "Status", ""].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.completed;
                  return (
                    <tr
                      key={r.top_up_id}
                      style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC", borderBottom: "1px solid #F8FAFC" }}
                    >
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                          {new Date(r.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>{r.user_name ?? "—"}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{r.user_email}</div>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <span style={{ background: "#D1FAE5", color: "#065F46", padding: "3px 10px", borderRadius: 99, fontWeight: 700, fontSize: 13 }}>
                          {fmt(r.amount, currency, exchangeRate)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: C.textSecond }}>
                        {r.payment_method}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 160 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0F172A" }}>
                          {r.recharge_location}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: C.textSecond, whiteSpace: "nowrap" }}>
                        {r.transaction_reference}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 99, fontWeight: 700, fontSize: 11, textTransform: "capitalize" }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setDetailRow(r)}
                          style={{ background: "#F1F5F9", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.textSecond }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailRow && (
        <DetailModal record={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : "#fff",
      border: `1px solid ${accent ? "transparent" : C.border}`,
      borderRadius: 14, padding: "18px 20px",
      boxShadow: accent ? `0 4px 20px rgba(109,40,217,.2)` : "0 1px 3px rgba(0,0,0,.04)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent ? "rgba(255,255,255,.75)" : C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent ? "#fff" : "#0F172A", letterSpacing: "-1px", marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: accent ? "rgba(255,255,255,.6)" : C.textMuted }}>
        {sub}
      </div>
    </div>
  );
}

function DetailModal({ record, onClose }) {
  const rows = [
    ["Top-Up ID",          `#${record.top_up_id}`],
    ["Date",               fmtDate(record.created_at)],
    ["Passenger",          record.user_name],
    ["Passenger Email",    record.user_email],
    ["Passenger Phone",    record.user_phone ?? "—"],
    ["Amount",             fmt(record.amount, currency, exchangeRate)],
    ["Balance Before",     fmt(record.balance_before, currency, exchangeRate)],
    ["Balance After",      fmt(record.balance_after, currency, exchangeRate)],
    ["Payment Method",     record.payment_method],
    ["Location",           record.recharge_location],
    ["Transaction Ref",    record.transaction_reference],
    ["Status",             record.status],
    ["Notes",              record.notes ?? "—"],
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,.2)", overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Top-Up Details</span>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#64748B" />
          </button>
        </div>
        <div style={{ padding: "4px 0 16px", maxHeight: "70vh", overflowY: "auto" }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", alignItems: "flex-start", padding: "9px 20px", background: i % 2 === 0 ? "#FAFBFC" : "#fff" }}>
              <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0, paddingTop: 1 }}>{k}</span>
              <span style={{
                fontSize: 13, fontWeight: k === "Amount" ? 800 : 500,
                color: k === "Amount" ? C.success : k === "Transaction Ref" ? "#0F172A" : "#1E293B",
                fontFamily: k === "Transaction Ref" || k === "Top-Up ID" ? "monospace" : undefined,
                wordBreak: "break-all",
              }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

