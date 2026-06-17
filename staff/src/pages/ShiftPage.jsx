import { useState } from "react";
import {
  Clock, DollarSign, Hash, MapPin, TrendingUp, CheckCircle,
  AlertTriangle, LogIn, LogOut, Printer, ChevronRight, X,
  BarChart2, ArrowRight,
} from "lucide-react";
import { useShift } from "../context/ShiftContext";
import { useSettings } from "../context/SettingsContext";
import { C, cardStyle, inputStyle, labelStyle, btnPrimary } from "../styles/themes";

const LOCATIONS = [
  "Central Bus Station — Main Office",
  "Hamra Kiosk",
  "Tripoli Terminal",
  "Airport Transit Hub",
  "Saida Station",
  "Jounieh Booth",
  "Other",
];

const fmt  = (n, cur = "USD", rate = 1) => { const v = (parseFloat(n ?? 0)) * rate; const dec = rate >= 100 ? 0 : 2; return `${cur} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`; };
const fmtDuration = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtDateTime = (iso) => new Date(iso).toLocaleString("en-GB", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

export default function ShiftPage() {
  const { shift, isShiftOpen, openShift, closeShift } = useShift();
  const { currency, exchangeRate } = useSettings();

  const [openForm,    setOpenForm]    = useState({ opening_cash: "", location: LOCATIONS[0] });
  const [openErr,     setOpenErr]     = useState({});
  const [openLoading, setOpenLoading] = useState(false);
  const [showClose,   setShowClose]   = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [closeErr,    setCloseErr]    = useState(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [summary,     setSummary]     = useState(null);

  // ── Open shift ────────────────────────────────────────────────────────────
  const validateOpen = () => {
    const e = {};
    const cash = parseFloat(openForm.opening_cash);
    if (isNaN(cash) || cash < 0)        e.opening_cash = "Enter a valid opening cash amount (0 or more)";
    if (!openForm.location.trim())       e.location     = "Location is required";
    setOpenErr(e);
    return Object.keys(e).length === 0;
  };

  const handleOpenShift = async () => {
    if (!validateOpen()) return;
    setOpenLoading(true);
    try {
      await openShift({ opening_cash: openForm.opening_cash, location: openForm.location });
      setOpenForm({ opening_cash: "", location: LOCATIONS[0] });
      setOpenErr({});
    } catch (err) {
      setOpenErr(e => ({ ...e, _api: err.message }));
    } finally {
      setOpenLoading(false);
    }
  };

  // ── Close shift ───────────────────────────────────────────────────────────
  const cashIn  = shift?.cash_amount   ?? 0;
  const diff    = parseFloat(closingCash || 0) - cashIn;
  const isOver  = diff > 0;
  const isShort = diff < 0;

  const handleCloseShift = async () => {
    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) { setCloseErr("Enter a valid closing cash amount"); return; }
    setCloseErr(null);
    setCloseLoading(true);
    try {
      const s = await closeShift(closingCash);
      setSummary(s);
      setShowClose(false);
      setClosingCash("");
    } catch (err) {
      setCloseErr(err.message);
    } finally {
      setCloseLoading(false);
    }
  };

  // ── Post-close: print summary ─────────────────────────────────────────────
  const printSummary = () => window.print();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
          Shift Management
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
          Open a shift before processing top-ups. Close with a cash summary at end of day.
        </p>
      </div>

      {/* ══════════ POST-CLOSE SUMMARY ══════════ */}
      {summary && !isShiftOpen && (
        <div style={cardStyle} id="shift-summary-print">
          <div style={{
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            padding: "24px 28px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle size={24} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Shift Closed</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
                  {summary.shift_id} · {summary.location}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 28 }}>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Transactions",   value: summary.tx_count,                  icon: Hash,        color: C.info },
                { label: "Total Processed",value: fmt(summary.total_amount, currency, exchangeRate),         icon: TrendingUp,  color: C.primary },
                { label: "Cash Collected", value: fmt(summary.cash_amount, currency, exchangeRate),          icon: DollarSign,  color: C.success },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ background: "#F8FAFC", borderRadius: 12, padding: "16px", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon size={16} color={color} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Cash reconciliation */}
            <div style={{ background: "#F8FAFC", borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>
                Cash Reconciliation
              </div>
              {[
                ["Opening Cash",  fmt(summary.opening_cash, currency, exchangeRate)],
                ["Cash Received", fmt(summary.cash_amount, currency, exchangeRate)],
                ["Closing Cash",  fmt(summary.closing_cash, currency, exchangeRate)],
                ["Discrepancy",   (() => {
                  const d = summary.closing_cash - summary.cash_amount;
                  const sign = d > 0 ? "+" : "";
                  return { label: `${sign}${fmt(Math.abs(d), currency, exchangeRate)}`, color: d === 0 ? C.success : d > 0 ? C.warning : C.danger };
                })()],
              ].map(([k, v], i) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 16px",
                  background: i % 2 === 0 ? "#fff" : "#F8FAFC",
                  borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                }}>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{k}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: typeof v === "object" ? v.color : "#0F172A",
                  }}>
                    {typeof v === "object" ? v.label : v}
                  </span>
                </div>
              ))}
            </div>

            {/* Shift times */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <TimeChip label="Opened"    value={fmtDateTime(summary.opened_at)} />
              <ArrowRight size={16} color={C.textMuted} style={{ alignSelf: "center", flexShrink: 0, marginTop: 12 }} />
              <TimeChip label="Closed"    value={fmtDateTime(summary.closed_at)} />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={printSummary}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 10,
                  border: `1.5px solid ${C.border}`, background: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.textSecond,
                }}
              >
                <Printer size={15} /> Print Summary
              </button>
              <button
                onClick={() => setSummary(null)}
                style={{ ...btnPrimary, padding: "10px 18px" }}
              >
                Open New Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ NO SHIFT OPEN ══════════ */}
      {!isShiftOpen && !summary && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

          {/* Open shift form */}
          <div style={cardStyle}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid #F1F5F9`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <LogIn size={15} color={C.primary} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Open New Shift</span>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

              <div>
                <label style={labelStyle}>Opening Cash on Hand (USD)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 800, color: "#475569" }}>$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={openForm.opening_cash}
                    onChange={e => setOpenForm(p => ({ ...p, opening_cash: e.target.value }))}
                    placeholder="0.00"
                    style={{ ...inputStyle, paddingLeft: 28 }}
                  />
                </div>
                {openErr.opening_cash && <ErrMsg msg={openErr.opening_cash} />}
              </div>

              <div>
                <label style={labelStyle}>Station / Location *</label>
                <select
                  value={openForm.location}
                  onChange={e => setOpenForm(p => ({ ...p, location: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {openErr.location && <ErrMsg msg={openErr.location} />}
              </div>

              <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px", display: "flex", gap: 10 }}>
                <Clock size={15} color={C.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Shift will start at</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                    {new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>

              {openErr._api && <ErrMsg msg={openErr._api} />}
              <button onClick={handleOpenShift} disabled={openLoading} style={{ ...btnPrimary, width: "100%", padding: "13px", fontSize: 15, gap: 8, opacity: openLoading ? 0.75 : 1, cursor: openLoading ? "not-allowed" : "pointer" }}>
                <LogIn size={16} /> {openLoading ? "Opening…" : "Open Shift"}
              </button>
            </div>
          </div>

          {/* Info card */}
          <div style={{ ...cardStyle, background: C.primaryLight, border: `1px solid ${C.primaryBorder}` }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.primaryBorder}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.primaryDark }}>Why Open a Shift?</span>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "All top-up transactions are linked to your active shift",
                "Cash is reconciled at shift close to detect discrepancies",
                "Shift data is reviewed by admin for audit and compliance",
                "You cannot process top-ups without an open shift",
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: C.primary, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 13, color: C.primaryDark, lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SHIFT OPEN ══════════ */}
      {isShiftOpen && shift && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Active shift banner */}
          <div style={{
            background: C.successBg, border: `1.5px solid #BBF7D0`, borderRadius: 14,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: C.primary, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <CheckCircle size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#064E3B" }}>Shift Active — {shift.shift_id}</div>
              <div style={{ fontSize: 12, color: "#065F46", marginTop: 2 }}>
                {shift.location} · Opened {fmtDateTime(shift.opened_at)} · Running for {fmtDuration(shift.opened_at)}
              </div>
            </div>
            <button
              onClick={() => setShowClose(s => !s)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8, border: "1.5px solid #86EFAC",
                background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#064E3B",
              }}
            >
              <LogOut size={14} /> Close Shift
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Transactions",    value: shift.tx_count,           icon: Hash,       color: C.info,    bg: C.infoBg },
              { label: "Total Processed", value: fmt(shift.total_amount, currency, exchangeRate),  icon: TrendingUp, color: C.primary, bg: C.primaryLight },
              { label: "Cash Collected",  value: fmt(shift.cash_amount, currency, exchangeRate),   icon: DollarSign, color: C.success, bg: C.successBg },
              { label: "Opening Cash",    value: fmt(shift.opening_cash, currency, exchangeRate),  icon: MapPin,     color: C.warning, bg: C.warningBg },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} style={{ ...cardStyle, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color={color} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Close shift panel */}
          {showClose && (
            <div style={cardStyle}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid #F1F5F9`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LogOut size={16} color={C.danger} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Close Shift</span>
                </div>
                <button onClick={() => setShowClose(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={16} color={C.textMuted} />
                </button>
              </div>
              <div style={{ padding: 24 }}>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>
                  Count the physical cash in your drawer and enter the total below. Any discrepancy will be flagged in the admin reconciliation report.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Cash Collected This Shift (System)</label>
                    <div style={{
                      padding: "10px 14px", borderRadius: 10,
                      border: `1.5px solid ${C.primaryBorder}`, background: C.primaryLight,
                      fontSize: 18, fontWeight: 800, color: C.primary,
                    }}>
                      {fmt(cashIn, currency, exchangeRate)}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Sum of all Cash payment top-ups</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Closing Cash in Drawer (USD) *</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 800, color: "#475569" }}>$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={closingCash}
                        onChange={e => { setClosingCash(e.target.value); setCloseErr(null); }}
                        placeholder="0.00"
                        autoFocus
                        style={{ ...inputStyle, paddingLeft: 28 }}
                      />
                    </div>
                    {closeErr && <ErrMsg msg={closeErr} />}
                  </div>
                </div>

                {/* Live discrepancy */}
                {closingCash !== "" && !isNaN(parseFloat(closingCash)) && (
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "14px 16px", borderRadius: 10, marginBottom: 20,
                    background: diff === 0 ? C.successBg : isShort ? C.dangerBg : C.warningBg,
                    border: `1.5px solid ${diff === 0 ? "#BBF7D0" : isShort ? "#FCA5A5" : "#FDE68A"}`,
                  }}>
                    {diff === 0
                      ? <CheckCircle size={16} color={C.success} style={{ flexShrink: 0, marginTop: 1 }} />
                      : <AlertTriangle size={16} color={isShort ? C.danger : C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: diff === 0 ? "#064E3B" : isShort ? "#B91C1C" : "#92400E" }}>
                        {diff === 0 ? "Balanced — no discrepancy" : isShort ? `Short by ${fmt(Math.abs(diff), currency)}` : `Over by ${fmt(diff, currency, exchangeRate)}`}
                      </div>
                      {diff !== 0 && (
                        <div style={{ fontSize: 12, marginTop: 2, color: isShort ? "#DC2626" : "#B45309" }}>
                          {isShort
                            ? "The drawer has less cash than expected. This will be flagged for review."
                            : "The drawer has more cash than expected. Check for unrecorded transactions."
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setShowClose(false)} style={{
                    flex: 1, padding: "11px", borderRadius: 10,
                    border: `1.5px solid ${C.border}`, background: "#fff",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", color: C.textSecond,
                  }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleCloseShift}
                    disabled={closeLoading}
                    style={{
                      flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "11px", borderRadius: 10, border: "none",
                      background: `linear-gradient(135deg, #DC2626, #B91C1C)`,
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      cursor: closeLoading ? "not-allowed" : "pointer",
                      opacity: closeLoading ? 0.75 : 1,
                      boxShadow: "0 4px 14px rgba(220,38,38,.28)",
                    }}
                  >
                    <LogOut size={15} /> {closeLoading ? "Closing…" : "Confirm Close Shift"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Shift detail row */}
          <div style={{ ...cardStyle }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid #F1F5F9` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Shift Details</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <InfoRow label="Shift ID"      value={shift.shift_id} mono />
                <InfoRow label="Station"       value={shift.location} />
                <InfoRow label="Duration"      value={fmtDuration(shift.opened_at)} />
                <InfoRow label="Opened At"     value={fmtDateTime(shift.opened_at)} />
                <InfoRow label="Non-Cash Received" value={fmt((shift.total_amount || 0) - (shift.cash_amount || 0), currency, exchangeRate)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #shift-summary-print,
          #shift-summary-print * { visibility: visible !important; }
          #shift-summary-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 24px !important;
          }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function ErrMsg({ msg }) {
  return <div style={{ fontSize: 11, color: C.danger, marginTop: 4, fontWeight: 500 }}>{msg}</div>;
}

function TimeChip({ label, value }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px", flex: 1 }}>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontFamily: mono ? "monospace" : undefined }}>{value}</div>
    </div>
  );
}
