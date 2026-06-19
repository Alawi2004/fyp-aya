import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import {
  getStaffAccounts, updateStaffAccount,
  getStaffTransactions, getSuspiciousTransactions,
} from "../api/endpoints";
import { useSettings } from "../context/SettingsContext";
import { fmtMoney } from "../utils/fmt";

// ── Flag config ───────────────────────────────────────────────────────────────
const FLAG_CONFIG = {
  rapid_sequence: { label: "Rapid Sequence", color: "#D97706", bg: "#FFFBEB", desc: "Multiple top-ups < 5 min apart" },
  repeat_user:    { label: "Repeat Top-Up",  color: "#7C3AED", bg: "#F5F3FF", desc: "Same passenger topped up again within 30 min" },
  large_amount:   { label: "Large Amount",   color: "#DC2626", bg: "#FEF2F2", desc: "Single transaction > $500" },
  velocity_spike: { label: "Velocity Spike", color: "#9D174D", bg: "#FFF1F2", desc: "> 15 top-ups in one hour" },
};

function FlagBadge({ flag }) {
  const cfg = FLAG_CONFIG[flag];
  if (!cfg) return null;
  return (
    <span title={cfg.desc} style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
      background: cfg.bg, color: cfg.color, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(({ id, label, badge }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 18px", borderRadius: 7, border: "none",
          fontSize: 13, fontWeight: active === id ? 700 : 500, cursor: "pointer",
          background: active === id ? "#fff" : "transparent",
          color: active === id ? "#6D28D9" : "#64748B",
          boxShadow: active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
        }}>
          {label}
          {badge > 0 && (
            <span style={{ background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Staff avatar ──────────────────────────────────────────────────────────────
function StaffAvatar({ name, size = 32 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#0EA5E9,#6D28D9)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "#fff",
    }}>{initials}</div>
  );
}

// ── Limits modal ──────────────────────────────────────────────────────────────
function LimitsModal({ staff, onClose, onSave }) {
  const [daily, setDaily] = useState(String(staff.daily_limit));
  const [perTx, setPerTx] = useState(String(staff.tx_limit));

  return (
    <Modal title={`Edit Limits — ${staff.name}`} onClose={onClose} onSave={() => onSave(Number(daily), Number(perTx))}>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18, marginTop: 0 }}>
        Set the maximum amounts this staff member can process.
      </p>
      {[
        { label: "Daily Top-Up Limit ($)", val: daily, set: setDaily },
        { label: "Per-Transaction Limit ($)", val: perTx, set: setPerTx },
      ].map(({ label, val, set }) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>{label}</label>
          <input
            type="number" min="0" value={val} onChange={e => set(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
      ))}
    </Modal>
  );
}

// ── Accounts tab ──────────────────────────────────────────────────────────────
function AccountsTab({ staff, onToggleStatus, onEditLimits }) {
  const { currency, exchangeRate } = useSettings();
  const columns = [
    {
      key: "name", label: "Staff Member",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StaffAvatar name={v} />
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "location", label: "Station",
      render: v => <span style={{ fontSize: 12, color: "#475569" }}>{v}</span>,
    },
    { key: "status", label: "Status", render: v => <StatusPill status={v} /> },
    {
      key: "today_count", label: "Today",
      render: (v, row) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{v} top-ups</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{fmtMoney(row.today_total, currency, exchangeRate)}</div>
        </div>
      ),
    },
    {
      key: "daily_limit", label: "Limits",
      render: (v, row) => (
        <div style={{ fontSize: 11, color: "#475569" }}>
          <div>Daily: <strong>{fmtMoney(v, currency, exchangeRate)}</strong></div>
          <div>Per-TX: <strong>{fmtMoney(row.tx_limit, currency, exchangeRate)}</strong></div>
        </div>
      ),
    },
    {
      key: "flagged", label: "Flags",
      render: v => v === 0
        ? <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>Clean</span>
        : <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
            background: "#FEF2F2", color: "#DC2626",
          }}>{v} flagged</span>,
    },
    {
      key: "id", label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onEditLimits(row); }}
            style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            Limits
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleStatus(row); }}
            style={{
              fontSize: 11, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer",
              color:      row.status === "Active" ? "#B91C1C" : "#059669",
              background: row.status === "Active" ? "#FEF2F2" : "#ECFDF5",
            }}
          >
            {row.status === "Active" ? "Disable" : "Enable"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Staff Accounts">
      <DataTable columns={columns} rows={staff} />
      {staff.length === 0 && (
        <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No staff accounts found.</div>
      )}
    </Panel>
  );
}

