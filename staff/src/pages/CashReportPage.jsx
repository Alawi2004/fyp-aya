import { useState } from "react";
import { Printer, AlertTriangle, CheckCircle, TrendingUp, DollarSign, Hash, Clock, CloudOff } from "lucide-react";
import { useShift } from "../context/ShiftContext";
import { useAuth } from "../context/AuthContext";
import { offlineQueue } from "../utils/offlineQueue";
import { C, cardStyle } from "../styles/themes";

const fmt     = (n) => `$${parseFloat(n ?? 0).toFixed(2)}`;
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtFull = (iso) => `${fmtDate(iso)} ${fmtTime(iso)}`;

const METHOD_COLOR = {
  "Cash":               { bg: "#F0FDF4", color: "#065F46" },
  "Card (Debit/Credit)": { bg: "#EFF6FF", color: "#1E40AF" },
  "Mobile Transfer":     { bg: "#FDF4FF", color: "#6B21A8" },
  "Bank Transfer":       { bg: "#FFF7ED", color: "#92400E" },
  "Voucher":             { bg: "#FEFCE8", color: "#713F12" },
  "Other":               { bg: "#F1F5F9", color: "#475569" },
};
const methodStyle = (m) => METHOD_COLOR[m] || METHOD_COLOR["Other"];

