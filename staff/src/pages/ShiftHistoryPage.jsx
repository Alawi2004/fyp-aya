import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, MapPin, DollarSign, Hash,
  CheckCircle, AlertTriangle, TrendingUp, X, RefreshCw,
} from "lucide-react";
import apiClient from "../api/apiClient";
import { C, cardStyle } from "../styles/themes";
import { useSettings } from "../context/SettingsContext";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt     = (n, cur = "USD", rate = 1) => { if (n == null) return "—"; const v = parseFloat(n) * rate; const dec = rate >= 100 ? 0 : 2; return `${cur} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`; };
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";
const fmtFull = (iso) => iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : "—";

const fmtDuration = (openedAt, closedAt) => {
  if (!openedAt || !closedAt) return "—";
  const ms = new Date(closedAt) - new Date(openedAt);
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const discColor = (diff) => {
  if (diff == null) return { color: C.textMuted, bg: "#F1F5F9" };
  if (diff === 0)   return { color: C.success,   bg: C.successBg };
  if (diff > 0)     return { color: C.warning,   bg: C.warningBg };
  return              { color: C.danger,    bg: C.dangerBg };
};

const discLabel = (diff, cur = "USD", rate = 1) => {
  if (diff == null) return "—";
  if (diff === 0)   return "Balanced";
  return `${diff > 0 ? "+" : ""}${fmt(Math.abs(diff), cur, rate)} ${diff > 0 ? "over" : "short"}`;
};

// ─── ShiftHistoryPage ────────────────────────────────────────────────────────
export default function ShiftHistoryPage() {
  const { currency, exchangeRate } = useSettings();
  const [shifts,    setShifts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [detailRow, setDetailRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get("/staff/shift/history");
      setShifts(data ?? []);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closed      = shifts.filter(s => s.status === "closed");
  const totalAmount = closed.reduce((s, r) => s + parseFloat(r.total_collected ?? 0), 0);
  const totalTx     = closed.reduce((s, r) => s + (r.total_transactions ?? 0), 0);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>Shift History</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>All shifts you have opened and closed</p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.textSecond }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <SummaryCard icon={Hash}       label="Total Shifts"       value={closed.length}    color={C.info}    bg="#F5F3FF" />
        <SummaryCard icon={TrendingUp} label="Total Collected"    value={fmt(totalAmount, currency, exchangeRate)} color={C.primary} bg={C.primaryLight} accent />
        <SummaryCard icon={DollarSign} label="Total Transactions" value={totalTx}          color={C.success} bg={C.successBg} />
      </div>

      {/* Table — no overflow, all columns visible */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={15} color={C.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", flex: 1 }}>Shift Log</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 14 }}>Loading…</div>
        ) : shifts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <CalendarDays size={36} color="#CBD5E1" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8" }}>No shifts yet</div>
            <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>Your completed shifts will appear here</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "6%" }}  />  {/* # */}
              <col style={{ width: "13%" }} />  {/* Staff */}
              <col style={{ width: "16%" }} />  {/* Location */}
              <col style={{ width: "12%" }} />  {/* Opened */}
              <col style={{ width: "12%" }} />  {/* Closed */}
              <col style={{ width: "7%" }}  />  {/* Duration */}
              <col style={{ width: "6%" }}  />  {/* Tx */}
              <col style={{ width: "10%" }} />  {/* Collected */}
              <col style={{ width: "11%" }} />  {/* Discrepancy */}
              <col style={{ width: "7%" }}  />  {/* Details */}
            </colgroup>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
                {[
                  ["#",           "left"],
                  ["Staff",       "left"],
                  ["Location",    "left"],
                  ["Opened",      "left"],
                  ["Closed",      "left"],
                  ["Duration",    "left"],
                  ["Tx",          "center"],
                  ["Collected",   "right"],
                  ["Discrepancy", "center"],
                  ["",            "center"],
                ].map(([label, align]) => (
                  <th key={label} style={{ padding: "8px 10px", textAlign: align, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".5px" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, i) => {
                const dc     = discColor(s.cash_difference);
                const isOpen = s.status === "active";
                return (
                  <tr
                    key={s.shift_id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC", borderBottom: `1px solid ${C.border}` }}
                  >
                    {/* # */}
                    <td style={{ padding: "10px 10px", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                      #{s.shift_id}
                    </td>

                    {/* Staff */}
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.staff_name}
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} color={C.primary} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.location || "—"}>
                          {s.location || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Opened */}
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>{fmtDate(s.opened_at)}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(s.opened_at)}</div>
                    </td>

                    {/* Closed */}
                    <td style={{ padding: "10px 10px" }}>
                      {isOpen ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.success, background: C.successBg, padding: "2px 7px", borderRadius: 99 }}>Active</span>
                      ) : (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>{fmtDate(s.closed_at)}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{fmtTime(s.closed_at)}</div>
                        </>
                      )}
                    </td>

                    {/* Duration */}
                    <td style={{ padding: "10px 10px", fontSize: 12, color: C.textSecond, whiteSpace: "nowrap" }}>
                      {fmtDuration(s.opened_at, s.closed_at)}
                    </td>

                    {/* Tx count */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.info }}>
                        {s.total_transactions ?? "—"}
                      </span>
                    </td>

                    {/* Collected */}
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>
                        {fmt(s.total_collected, currency, exchangeRate)}
                      </span>
                    </td>

                    {/* Discrepancy */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      {isOpen ? (
                        <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: dc.color, background: dc.bg, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
                          {discLabel(s.cash_difference, currency, exchangeRate)}
                        </span>
                      )}
                    </td>

                    {/* Details */}
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <button
                        onClick={() => setDetailRow(s)}
                        style={{ background: "#F1F5F9", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.textSecond, whiteSpace: "nowrap" }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailRow && <DetailModal shift={detailRow} onClose={() => setDetailRow(null)} />}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color, bg, accent }) {
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : "#fff",
      border: `1px solid ${accent ? "transparent" : C.border}`,
      borderRadius: 14, padding: "16px 18px",
      boxShadow: accent ? `0 4px 20px rgba(109,40,217,.2)` : "0 1px 3px rgba(0,0,0,.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: accent ? "rgba(255,255,255,.18)" : bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={13} color={accent ? "#fff" : color} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: accent ? "rgba(255,255,255,.75)" : C.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: accent ? "#fff" : "#0F172A", letterSpacing: "-1px" }}>{value}</div>
    </div>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function DetailModal({ shift: s, onClose }) {
  const { currency, exchangeRate } = useSettings();
  const dc = discColor(s.cash_difference);

  const rows = [
    ["Shift ID",           `#${s.shift_id}`],
    ["Staff Member",       s.staff_name],
    ["Location / Booth",   s.location || "—"],
    ["Status",             s.status],
    ["Opened At",          fmtFull(s.opened_at)],
    ["Closed At",          fmtFull(s.closed_at)],
    ["Duration",           fmtDuration(s.opened_at, s.closed_at)],
    ["Opening Cash",       fmt(s.opening_cash, currency, exchangeRate)],
    ["Total Transactions", s.total_transactions ?? "—"],
    ["Total Collected",    fmt(s.total_collected, currency, exchangeRate)],
    ["Cash Collected",     fmt(s.cash_collected, currency, exchangeRate)],
    ["Expected Closing",   fmt(s.expected_cash, currency, exchangeRate)],
    ["Reported Closing",   fmt(s.closing_cash, currency, exchangeRate)],
    ["Discrepancy",        discLabel(s.cash_difference, currency, exchangeRate)],
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,.22)", overflow: "hidden" }}>

        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Shift #{s.shift_id}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} color={C.primary} /> {s.location || "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={13} color="#64748B" />
          </button>
        </div>

        {s.cash_difference != null && s.cash_difference !== 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: dc.bg, borderBottom: `1px solid ${dc.color}33` }}>
            <AlertTriangle size={13} color={dc.color} />
            <span style={{ fontSize: 12, fontWeight: 700, color: dc.color }}>
              Cash {s.cash_difference > 0 ? "overage" : "shortage"}: {fmt(Math.abs(s.cash_difference), currency, exchangeRate)}
            </span>
          </div>
        )}
        {s.cash_difference === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", background: C.successBg, borderBottom: `1px solid ${C.primaryBorder}` }}>
            <CheckCircle size={13} color={C.success} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>Cash balanced — no discrepancy</span>
          </div>
        )}

        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", alignItems: "flex-start", padding: "8px 18px", background: i % 2 === 0 ? "#FAFBFC" : "#fff" }}>
              <span style={{ width: 145, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{k}</span>
              <span style={{
                fontSize: 13,
                fontWeight: k === "Total Collected" || k === "Discrepancy" ? 800 : 500,
                color: k === "Total Collected" ? C.primary : k === "Discrepancy" ? dc.color : "#1E293B",
                fontFamily: k === "Shift ID" ? "monospace" : undefined,
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

