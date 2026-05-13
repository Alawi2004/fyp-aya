import { useState, useEffect, useMemo } from "react";
import apiClient from "../api/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", label: "Active"    },
  suspended: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "Suspended" },
  blocked:   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", label: "Blocked"   },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "3px 10px",
      fontSize: 11, fontWeight: 700,
    }}>
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

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "#2563EB", icon }) {
  return (
    <div className="kpi-card" style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid #E2E8F0",
      padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,.05)",
      flex: 1, minWidth: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Suspend/Block Modal ───────────────────────────────────────────────────────

const REASONS = ["Fraud", "Abuse", "Policy Violation", "Payment Issue", "Security Concern", "Other"];
const DURATIONS = [
  { label: "1 day",   value: 1  },
  { label: "3 days",  value: 3  },
  { label: "7 days",  value: 7  },
  { label: "30 days", value: 30 },
];

function SuspendModal({ passenger, onClose, onDone }) {
  const [tab,      setTab]      = useState("suspend");
  const [reason,   setReason]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [duration, setDuration] = useState(7);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState(null);

  const submit = async () => {
    if (!reason) { setErr("Please select a reason."); return; }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/users/${passenger.user_id}/suspend`, {
        action: tab,
        reason,
        notes: notes || undefined,
        duration_days: tab === "suspend" ? duration : undefined,
      });
      onDone(`User ${tab === "block" ? "blocked" : "suspended"} successfully`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Restrict Account — ${passenger.full_name}`} onClose={onClose}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {["suspend", "block"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none",
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#1E293B" : "#64748B",
              fontWeight: tab === t ? 700 : 500, fontSize: 13,
              cursor: "pointer",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,.08)" : "none",
            }}>
              {t === "suspend" ? "⏸ Suspend (Temporary)" : "🚫 Block (Permanent)"}
            </button>
          ))}
        </div>

        {/* Duration (suspend only) */}
        {tab === "suspend" && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Duration</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => setDuration(d.value)} style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${duration === d.value ? "#2563EB" : "#E2E8F0"}`,
                  background: duration === d.value ? "#EFF6FF" : "#fff",
                  color: duration === d.value ? "#2563EB" : "#374151",
                  cursor: "pointer",
                }}>{d.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
          <select value={reason} onChange={e => setReason(e.target.value)} style={inputSt}>
            <option value="">Select a reason…</option>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Additional details for the audit log…"
            style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {err && <div style={errSt}>{err}</div>}

        {tab === "block" && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
            ⚠️ Blocking is permanent. The passenger will not be able to log in until an admin manually restores their account.
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy || !reason} style={{
            ...primaryBtnSt,
            background: tab === "block" ? (busy || !reason ? "#FCA5A5" : "#DC2626") : (busy || !reason ? "#93C5FD" : "#2563EB"),
          }}>
            {busy ? "Processing…" : tab === "block" ? "Block Account" : `Suspend for ${duration} days`}
          </button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

// ── Restore Modal ─────────────────────────────────────────────────────────────

function RestoreModal({ passenger, onClose, onDone }) {
  const [notes, setNotes] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post(`/users/${passenger.user_id}/restore`, { notes: notes || undefined });
      onDone("Account restored successfully");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Restore Account — ${passenger.full_name}`} onClose={onClose}>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 20 }}>
          This will set the passenger's status back to <strong>Active</strong> and allow them to log in again.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Reason for restoration…"
            style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        {err && <div style={errSt}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...primaryBtnSt, background: busy ? "#A7F3D0" : "#059669" }}>
            {busy ? "Restoring…" : "Restore Account"}
          </button>
        </div>
      </ModalCard>
    </Overlay>
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
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post("/wallet/adjust", {
        user_id: passenger.user_id,
        type,
        amount: parsed,
        reason,
        notes: notes || undefined,
      });
      onDone(`$${parsed.toFixed(2)} ${type}ed to wallet`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isCredit = type === "credit";

  return (
    <Overlay onClose={onClose}>
      <ModalCard title={`Wallet Adjustment — ${passenger.full_name}`} onClose={onClose}>
        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
          Current balance: <strong style={{ color: "#1E293B" }}>${fmt(passenger.wallet_balance)}</strong>
        </p>

        {/* Credit / Debit toggle */}
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {["credit", "debit"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none",
              background: type === t ? "#fff" : "transparent",
              color: type === t ? (t === "credit" ? "#059669" : "#DC2626") : "#64748B",
              fontWeight: type === t ? 700 : 500, fontSize: 13,
              cursor: "pointer",
              boxShadow: type === t ? "0 1px 4px rgba(0,0,0,.08)" : "none",
            }}>
              {t === "credit" ? "➕ Credit" : "➖ Debit"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Amount ($) <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="number" min="0.01" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00" style={inputSt} />
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSt}>Reason <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder={isCredit ? "e.g. Refund for delayed trip" : "e.g. Penalty for policy violation"}
            style={inputSt} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Additional audit notes…"
            style={{ ...inputSt, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {amount && !isNaN(parseFloat(amount)) && (
          <div style={{
            background: isCredit ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${isCredit ? "#A7F3D0" : "#FECACA"}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
            color: isCredit ? "#059669" : "#DC2626",
          }}>
            New balance will be: <strong>${(parseFloat(passenger.wallet_balance) + (isCredit ? 1 : -1) * parseFloat(amount || 0)).toFixed(2)}</strong>
          </div>
        )}

        {err && <div style={errSt}>{err}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={ghostBtnSt}>Cancel</button>
          <button onClick={submit} disabled={busy || !amount || !reason} style={{
            ...primaryBtnSt,
            background: busy || !amount || !reason ? "#93C5FD" : (isCredit ? "#059669" : "#DC2626"),
          }}>
            {busy ? "Processing…" : isCredit ? "Credit Wallet" : "Debit Wallet"}
          </button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

// ── History Drawer ────────────────────────────────────────────────────────────

function HistoryDrawer({ passenger, onClose }) {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    apiClient.get(`/users/${passenger.user_id}/suspension-logs`)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [passenger.user_id]);

  const actionColor = { suspended: "#D97706", blocked: "#DC2626", restore: "#059669" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.3)",
      zIndex: 1000, display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        width: 420, height: "100%", background: "#fff",
        boxShadow: "-8px 0 40px rgba(0,0,0,.12)",
        display: "flex", flexDirection: "column", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>Suspension History</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{passenger.full_name}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          {logs === null ? (
            <p style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</p>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 13 }}>No suspension history</p>
            </div>
          ) : logs.map(log => (
            <div key={log.log_id} style={{
              borderLeft: `3px solid ${actionColor[log.action] || "#94A3B8"}`,
              paddingLeft: 14, marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: actionColor[log.action] || "#374151", textTransform: "capitalize" }}>
                  {log.action}
                </span>
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

// ── Shared modal primitives ───────────────────────────────────────────────────

function Overlay({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({ title, children, onClose }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, width: 480,
      boxShadow: "0 24px 64px rgba(0,0,0,.18)", padding: "28px 32px",
      maxHeight: "90vh", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  );
}

const labelSt   = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };
const inputSt   = { width: "100%", padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14, color: "#1E293B", background: "#F8FAFC", outline: "none", boxSizing: "border-box" };
const errSt     = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 };
const primaryBtnSt = { flex: 1, padding: "11px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const ghostBtnSt   = { padding: "11px 20px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14, fontWeight: 500, color: "#374151", cursor: "pointer" };

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PASSENGERS = [
  { user_id:1,  full_name:"Sara Khalil",    email:"sara@example.com",   phone:"+961 71 000001", status:"active",    wallet_balance:45.50, trip_count:12, created_at:"2025-01-15" },
  { user_id:2,  full_name:"Omar Nassar",    email:"omar@example.com",   phone:"+961 71 000002", status:"active",    wallet_balance:12.00, trip_count:8,  created_at:"2025-02-03" },
  { user_id:3,  full_name:"Layla Haddad",   email:"layla@example.com",  phone:"+961 71 000003", status:"suspended", wallet_balance:0.00,  trip_count:3,  created_at:"2025-03-10" },
  { user_id:4,  full_name:"Karim Jaber",    email:"karim@example.com",  phone:"+961 71 000004", status:"active",    wallet_balance:78.25, trip_count:31, created_at:"2025-01-22" },
  { user_id:5,  full_name:"Maya Saad",      email:"maya@example.com",   phone:"+961 71 000005", status:"blocked",   wallet_balance:0.00,  trip_count:1,  created_at:"2025-04-05" },
  { user_id:6,  full_name:"Ziad Mansour",   email:"ziad@example.com",   phone:"+961 71 000006", status:"active",    wallet_balance:22.75, trip_count:15, created_at:"2025-02-18" },
  { user_id:7,  full_name:"Nour Ibrahim",   email:"nour@example.com",   phone:"+961 71 000007", status:"active",    wallet_balance:5.00,  trip_count:4,  created_at:"2025-03-30" },
  { user_id:8,  full_name:"Rami Azar",      email:"rami@example.com",   phone:"+961 71 000008", status:"suspended", wallet_balance:0.00,  trip_count:7,  created_at:"2025-01-08" },
  { user_id:9,  full_name:"Diana Khoury",   email:"diana@example.com",  phone:"+961 71 000009", status:"active",    wallet_balance:60.00, trip_count:22, created_at:"2024-12-01" },
  { user_id:10, full_name:"Ali Haddad",     email:"ali@example.com",    phone:"+961 71 000010", status:"active",    wallet_balance:33.50, trip_count:18, created_at:"2025-01-30" },
];

// ══════════════════════════════════════════════════════════════════════════════
//  PassengersPage
// ══════════════════════════════════════════════════════════════════════════════

export default function PassengersPage() {
  const [passengers, setPassengers] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [toast,      setToast]      = useState(null);

  // Modal state
  const [suspendTarget,  setSuspendTarget]  = useState(null);
  const [restoreTarget,  setRestoreTarget]  = useState(null);
  const [walletTarget,   setWalletTarget]   = useState(null);
  const [historyTarget,  setHistoryTarget]  = useState(null);

  const load = () => {
    setLoading(true);
    apiClient.get("/users/passengers")
      .then(data => setPassengers(Array.isArray(data) ? data : MOCK_PASSENGERS))
      .catch(() => setPassengers(MOCK_PASSENGERS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDone = (msg) => {
    setSuspendTarget(null);
    setRestoreTarget(null);
    setWalletTarget(null);
    showToast(msg);
    load();
  };

  const visible = useMemo(() => {
    return passengers.filter(p => {
      const matchFilter = filter === "all" || p.status === filter;
      const q = search.toLowerCase();
      const matchSearch = !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q);
      return matchFilter && matchSearch;
    });
  }, [passengers, filter, search]);

  const counts = useMemo(() => ({
    total:     passengers.length,
    active:    passengers.filter(p => p.status === "active").length,
    suspended: passengers.filter(p => p.status === "suspended").length,
    blocked:   passengers.filter(p => p.status === "blocked").length,
    balance:   passengers.reduce((s, p) => s + parseFloat(p.wallet_balance || 0), 0),
  }), [passengers]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 2000,
          background: "#1E293B", color: "#fff", borderRadius: 10,
          padding: "12px 20px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,.2)",
          animation: "fadeIn .2s ease",
        }}>{toast}</div>
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px", marginBottom: 4 }}>Passengers</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>Manage passenger accounts, statuses, and wallet balances</p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <KPI label="Total Passengers" value={counts.total}                         icon="👥" color="#2563EB" />
        <KPI label="Active"           value={counts.active}                        icon="✅" color="#059669" />
        <KPI label="Suspended"        value={counts.suspended}                     icon="⏸" color="#D97706" />
        <KPI label="Blocked"          value={counts.blocked}                       icon="🚫" color="#DC2626" />
        <KPI label="Total Balance"    value={`$${counts.balance.toFixed(2)}`}      icon="💰" color="#7C3AED" sub="Across all wallets" />
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
        padding: "14px 18px", marginBottom: 16,
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 14 }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            style={{ width: "100%", padding: "9px 14px 9px 34px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 13, color: "#1E293B", background: "#F8FAFC", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Status filter */}
        {["all", "active", "suspended", "blocked"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${filter === f ? "#2563EB" : "#E2E8F0"}`,
            background: filter === f ? "#EFF6FF" : "#fff",
            color: filter === f ? "#2563EB" : "#64748B",
            cursor: "pointer", textTransform: "capitalize",
          }}>{f === "all" ? `All (${counts.total})` : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 180px",
          padding: "12px 20px", borderBottom: "1px solid #F1F5F9",
          background: "#F8FAFC",
        }}>
          {["Name", "Email", "Status", "Balance", "Trips", "Joined", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Loading passengers…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>No passengers match your filter.</div>
        ) : visible.map((p, i) => (
          <div key={p.user_id} className="table-row" style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 180px",
            padding: "14px 20px", borderBottom: "1px solid #F8FAFC",
            alignItems: "center",
            background: i % 2 === 0 ? "#fff" : "#FAFBFC",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1E293B" }}>{p.full_name}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.phone || "—"}</div>
            </div>
            <div style={{ fontSize: 13, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
            <div><StatusBadge status={p.status} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>${fmt(p.wallet_balance)}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>{p.trip_count ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{relDate(p.created_at)}</div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {/* Wallet */}
              <button
                onClick={() => setWalletTarget(p)}
                title="Adjust wallet"
                style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >💰</button>

              {/* Suspend / Block */}
              {p.status === "active" && (
                <button
                  onClick={() => setSuspendTarget(p)}
                  title="Suspend or block"
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#D97706", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >⏸</button>
              )}

              {/* Restore */}
              {p.status !== "active" && (
                <button
                  onClick={() => setRestoreTarget(p)}
                  title="Restore account"
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #A7F3D0", background: "#ECFDF5", color: "#059669", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >↩</button>
              )}

              {/* History */}
              <button
                onClick={() => setHistoryTarget(p)}
                title="Suspension history"
                style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: 12, cursor: "pointer" }}
              >📋</button>
            </div>
          </div>
        ))}

        {/* Footer count */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9", background: "#F8FAFC", fontSize: 12, color: "#94A3B8" }}>
          Showing {visible.length} of {passengers.length} passengers
        </div>
      </div>

      {/* ── Modals ── */}
      {suspendTarget && <SuspendModal  passenger={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={handleDone} />}
      {restoreTarget && <RestoreModal  passenger={restoreTarget} onClose={() => setRestoreTarget(null)} onDone={handleDone} />}
      {walletTarget  && <WalletModal   passenger={walletTarget}  onClose={() => setWalletTarget(null)}  onDone={handleDone} />}
      {historyTarget && <HistoryDrawer passenger={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