// ── Transactions tab ──────────────────────────────────────────────────────────
function TransactionsTab({ transactions, showSuspiciousOnly, onToggle }) {
  const { currency, exchangeRate } = useSettings();
  const [search, setSearch] = useState("");

  const rows = transactions.filter(t => {
    if (showSuspiciousOnly && t.flags.length === 0) return false;
    const q = search.toLowerCase();
    return !q || t.staff.toLowerCase().includes(q) || t.passenger.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
  });

  const columns = [
    {
      key: "time", label: "Time",
      render: v => {
        const d = new Date(v);
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
            <div style={{ fontSize: 10, color: "#94A3B8" }}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          </div>
        );
      },
    },
    {
      key: "staff", label: "Staff",
      render: (v) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StaffAvatar name={v} size={26} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{v}</span>
        </div>
      ),
    },
    { key: "passenger", label: "Passenger", render: v => <span style={{ fontSize: 12 }}>{v}</span> },
    {
      key: "amount", label: "Amount",
      render: v => <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{fmtMoney(v, currency, exchangeRate)}</span>,
    },
    { key: "method",   label: "Method",   render: v => <span style={{ fontSize: 11, color: "#475569" }}>{v}</span> },
    { key: "location", label: "Location", render: v => <span style={{ fontSize: 11, color: "#475569" }}>{v}</span> },
    {
      key: "flags", label: "Status",
      render: v => v.length === 0
        ? <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>Normal</span>
        : <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {v.map(f => <FlagBadge key={f} flag={f} />)}
          </div>,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          placeholder="Search staff, passenger, or TX ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 300 }}
        />
        <button
          onClick={onToggle}
          style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
            background: showSuspiciousOnly ? "#FEF2F2" : "#F8FAFC",
            color:      showSuspiciousOnly ? "#DC2626"  : "#64748B",
          }}
        >
          {showSuspiciousOnly ? "Suspicious Only" : "All Transactions"}
        </button>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>{rows.length} records</span>
      </div>
      <Panel title="Transaction Log" noPad>
        <DataTable columns={columns} rows={rows} />
        {rows.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No transactions match your filter.</div>
        )}
      </Panel>
    </div>
  );
}