export default function CashReportPage() {
  const { shift, lastReport } = useShift();
  const { user }              = useAuth();
  const [showQueued, setShowQueued] = useState(false);

  // Prefer active shift; fall back to last closed report
  const report       = shift || lastReport;
  const isActive     = !!shift;
  const queuedItems  = offlineQueue.getAll();
  const pendingItems = queuedItems.filter(i => i.status === "pending");
  const syncedItems  = queuedItems.filter(i => i.status === "synced");

  if (!report) {
    return (
      <div style={{ padding: "28px 32px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ ...cardStyle, padding: "56px 36px", textAlign: "center" }}>
          <DollarSign size={40} color={C.textMuted} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>No Report Available</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Open a shift and process some top-ups to generate a cash collection report.
          </div>
        </div>
      </div>
    );
  }

  const txList    = report.transactions || [];
  const cashTxs   = txList.filter(t => t.paymentMethod === "Cash");
  const nonCashTxs = txList.filter(t => t.paymentMethod !== "Cash");
  const expectedClosing = (report.opening_cash || 0) + (report.cash_amount || 0);
  const discrepancy = report.closing_cash != null
    ? report.closing_cash - (report.cash_amount || 0)
    : null;
  const isBalanced = discrepancy === 0;
  const isShort    = discrepancy != null && discrepancy < 0;
  const isOver     = discrepancy != null && discrepancy > 0;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
            Cash Collection Report
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
            {isActive ? "Current shift — live data" : `Closed shift · ${fmtFull(report.closed_at)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {pendingItems.length > 0 && (
            <button onClick={() => setShowQueued(s => !s)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8,
              border: "1.5px solid #FCA5A5", background: "#FEF2F2",
              fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.danger,
            }}>
              <CloudOff size={13} /> {pendingItems.length} Pending Sync
            </button>
          )}
          <button onClick={() => window.print()} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            border: `1.5px solid ${C.border}`, background: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.textSecond,
          }}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      <div id="cash-report-print">

        {/* Report slip header — print-friendly */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{
            background: `linear-gradient(135deg, #0F172A, #1E293B)`,
            padding: "20px 28px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-.3px" }}>
                Yalla Transit — Cash Collection Report
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                Shift {report.shift_id} · {report.location}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748B" }}>Generated</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1" }}>{fmtFull(new Date().toISOString())}</div>
            </div>
          </div>

          <div style={{ padding: "16px 28px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, borderBottom: `1px solid ${C.border}` }}>
            {[
              { label: "Staff",       value: user?.full_name ?? "Staff Member" },
              { label: "Station",     value: report.location },
              { label: "Shift ID",    value: report.shift_id },
              { label: "Opened",      value: fmtFull(report.opened_at) },
              { label: "Transactions", value: String(report.tx_count || 0) },
              { label: "Total Processed", value: fmt(report.total_amount) },
              { label: "Cash Collected",  value: fmt(report.cash_amount) },
              { label: isActive ? "Status" : "Closed", value: isActive ? "Active" : fmtFull(report.closed_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Transactions",    value: report.tx_count || 0,         icon: Hash,       color: C.info,    bg: "#EFF6FF" },
            { label: "Total Processed", value: fmt(report.total_amount),     icon: TrendingUp, color: C.primary, bg: C.primaryLight },
            { label: "Cash Collected",  value: fmt(report.cash_amount),      icon: DollarSign, color: C.success, bg: C.successBg },
            { label: "Non-Cash",        value: fmt((report.total_amount||0)-(report.cash_amount||0)), icon: Clock, color: C.warning, bg: C.warningBg },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} style={{ ...cardStyle, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={color} />
                </div>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Transaction table */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Hash size={14} color={C.primary} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Transaction Log</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>({txList.length} records)</span>
          </div>

          {txList.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
              No transactions recorded yet in this shift.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
                    {["#", "Time", "Passenger", "Amount", "Method", "Station", "Receipt No."].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txList.map((tx, i) => {
                    const ms = methodStyle(tx.paymentMethod);
                    return (
                      <tr key={tx.id || i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                        <td style={{ padding: "9px 14px", color: C.textMuted, fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: "9px 14px", color: C.textSecond, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {tx.time ? fmtTime(tx.time) : "—"}
                        </td>
                        <td style={{ padding: "9px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>{tx.userName || "—"}</div>
                          {tx.userId && <div style={{ fontSize: 10, color: C.textMuted }}>#{tx.userId}</div>}
                        </td>
                        <td style={{ padding: "9px 14px", fontWeight: 800, color: C.primary, whiteSpace: "nowrap" }}>
                          +{fmt(tx.amount)}
                        </td>
                        <td style={{ padding: "9px 14px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: ms.bg, color: ms.color }}>
                            {tx.paymentMethod || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "9px 14px", color: C.textSecond, fontSize: 11 }}>
                          {tx.station || "—"}
                        </td>
                        <td style={{ padding: "9px 14px", color: C.textMuted, fontFamily: "monospace", fontSize: 11 }}>
                          {tx.receiptNo || `#${tx.id}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: "#0F172A" }}>Total</td>
                    <td style={{ padding: "10px 14px", fontWeight: 900, color: C.primary, fontSize: 14 }}>{fmt(report.total_amount)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Payment method breakdown */}
        {txList.length > 0 && (() => {
          const byMethod = {};
          txList.forEach(tx => {
            byMethod[tx.paymentMethod] = byMethod[tx.paymentMethod] || { count: 0, total: 0 };
            byMethod[tx.paymentMethod].count++;
            byMethod[tx.paymentMethod].total += tx.amount || 0;
          });
          return (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Breakdown by Payment Method</span>
              </div>
              <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {Object.entries(byMethod).map(([method, { count, total }]) => {
                  const ms = methodStyle(method);
                  return (
                    <div key={method} style={{ background: ms.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${ms.color}22` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ms.color, marginBottom: 6 }}>{method}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{fmt(total)}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{count} transaction{count !== 1 ? "s" : ""}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Cash reconciliation */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <DollarSign size={14} color={C.primary} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Cash Reconciliation</span>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginTop: 16 }}>
              {[
                { label: "Opening Cash",            value: fmt(report.opening_cash),    note: "Cash on hand at shift start"              },
                { label: "Cash Top-Ups Collected",  value: fmt(report.cash_amount),     note: `${cashTxs.length} Cash transactions`       },
                { label: "Expected Closing Cash",   value: fmt(expectedClosing),        note: "Opening + Cash collected", bold: true, accent: C.primary },
                ...(report.closing_cash != null ? [
                  { label: "Reported Closing Cash", value: fmt(report.closing_cash),    note: "As counted by staff"                      },
                  {
                    label:     "Discrepancy",
                    value:     (() => { const d = discrepancy; return `${d > 0 ? "+" : ""}${fmt(Math.abs(d))}`; })(),
                    note:      isBalanced ? "Balanced — no issues" : isShort ? "Shortage" : "Overage",
                    bold:      true,
                    accent:    isBalanced ? C.success : isShort ? C.danger : C.warning,
                    bg:        isBalanced ? "#F0FDF4" : isShort ? "#FEF2F2" : "#FFFBEB",
                  },
                ] : [
                  { label: "Closing Cash",          value: "—",                         note: "Shift not closed yet"                      },
                ]),
              ].map(({ label, value, note, bold, accent, bg }, i) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 16px",
                  background: bg || (i % 2 === 0 ? "#F8FAFC" : "#fff"),
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: "#0F172A" }}>{label}</div>
                    {note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{note}</div>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: accent || "#0F172A", fontFamily: "monospace" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Discrepancy alert */}
            {discrepancy != null && !isBalanced && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 12, marginTop: 14,
                padding: "12px 16px", borderRadius: 10,
                background: isShort ? "#FEF2F2" : "#FFFBEB",
                border: `1.5px solid ${isShort ? "#FCA5A5" : "#FDE68A"}`,
              }}>
                <AlertTriangle size={15} color={isShort ? C.danger : C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isShort ? "#B91C1C" : "#92400E" }}>
                    {isShort ? `Cash shortage of ${fmt(Math.abs(discrepancy))} detected` : `Cash overage of ${fmt(discrepancy)} detected`}
                  </div>
                  <div style={{ fontSize: 12, color: isShort ? "#DC2626" : "#B45309", marginTop: 2 }}>
                    {isShort
                      ? "The drawer has less cash than expected. Please verify all transactions and report to your supervisor."
                      : "The drawer has more cash than expected. Check for unrecorded transactions or mis-categorised payments."
                    }
                  </div>
                </div>
              </div>
            )}

            {discrepancy === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
                <CheckCircle size={15} color={C.success} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#064E3B" }}>Cash balanced — no discrepancy found.</span>
              </div>
            )}
          </div>
        </div>

        {/* Queued / offline transactions panel */}
        {showQueued && pendingItems.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 20, border: `1.5px solid #FCA5A5` }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid #FCA5A5`, background: "#FEF2F2", display: "flex", alignItems: "center", gap: 8 }}>
              <CloudOff size={14} color={C.danger} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Pending Offline Transactions ({pendingItems.length})</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#FEF2F2" }}>
                    {["Queue ID", "Queued At", "Passenger ID", "Amount", "Method", "Signature"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#DC2626", fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item, i) => (
                    <tr key={item.id} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#FEF2F2" }}>
                      <td style={{ padding: "8px 14px", fontFamily: "monospace", color: C.danger, fontWeight: 700 }}>{item.id}</td>
                      <td style={{ padding: "8px 14px", color: C.textSecond }}>{fmtFull(item.created_at)}</td>
                      <td style={{ padding: "8px 14px", color: C.textMuted }}>#{item.payload?.user_id}</td>
                      <td style={{ padding: "8px 14px", fontWeight: 800, color: C.primary }}>{fmt(item.payload?.amount)}</td>
                      <td style={{ padding: "8px 14px", color: C.textSecond }}>{item.payload?.payment_method}</td>
                      <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: 10, color: C.textMuted }}>{item.signature?.slice(0, 16)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report footer — printable */}
        <div style={{ ...cardStyle, padding: "20px 28px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 14 }}>
            Report Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Staff Member</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{user?.full_name ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Location / Station</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{report.location ?? "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cash-report-print,
          #cash-report-print * { visibility: visible !important; }
          #cash-report-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 20px !important;
          }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
