import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../api/apiClient";
import { createUser, updateUser, deleteUserApi } from "../api/endpoints";
import { Modal } from "../components/Modal";

// ── SVG icon set ──────────────────────────────────────────────────────────────
const Ico = {
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  users:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  check:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  pause:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  ban:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  wallet:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  history: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  restore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  eye:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  edit:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>,
  trash:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  blocked: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  coin:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8"/></svg>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "Active"    },
  inactive:  { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0", label: "Inactive"  },
  suspended: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "Suspended" },
  blocked:   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Blocked"   },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status?.toLowerCase()] || STATUS_STYLES.active;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
}

function fmt(n) { return parseFloat(n || 0).toFixed(2); }
function relDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Icon action button ────────────────────────────────────────────────────────
function IconBtn({ icon, title, onClick, color = "#374151", bg = "#F8FAFC", border = "#E2E8F0" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1px solid ${border}`, background: bg, color, cursor: "pointer", flexShrink: 0 }}
      onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.93)"}
      onMouseLeave={e => e.currentTarget.style.filter = "none"}
    >
      {icon}
    </button>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "#2563EB", icon }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,.05)", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Wallet Adjust Modal ───────────────────────────────────────────────────────

function WalletModal({ passenger, onClose, onDone }) {
  const [type,   setType]   = useState("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes,  setNotes]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState(null);

  const submit = async () => {
    if (!amount || !reason) { setErr("Amount and reason are required."); return; }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setErr("Enter a valid positive amount."); return; }
    setBusy(true); setErr(null);
    try {
      await apiClient.post("/wallet/adjust", { user_id: passenger.user_id, type, amount: parsed, reason, notes: notes || undefined });
      onDone(`OMR ${parsed.toFixed(2)} ${type}ed successfully`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const isCredit = type === "credit";
  const newBalance = (parseFloat(passenger.wallet_balance || 0) + (isCredit ? 1 : -1) * parseFloat(amount || 0));

  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Wallet Adjustment — ${passenger.full_name}`} onClose={onClose}>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
          Current balance: <strong style={{ color: "#1E293B" }}>OMR {fmt(passenger.wallet_balance)}</strong>
        </p>
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {["credit", "debit"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: type === t ? "#fff" : "transparent", color: type === t ? (t === "credit" ? "#059669" : "#DC2626") : "#64748B", fontWeight: type === t ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: type === t ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
              {t === "credit" ? "+ Credit" : "- Debit"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Amount (OMR) <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputSt} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder={isCredit ? "e.g. Refund for delayed trip" : "e.g. Penalty for policy violation"} style={inputSt} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        {amount && !isNaN(parseFloat(amount)) && (
          <div style={{ background: isCredit ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${isCredit ? "#A7F3D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: isCredit ? "#059669" : "#DC2626" }}>
            New balance: <strong>OMR {newBalance.toFixed(2)}</strong>
          </div>
        )}
        {err && <div style={errSt}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy || !amount || !reason} style={{ ...primaryBtnSt, background: busy || !amount || !reason ? "#93C5FD" : (isCredit ? "#059669" : "#DC2626") }}>
            {busy ? "Processing…" : isCredit ? "Credit Wallet" : "Debit Wallet"}
          </button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

// ── Passenger Profile Drawer ──────────────────────────────────────────────────

function PassengerProfileDrawer({ passenger, onClose, onEdit, onWallet }) {
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    apiClient.get(`/users/${passenger.user_id}/tickets`)
      .then(data => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]));
  }, [passenger.user_id]);

  const initials = (passenger.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const nationalId = "IC-" + String(passenger.user_id).padStart(6, "0") + "X";
  const completedCount = (tickets || []).filter(t => ["completed", "confirmed"].includes(t.status?.toLowerCase())).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px);opacity:0 } to { transform:none;opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />
      <div style={{ width: "min(92vw, 560px)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,.14)", overflowY: "auto", animation: "slideInRight .25s ease" }}>

        {/* Header */}
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Passenger Profile</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onWallet(passenger)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#059669", fontSize: 12, fontWeight: 600 }}>
                {Ico.wallet} Wallet
              </button>
              <button onClick={() => onEdit(passenger)} style={{ background: "#F5F3FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#6D28D9", fontSize: 12, fontWeight: 600 }}>
                Edit
              </button>
              <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: "#F5F3FF", border: "3px solid #6D28D930", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#6D28D9" }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{passenger.full_name}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{passenger.email}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#F5F3FF", color: "#6D28D9" }}>Passenger</span>
                <StatusBadge status={passenger.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Identity & Contact */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>Identity &amp; Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "National ID",    value: nationalId },
              { label: "Date of Birth",  value: passenger.birth_date ? relDate(passenger.birth_date) : "—" },
              { label: "Wallet Balance", value: `OMR ${fmt(passenger.wallet_balance)}`, accent: "#059669" },
              { label: "Phone",          value: passenger.phone || "—" },
              { label: "Joined",         value: relDate(passenger.created_at) },
              { label: "Total Trips",    value: passenger.trip_count ?? 0 },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: accent ?? "#0F172A" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trip History */}
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8" }}>Trip History</div>
            {tickets && <span style={{ fontSize: 11, color: "#64748B" }}>{completedCount} completed · {tickets.length - completedCount} other</span>}
          </div>
          {tickets === null ? (
            <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "20px 0" }}>Loading…</div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>No trips found</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tickets.slice(0, 10).map((t, i) => {
                const isOk = ["completed", "confirmed"].includes(t.status?.toLowerCase() ?? "");
                return (
                  <div key={t.ticket_id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.route_name ?? (t.trip_id ? `Trip #${t.trip_id}` : `Ticket #${t.ticket_id}`)}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{relDate(t.created_at ?? t.booked_at)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {t.fare != null && <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>OMR {fmt(t.fare)}</div>}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: isOk ? "#F0FDF4" : "#FEF2F2", color: isOk ? "#059669" : "#DC2626" }}>{t.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suspend/Block Modal ───────────────────────────────────────────────────────

const REASONS   = ["Fraud", "Abuse", "Policy Violation", "Payment Issue", "Security Concern", "Other"];
const DURATIONS = [{ label: "1 day", value: 1 }, { label: "3 days", value: 3 }, { label: "7 days", value: 7 }, { label: "30 days", value: 30 }];

function SuspendModal({ passenger, onClose, onDone }) {
  const [tab, setTab]           = useState("suspend");
  const [reason, setReason]     = useState("");
  const [notes, setNotes]       = useState("");
  const [duration, setDuration] = useState(7);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);

  const submit = async () => {
    if (!reason) { setErr("Please select a reason."); return; }
    setBusy(true); setErr(null);
    try {
      await apiClient.post(`/users/${passenger.user_id}/suspend`, { action: tab, reason, notes: notes || undefined, duration_days: tab === "suspend" ? duration : undefined });
      onDone(`User ${tab === "block" ? "blocked" : "suspended"} successfully`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Restrict Account — ${passenger.full_name}`} onClose={onClose}>
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {["suspend", "block"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1E293B" : "#64748B", fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
              {t === "suspend" ? "Suspend (Temporary)" : "Block (Permanent)"}
            </button>
          ))}
        </div>
        {tab === "suspend" && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Duration</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1.5px solid ${duration === d.value ? "#2563EB" : "#E2E8F0"}`, background: duration === d.value ? "#EFF6FF" : "#fff", color: duration === d.value ? "#2563EB" : "#374151", cursor: "pointer" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
          <select value={reason} onChange={e => setReason(e.target.value)} style={inputSt}>
            <option value="">Select a reason…</option>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional details…" style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        {err && <div style={errSt}>{err}</div>}
        {tab === "block" && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>Blocking is permanent — the passenger cannot log in until manually restored.</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy || !reason} style={{ ...primaryBtnSt, background: tab === "block" ? "#DC2626" : "#2563EB" }}>
            {busy ? "Processing…" : tab === "block" ? "Block Account" : `Suspend for ${duration}d`}
          </button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

function RestoreModal({ passenger, onClose, onDone }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await apiClient.post(`/users/${passenger.user_id}/restore`, { notes: notes || undefined }); onDone("Account restored successfully"); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Restore — ${passenger.full_name}`} onClose={onClose}>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 20 }}>Sets status back to <strong>Active</strong>.</p>
        <div style={{ marginBottom: 20 }}><label style={labelSt}>Notes (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} /></div>
        {err && <div style={errSt}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...primaryBtnSt, background: "#059669" }}>{busy ? "Restoring…" : "Restore Account"}</button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

function HistoryDrawer({ passenger, onClose }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    apiClient.get(`/users/${passenger.user_id}/suspension-logs`).then(setLogs).catch(() => setLogs([]));
  }, [passenger.user_id]);
  const actionColor = { suspended: "#D97706", blocked: "#DC2626", restore: "#059669" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 420, height: "100%", background: "#fff", boxShadow: "-8px 0 40px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Suspension History</div><div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{passenger.full_name}</div></div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          {logs === null ? <p style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</p>
            : logs.length === 0
              ? <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}><div style={{ fontSize: 32, marginBottom: 8, color: "#059669" }}>✓</div><p style={{ fontSize: 13 }}>No history</p></div>
              : logs.map(log => (
                <div key={log.log_id} style={{ borderLeft: `3px solid ${actionColor[log.action] || "#94A3B8"}`, paddingLeft: 14, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: actionColor[log.action] || "#374151", textTransform: "capitalize" }}>{log.action}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{relDate(log.acted_at)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#374151", margin: "4px 0 2px" }}><strong>Reason:</strong> {log.reason}</p>
                  {log.notes && <p style={{ fontSize: 12, color: "#64748B" }}>{log.notes}</p>}
                  {log.suspended_until && <p style={{ fontSize: 12, color: "#D97706" }}>Until: {relDate(log.suspended_until)}</p>}
                  <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>By: {log.acted_by_name}</p>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({ title, children, onClose }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,.18)", padding: "28px 32px", maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  );
}

const labelSt      = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };
const inputSt      = { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14, color: "#1E293B", background: "#F8FAFC", outline: "none", boxSizing: "border-box" };
const errSt        = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 };
const primaryBtnSt = { flex: 1, padding: "11px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const ghostBtnSt   = { padding: "11px 20px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14, fontWeight: 500, color: "#374151", cursor: "pointer" };
const fldSt        = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ══════════════════════════════════════════════════════════════════════════════
//  PassengersPage
// ══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM = { name: "", email: "", password: "", phone: "", birthDate: "", status: "Active" };
const today = new Date().toISOString().slice(0, 10);

export default function PassengersPage() {
  const [passengers,    setPassengers]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState("all");
  const [toast,         setToast]         = useState(null);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saveError,    setSaveError]    = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [deleteError,  setDeleteError]  = useState(null);

  const [profileTarget, setProfileTarget] = useState(null);
  const [walletTarget,  setWalletTarget]  = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.get("/users/passengers/list")
      .then(data => setPassengers(Array.isArray(data) ? data : []))
      .catch(() => setPassengers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleDone = (msg) => {
    setSuspendTarget(null); setRestoreTarget(null); setWalletTarget(null);
    showToast(msg); load();
  };

  const visible = useMemo(() => passengers.filter(p => {
    const matchFilter = filter === "all" || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q);
    return matchFilter && matchSearch;
  }), [passengers, filter, search]);

  const counts = useMemo(() => ({
    total:     passengers.length,
    active:    passengers.filter(p => p.status === "active").length,
    suspended: passengers.filter(p => p.status === "suspended").length,
    blocked:   passengers.filter(p => p.status === "blocked").length,
    balance:   passengers.reduce((s, p) => s + parseFloat(p.wallet_balance || 0), 0),
  }), [passengers]);

  function openAdd() { setEditTarget(null); setForm(EMPTY_FORM); setSaveError(null); setModalOpen(true); }
  function openEdit(p) {
    setEditTarget(p);
    setForm({ name: p.full_name ?? "", email: p.email ?? "", password: "", phone: p.phone ?? "", birthDate: p.birth_date ? p.birth_date.slice(0, 10) : "", status: p.status ?? "active" });
    setSaveError(null); setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name)  { setSaveError("Full name is required."); return; }
    if (!form.email) { setSaveError("Email is required."); return; }
    if (!editTarget && !form.password) { setSaveError("Password is required."); return; }
    if (form.birthDate && form.birthDate > today) { setSaveError("Date of birth cannot be in the future."); return; }
    setSaveError(null); setIsSaving(true);
    try {
      if (editTarget) {
        await updateUser(editTarget.user_id, { full_name: form.name, phone: form.phone || null, status: form.status, birth_date: form.birthDate || null });
      } else {
        await createUser({ full_name: form.name, email: form.email, password: form.password, phone: form.phone || null, birth_date: form.birthDate || null, role: "passenger" });
      }
      setModalOpen(false); load();
    } catch (err) { setSaveError(err?.message ?? "Save failed"); }
    finally { setIsSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try { await deleteUserApi(deleteTarget.user_id); setDeleteTarget(null); load(); }
    catch (err) { setDeleteError(err?.message ?? "Delete failed"); }
    finally { setIsDeleting(false); }
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 2000, background: "#1E293B", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px", marginBottom: 4 }}>Passengers</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Manage passenger accounts, statuses, and wallet balances</p>
        </div>
        <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add passenger
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <KPI label="Total"      value={counts.total}                         icon={Ico.users}   color="#2563EB" />
        <KPI label="Active"     value={counts.active}                        icon={Ico.check}   color="#059669" />
        <KPI label="Suspended"  value={counts.suspended}                     icon={Ico.pause}   color="#D97706" />
        <KPI label="Blocked"    value={counts.blocked}                       icon={Ico.blocked} color="#DC2626" />
        <KPI label="Total Balance" value={`OMR ${counts.balance.toFixed(2)}`} icon={Ico.coin}   color="#7C3AED" sub="Across all wallets" />
      </div>

      {/* Filter bar */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 18px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}>{Ico.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone…"
            style={{ width: "100%", padding: "9px 14px 9px 32px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        {["all", "active", "suspended", "blocked"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1.5px solid ${filter === f ? "#2563EB" : "#E2E8F0"}`, background: filter === f ? "#EFF6FF" : "#fff", color: filter === f ? "#2563EB" : "#64748B", cursor: "pointer", textTransform: "capitalize" }}>
            {f === "all" ? `All (${counts.total})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr auto", padding: "12px 20px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
          {["Name", "Email", "Status", "Balance", "Trips", "Joined", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Loading passengers…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>No passengers match your filter.</div>
        ) : visible.map((p, i) => (
          <div key={p.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr auto", padding: "12px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1E293B" }}>{p.full_name}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.phone || "—"}</div>
            </div>
            <div style={{ fontSize: 13, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
            <div><StatusBadge status={p.status} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>OMR {fmt(p.wallet_balance)}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>{p.trip_count ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{relDate(p.created_at)}</div>

            {/* Action icon buttons — all in one line */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <IconBtn icon={Ico.eye}     title="Profile"            onClick={() => setProfileTarget(p)} color="#6D28D9" bg="#F5F3FF" border="#DDD6FE" />
              <IconBtn icon={Ico.edit}    title="Edit"               onClick={() => openEdit(p)}          color="#2563EB" bg="#EFF6FF" border="#BFDBFE" />
              <IconBtn icon={Ico.wallet}  title="Adjust wallet"      onClick={() => setWalletTarget(p)}  color="#059669" bg="#ECFDF5" border="#A7F3D0" />
              <IconBtn icon={Ico.trash}   title="Delete"             onClick={() => { setDeleteTarget(p); setDeleteError(null); }} color="#B91C1C" bg="#FEF2F2" border="#FECACA" />
              {p.status === "active"
                ? <IconBtn icon={Ico.pause}   title="Suspend / Block" onClick={() => setSuspendTarget(p)} color="#D97706" bg="#FFFBEB" border="#FDE68A" />
                : <IconBtn icon={Ico.restore} title="Restore account" onClick={() => setRestoreTarget(p)} color="#059669" bg="#ECFDF5" border="#A7F3D0" />}
              <IconBtn icon={Ico.history} title="Suspension history"  onClick={() => setHistoryTarget(p)} color="#64748B" bg="#F8FAFC" border="#E2E8F0" />
            </div>
          </div>
        ))}

        <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9", background: "#F8FAFC", fontSize: 12, color: "#94A3B8" }}>
          Showing {visible.length} of {passengers.length} passengers
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal title={editTarget ? `Edit — ${editTarget.full_name}` : "Add new passenger"} onClose={() => { setModalOpen(false); setSaveError(null); }} onSave={handleSave} saving={isSaving}>
          {saveError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{saveError}</div>}
          {[
            { label: "Full name *",  key: "name",     type: "text" },
            { label: "Email *",      key: "email",    type: "email",    disabled: !!editTarget },
            ...(editTarget ? [] : [{ label: "Password *", key: "password", type: "password" }]),
            { label: "Phone",        key: "phone",    type: "text" },
          ].map(({ label, key, type, disabled }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{label}</label>
              <input type={type} value={form[key] ?? ""} disabled={disabled} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...fldSt, background: disabled ? "#F8FAFC" : "#fff" }} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Date of Birth <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
            <input type="date" value={form.birthDate ?? ""} max={today} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} style={fldSt} />
          </div>
          {editTarget && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={fldSt}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <Modal title="Delete passenger" onClose={() => { setDeleteTarget(null); setDeleteError(null); setIsDeleting(false); }}>
          {deleteError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{deleteError}</div>}
          <p style={{ fontSize: 14, color: "#333", marginBottom: 6 }}>Permanently delete <strong>{deleteTarget.full_name}</strong>?</p>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>{deleteTarget.email} — this cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Profile Drawer */}
      {profileTarget && (
        <PassengerProfileDrawer
          passenger={profileTarget}
          onClose={() => setProfileTarget(null)}
          onEdit={p => { setProfileTarget(null); openEdit(p); }}
          onWallet={p => { setProfileTarget(null); setWalletTarget(p); }}
        />
      )}

      {walletTarget  && <WalletModal   passenger={walletTarget}  onClose={() => setWalletTarget(null)}  onDone={handleDone} />}
      {suspendTarget && <SuspendModal  passenger={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={handleDone} />}
      {restoreTarget && <RestoreModal  passenger={restoreTarget} onClose={() => setRestoreTarget(null)} onDone={handleDone} />}
      {historyTarget && <HistoryDrawer passenger={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