// ── Suspicious tab ────────────────────────────────────────────────────────────
function SuspiciousTab({ transactions, staff }) {
  const { currency, exchangeRate } = useSettings();
  const suspicious = transactions.filter(t => t.flags.length > 0);

  // Group by staff
  const byStaff = {};
  suspicious.forEach(t => {
    if (!byStaff[t.staff]) byStaff[t.staff] = [];
    byStaff[t.staff].push(t);
  });

  // Flag type breakdown
  const flagCounts = {};
  suspicious.forEach(t => t.flags.forEach(f => { flagCounts[f] = (flagCounts[f] || 0) + 1; }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Alert banner */}
      <div style={{
        padding: "14px 18px", borderRadius: 12, background: "#FEF2F2",
        border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{ fontSize: 22 }}>⚠️</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C", marginBottom: 2 }}>
            {suspicious.length} suspicious transactions detected
          </div>
          <div style={{ fontSize: 12, color: "#EF4444" }}>
            Across {Object.keys(byStaff).length} staff member{Object.keys(byStaff).length !== 1 ? "s" : ""} —
            review immediately and consider disabling flagged accounts
          </div>
        </div>
      </div>

      {/* Flag type breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {Object.entries(FLAG_CONFIG).map(([key, cfg]) => {
          const count = flagCounts[key] || 0;
          return (
            <div key={key} style={{ background: "#fff", border: `1px solid ${count > 0 ? cfg.color + "33" : "#F1F5F9"}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: count > 0 ? cfg.color : "#94A3B8", lineHeight: 1, marginBottom: 6 }}>{count}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: count > 0 ? cfg.color : "#94A3B8" }}>{cfg.label}</div>
              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{cfg.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Per-staff summary */}
      <Panel title="Flagged Staff Summary">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(byStaff).map(([name, txns]) => {
            const staffRec = staff.find(s => s.name === name);
            const allFlags = [...new Set(txns.flatMap(t => t.flags))];
            const latest   = txns.reduce((a, b) => new Date(a.time) > new Date(b.time) ? a : b);
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
                <StaffAvatar name={name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{staffRec?.location ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center", minWidth: 60 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{txns.length}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>flags</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxWidth: 200 }}>
                  {allFlags.map(f => <FlagBadge key={f} flag={f} />)}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Last flagged</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#0F172A" }}>
                    {new Date(latest.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          {Object.keys(byStaff).length === 0 && (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#10B981", fontSize: 14, fontWeight: 600 }}>
              ✓ No suspicious activity detected
            </div>
          )}
        </div>
      </Panel>

      {/* Flagged transactions detail */}
      {suspicious.length > 0 && (
        <Panel title="Flagged Transaction Detail" noPad>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9", background: "#FAFAFA" }}>
                {["Time", "Staff", "Passenger", "Amount", "Location", "Flags"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suspicious.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #FEF9F9", background: i % 2 === 0 ? "#FFFBFB" : "#fff" }}>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#475569" }}>
                    {new Date(t.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    <div style={{ fontSize: 10, color: "#CBD5E1" }}>{t.id}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StaffAvatar name={t.staff} size={24} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{t.staff}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{t.passenger}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#DC2626" }}>{fmtMoney(t.amount, currency, exchangeRate)}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#64748B" }}>{t.location}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {t.flags.map(f => <FlagBadge key={f} flag={f} />)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

// ── Main StaffPage ────────────────────────────────────────────────────────────

// ── Main StaffPage ────────────────────────────────────────────────────────────
export default function StaffPage() {
  const { currency, exchangeRate } = useSettings();
  const [tab,          setTab]          = useState("accounts");
  const [staff,        setStaff]        = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [limitsTarget, setLimitsTarget] = useState(null);
  const [showSuspOnly, setShowSuspOnly] = useState(false);

  useEffect(() => {
    getStaffAccounts()
      .then(d => setStaff(Array.isArray(d) ? d : []))
      .catch(() => setStaff([]));

    getStaffTransactions()
      .then(d => setTransactions(Array.isArray(d) ? d : []))
      .catch(() => setTransactions([]));
  }, []);

  const suspicious    = transactions.filter(t => t.flags.length > 0);
  const activeCount   = staff.filter(s => s.status === "Active").length;
  const disabledCount = staff.filter(s => s.status === "Disabled").length;
  const todayTotal    = staff.reduce((s, a) => s + a.today_total, 0);

  async function handleToggleStatus(member) {
    const next = member.status === "Active" ? "Disabled" : "Active";
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: next } : s));
    try {
      await updateStaffAccount(member.id, { status: next });
    } catch (err) {
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: member.status } : s));
      alert(err?.message ?? "Failed to update account status");
    }
  }

  async function handleSaveLimits(daily, perTx) {
    const target = limitsTarget;
    setStaff(prev => prev.map(s => s.id === target.id ? { ...s, daily_limit: daily, tx_limit: perTx } : s));
    setLimitsTarget(null);
    try {
      await updateStaffAccount(target.id, { daily_limit: daily, tx_limit: perTx });
    } catch (err) {
      setStaff(prev => prev.map(s => s.id === target.id ? { ...s, daily_limit: target.daily_limit, tx_limit: target.tx_limit } : s));
      alert(err?.message ?? "Failed to save transaction limits");
    }
  }

  const tabs = [
    { id: "accounts",        label: "Accounts",         badge: 0 },
    { id: "transactions",    label: "Transactions",      badge: 0 },
    { id: "suspicious",      label: "Suspicious",        badge: suspicious.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Staff Accounts</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {staff.length} staff members · {suspicious.length} suspicious transactions flagged
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <TabNav tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <StatCard
          label="Total Staff"
          value={staff.length}
          delta="registered accounts"
          accent="#0EA5E9"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <StatCard
          label="Active"
          value={activeCount}
          delta={`${disabledCount} disabled`}
          up={activeCount > disabledCount}
          accent="#10B981"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <StatCard
          label="Suspicious Flags"
          value={suspicious.length}
          delta={suspicious.length > 0 ? "review required" : "all clear"}
          up={suspicious.length === 0}
          accent="#EF4444"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <StatCard
          label="Today's Volume"
          value={fmtMoney(todayTotal, currency, exchangeRate)}
          delta={`${transactions.filter(t => t.time.startsWith("2026-05-05")).length} transactions`}
          accent="#7C3AED"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
        />
      </div>

      {/* Tab content */}
      {tab === "accounts"       && <AccountsTab        staff={staff} onToggleStatus={handleToggleStatus} onEditLimits={setLimitsTarget} />}
      {tab === "transactions"   && <TransactionsTab    transactions={transactions} showSuspiciousOnly={showSuspOnly} onToggle={() => setShowSuspOnly(p => !p)} />}
      {tab === "suspicious"     && <SuspiciousTab      transactions={transactions} staff={staff} />}

      {/* Limits modal */}
      {limitsTarget && (
        <LimitsModal staff={limitsTarget} onClose={() => setLimitsTarget(null)} onSave={handleSaveLimits} />
      )}
    </div>
  );
}


