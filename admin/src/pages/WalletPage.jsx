import { useState, useEffect, useCallback, useMemo } from "react";
import { Wallet, Plus, Filter, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ExportBtn } from "../components/ExportBtn";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import apiClient from "../api/apiClient";
import { getWalletStatuses, freezeWallet, unfreezeWallet, getFreezeLog } from "../api/endpoints";
import { useSettings } from "../context/SettingsContext";
import { fmtMoney } from "../utils/fmt";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtShort = d => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";

function frozenDuration(frozenAt) {
  if (!frozenAt) return "";
  const diff = Date.now() - new Date(frozenAt).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return "< 1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const FREEZE_REASONS = [
  "Fraud Investigation",
  "Suspicious Activity",
  "Multiple Failed Payments",
  "Account Verification Required",
  "Legal Hold",
  "Administrative Review",
];

const EMPTY_FORM = { user_id: "", amount: "", location_name: "", tx_ref: "", notes: "" };
const LOW_BALANCE_THRESHOLD = 25;

function deltaMeta(current, previous, currency = "USD") {
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : 0;
  return {
    diff,
    pct,
    up: diff <= 0,
    label: `${diff >= 0 ? "+" : ""}${fmtMoney(diff, currency)} vs last month`,
  };
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
function TabNav({ active, onChange, alertCount }) {
  const tabs = [
    { id: "recharge", label: "Top-Up & Audit Log", badge: 0            },
    { id: "freeze",   label: "Freeze Management",  badge: 0            },
    { id: "alerts",   label: "Balance Alerts",     badge: alertCount   },
    { id: "summary",  label: "Spend Summary",      badge: 0            },
  ];
  return (
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: active === t.id ? 700 : 500,
          background: active === t.id ? "#fff" : "transparent",
          color:      active === t.id ? "#2563EB" : "#64748B",
          boxShadow:  active === t.id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
        }}>
          {t.label}
          {t.badge > 0 && <span style={{ background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Freeze Wallet Modal ───────────────────────────────────────────────────────
function FreezeModal({ wallet, onClose, onConfirm }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const [reason, setReason] = useState("Fraud Investigation");
  const [notes,  setNotes]  = useState("");

  return (
    <Modal title={`Freeze Wallet — ${wallet.name}`} onClose={onClose}
      onSave={() => { onConfirm(wallet.user_id, reason, notes); onClose(); }}>

      {/* Warning banner */}
      <div style={{ padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C", marginBottom: 3 }}>
          ⚠ This will block all deductions from this wallet
        </div>
        <div style={{ fontSize: 11, color: "#EF4444" }}>
          Top-ups will still be visible but no payments or fare deductions will be processed until unfrozen.
        </div>
      </div>

      {/* Wallet info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Passenger</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{wallet.name}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{wallet.email}</div>
        </div>
        <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Current Balance</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>{fmt(wallet.balance)}</div>
          <div style={{ fontSize: 10, color: "#94A3B8" }}>will be preserved, not deducted</div>
        </div>
      </div>

      {/* Reason */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Reason for Freeze *</label>
        <select value={reason} onChange={e => setReason(e.target.value)} style={inp}>
          {FREEZE_REASONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label style={lbl}>Internal Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Supporting details for audit trail..."
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </div>
    </Modal>
  );
}

// ── Unfreeze Wallet Modal ─────────────────────────────────────────────────────
function UnfreezeModal({ wallet, onClose, onConfirm }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const [notes, setNotes] = useState("");

  return (
    <Modal title={`Unfreeze Wallet — ${wallet.name}`} onClose={onClose}
      onSave={() => { onConfirm(wallet.user_id, notes); onClose(); }}>

      {/* Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: "#FEF2F2", borderRadius: 9, padding: "11px 14px", border: "1px solid #FECACA" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Frozen For</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#DC2626" }}>{frozenDuration(wallet.frozen_at)}</div>
          <div style={{ fontSize: 10, color: "#94A3B8" }}>since {fmtDate(wallet.frozen_at)}</div>
        </div>
        <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Freeze Reason</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{wallet.reason}</div>
        </div>
      </div>

      {wallet.notes && (
        <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, marginBottom: 16, fontSize: 12, color: "#92400E" }}>
          <strong>Freeze notes:</strong> {wallet.notes}
        </div>
      )}

      <div style={{ padding: "12px 14px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", marginBottom: 2 }}>
          ✓ Wallet deductions will be re-enabled immediately
        </div>
        <div style={{ fontSize: 11, color: "#6EE7B7" }}>
          The passenger's balance of {fmt(wallet.balance)} will be accessible again.
        </div>
      </div>

      <div>
        <label style={lbl}>Unfreeze Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="e.g. Investigation completed — no fraud found..."
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </div>
    </Modal>
  );
}

// ── Freeze Management Tab ─────────────────────────────────────────────────────
function FreezeManagementTab({ wallets, freezeLog, onFreeze, onUnfreeze }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const [search,      setSearch]      = useState("");
  const [frozenOnly,  setFrozenOnly]  = useState(false);
  const [freezeTarget,  setFreezeTarget]  = useState(null);
  const [unfreezeTarget,setUnfreezeTarget]= useState(null);

  const frozen  = wallets.filter(w => w.status === "Frozen");
  const active  = wallets.filter(w => w.status === "Active");
  const frozenBalance = frozen.reduce((s, w) => s + w.balance, 0);

  const visible = wallets.filter(w => {
    const q = search.toLowerCase();
    const matchSearch = !q || w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q);
    const matchFilter = !frozenOnly || w.status === "Frozen";
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Total Wallets"    value={wallets.length}    delta="passenger accounts" accent="#2563EB" />
        <StatCard label="Active"           value={active.length}     delta="deductions enabled" up accent="#10B981" />
        <StatCard label="Frozen"           value={frozen.length}     delta={frozen.length > 0 ? "deductions blocked" : "none frozen"} up={frozen.length === 0} accent="#DC2626" />
        <StatCard label="Balance Frozen"   value={fmt(frozenBalance)} delta="protected from use" accent="#F59E0B" />
      </div>

      {/* Frozen wallets alert */}
      {frozen.length > 0 && (
        <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>
              {frozen.length} wallet{frozen.length !== 1 ? "s" : ""} currently frozen
            </div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>
              {frozen.map(w => w.name).join(", ")} — deductions blocked pending investigation
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input placeholder="Search passenger..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 260 }} />
        <button onClick={() => setFrozenOnly(o => !o)} style={{
          padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
          background: frozenOnly ? "#FEF2F2" : "#F8FAFC",
          color:      frozenOnly ? "#DC2626"  : "#64748B",
        }}>
          {frozenOnly ? "Frozen Only" : "All Wallets"}
        </button>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>{visible.length} wallets</span>
      </div>

      {/* Wallet table */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
              {["Passenger", "Balance", "Status", "Frozen Since", "Reason", "Actions"].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((w, i) => {
              const frozen = w.status === "Frozen";
              return (
                <tr key={w.user_id} style={{ borderBottom: "1px solid #F8FAFC", background: frozen ? "#FFFAFA" : i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  {/* Passenger */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: frozen ? "#FEF2F2" : "#EFF6FF",
                        color:      frozen ? "#DC2626" : "#2563EB",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, border: frozen ? "2px solid #FECACA" : "none",
                      }}>
                        {w.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{w.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Balance */}
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: frozen ? "#DC2626" : "#059669" }}>
                      {fmt(w.balance)}
                    </span>
                    {frozen && <div style={{ fontSize: 10, color: "#EF4444", marginTop: 2 }}>blocked</div>}
                  </td>
                  {/* Status */}
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: frozen ? "#DC2626" : "#059669", display: "inline-block" }} />
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        background: frozen ? "#FEF2F2" : "#ECFDF5",
                        color:      frozen ? "#DC2626" : "#059669",
                        border: `1px solid ${frozen ? "#FECACA" : "#A7F3D0"}`,
                      }}>
                        {frozen ? "Frozen" : "Active"}
                      </span>
                    </div>
                  </td>
                  {/* Frozen since */}
                  <td style={{ padding: "14px 16px" }}>
                    {frozen ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>{frozenDuration(w.frozen_at)} ago</div>
                        <div style={{ fontSize: 10, color: "#94A3B8" }}>{fmtShort(w.frozen_at)}</div>
                      </div>
                    ) : <span style={{ color: "#94A3B8", fontSize: 12 }}>—</span>}
                  </td>
                  {/* Reason */}
                  <td style={{ padding: "14px 16px", maxWidth: 200 }}>
                    {frozen ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C" }}>{w.reason}</div>
                        {w.notes && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }} title={w.notes}>{w.notes}</div>}
                      </div>
                    ) : <span style={{ color: "#94A3B8", fontSize: 12 }}>—</span>}
                  </td>
                  {/* Actions */}
                  <td style={{ padding: "14px 16px" }}>
                    {frozen ? (
                      <button onClick={() => setUnfreezeTarget(w)} style={{
                        fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
                        border: "none", background: "#ECFDF5", color: "#059669", cursor: "pointer",
                      }}>
                        Unfreeze
                      </button>
                    ) : (
                      <button onClick={() => setFreezeTarget(w)} style={{
                        fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
                        border: "none", background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
                      }}>
                        Freeze
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "40px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No wallets match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Freeze Audit Log */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Freeze Audit Log</span>
        </div>
        <div style={{ padding: "0 18px" }}>
          {freezeLog.map((entry, i) => (
            <div key={entry.id} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "14px 0",
              borderBottom: i < freezeLog.length - 1 ? "1px solid #F8FAFC" : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: entry.action === "frozen" ? "#FEF2F2" : "#ECFDF5",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={entry.action === "frozen" ? "#DC2626" : "#059669"} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d={entry.action === "frozen" ? "M7 11V7a5 5 0 0 1 10 0v4" : "M7 11V7a5 5 0 0 1 9.9-1"}/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{entry.user}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    background: entry.action === "frozen" ? "#FEF2F2" : "#ECFDF5",
                    color:      entry.action === "frozen" ? "#DC2626" : "#059669",
                  }}>
                    {entry.action === "frozen" ? "Frozen" : "Unfrozen"}
                  </span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>by {entry.by}</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 2 }}>
                  <strong>Reason:</strong> {entry.reason}
                </div>
                {entry.notes && <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic" }}>"{entry.notes}"</div>}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0, textAlign: "right" }}>
                <div>{fmtShort(entry.at)}</div>
                <div>{new Date(entry.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {freezeLog.length === 0 && (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No freeze events recorded.</div>
          )}
        </div>
      </div>

      {/* Freeze modal */}
      {freezeTarget && (
        <FreezeModal wallet={freezeTarget} onClose={() => setFreezeTarget(null)}
          onConfirm={(uid, reason, notes) => { onFreeze(uid, reason, notes); setFreezeTarget(null); }}
        />
      )}

      {/* Unfreeze modal */}
      {unfreezeTarget && (
        <UnfreezeModal wallet={unfreezeTarget} onClose={() => setUnfreezeTarget(null)}
          onConfirm={(uid, notes) => { onUnfreeze(uid, notes); setUnfreezeTarget(null); }}
        />
      )}
    </div>
  );
}

function WalletInsights({ wallets, alerts, spendSummary }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const enrichedAlerts = alerts
    .map((alert) => {
      const wallet = wallets.find((w) => w.user_id === alert.user_id);
      return wallet ? { ...alert, wallet } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.balance - b.balance);

  // Normalise: spendSummary may be { current, previous, per_passenger } or a flat array
  const spendRows = Array.isArray(spendSummary)
    ? spendSummary
    : (spendSummary?.per_passenger ?? []);

  const totalCurrentSpend  = spendSummary?.current?.total  ?? spendRows.reduce((s, r) => s + (r.current  ?? r.spent  ?? 0), 0);
  const totalPreviousSpend = spendSummary?.previous?.total ?? spendRows.reduce((s, r) => s + (r.previous ?? r.last_month_spent ?? 0), 0);
  const spendDelta = deltaMeta(totalCurrentSpend, totalPreviousSpend, currency);
  const increasedSpenders = spendRows.filter((r) => (r.current ?? r.spent ?? 0) > (r.previous ?? r.last_month_spent ?? 0)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Low Balance Alerts" value={enrichedAlerts.length} delta={`below $${LOW_BALANCE_THRESHOLD} threshold`} accent="#DC2626" />
        <StatCard label="Push Sent" value={enrichedAlerts.filter((a) => a.push_sent_at).length} delta="passengers notified" accent="#2563EB" />
        <StatCard label="In-App Seen" value={enrichedAlerts.filter((a) => a.in_app_seen).length} delta="warnings opened" accent="#0EA5E9" />
        <StatCard label="Monthly Spend" value={fmt(totalCurrentSpend)} delta={spendDelta.label} up={spendDelta.up} accent="#7C3AED" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Balance Low Alerts</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Push notification and in-app warning status for wallets below threshold</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 999, padding: "4px 10px" }}>
              Threshold: ${LOW_BALANCE_THRESHOLD}
            </span>
          </div>
          <div style={{ padding: "0 20px 10px" }}>
            {enrichedAlerts.map((alert, index) => (
              <div key={alert.user_id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: index < enrichedAlerts.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{alert.wallet.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: alert.severity === "critical" ? "#FEF2F2" : "#FFFBEB", color: alert.severity === "critical" ? "#DC2626" : "#B45309" }}>
                      {alert.severity === "critical" ? "Critical" : "Warning"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{alert.wallet.email}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#EFF6FF", color: "#2563EB" }}>
                      Push {alert.push_sent_at ? `sent ${fmtShort(alert.push_sent_at)}` : "pending"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: alert.in_app_seen ? "#ECFDF5" : "#F8FAFC", color: alert.in_app_seen ? "#059669" : "#64748B" }}>
                      In-app {alert.in_app_seen ? "seen" : "unread"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#F5F3FF", color: "#7C3AED" }}>
                      Suggested top-up {fmt(alert.recommended_top_up)}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: alert.balance < 15 ? "#DC2626" : "#D97706" }}>{fmt(alert.balance)}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{fmt(alert.threshold)} threshold</div>
                </div>
              </div>
            ))}
            {enrichedAlerts.length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No low-balance alerts right now.</div>}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Monthly Spend Summary</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
              {fmt(totalCurrentSpend)} this month vs {fmt(totalPreviousSpend)} last month · {increasedSpenders} passengers spending more
            </div>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>This Month</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A" }}>{fmt(totalCurrentSpend)}</div>
              </div>
              <div style={{ background: spendDelta.diff <= 0 ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${spendDelta.diff <= 0 ? "#A7F3D0" : "#FECACA"}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Vs Last Month</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: spendDelta.diff <= 0 ? "#059669" : "#DC2626" }}>{spendDelta.diff >= 0 ? "+" : ""}{fmt(spendDelta.diff)}</div>
                <div style={{ fontSize: 11, color: spendDelta.diff <= 0 ? "#059669" : "#DC2626", marginTop: 3 }}>{spendDelta.pct >= 0 ? "+" : ""}{spendDelta.pct.toFixed(1)}%</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {spendRows.map((row) => {
                const spent     = row.current        ?? row.spent           ?? 0;
                const lastSpent = row.previous       ?? row.last_month_spent ?? 0;
                const trips     = row.trips_current  ?? row.trips           ?? 0;
                const lastTrips = row.trips_previous ?? row.last_month_trips ?? 0;
                const delta = spent - lastSpent;
                const up = delta <= 0;
                return (
                  <div key={row.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 10, borderBottom: "1px solid #F8FAFC" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{row.name}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{trips} trips this month · {lastTrips} last month</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{fmt(spent)}</div>
                      <div style={{ fontSize: 11, color: up ? "#059669" : "#DC2626" }}>{delta >= 0 ? "+" : ""}{fmt(delta)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Balance Alerts Tab ────────────────────────────────────────────────────────
function AlertsTab({ alerts, threshold, onNotify }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const critical = alerts.filter(a => a.balance < threshold * 0.4);
  const warning  = alerts.filter(a => a.balance >= threshold * 0.4 && a.balance < threshold);

  function AlertRow({ a }) {
    const pct  = Math.round((a.balance / threshold) * 100);
    const isCrit = a.balance < threshold * 0.4;
    const color  = isCrit ? "#DC2626" : "#D97706";
    const bg     = isCrit ? "#FEF2F2" : "#FFFBEB";
    const border = isCrit ? "#FECACA" : "#FDE68A";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: "#fff", border: `2px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color }}>
          {a.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{a.name}</div>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>{a.email} · Last top-up {a.days_since_topup}d ago</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .4s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color }}>{fmt(a.balance)}</span>
            <span style={{ fontSize: 10, color: "#94A3B8" }}>/ {fmt(threshold)} threshold</span>
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
          {a.notified && <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>✓ Notified</span>}
          <button onClick={() => onNotify(a.user_id)} style={{ fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer" }}>
            {a.notified ? "Re-notify" : "Send Alert"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Below Threshold" value={alerts.length}     delta={`< ${fmt(threshold)} balance`}    up={alerts.length === 0} accent="#EF4444" />
        <StatCard label="Critical"        value={critical.length}   delta={`< ${fmt(threshold * 0.4)} balance`} up={critical.length === 0} accent="#DC2626" />
        <StatCard label="Warning"         value={warning.length}    delta={`${fmt(threshold * 0.4)}–${fmt(threshold)}`} up={warning.length === 0} accent="#D97706" />
        <StatCard label="Notified"        value={alerts.filter(a => a.notified).length} delta="alerts sent" accent="#10B981" />
      </div>

      {/* Alert banner */}
      {critical.length > 0 && (
        <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>{critical.length} passenger{critical.length !== 1 ? "s" : ""} with critically low balance</div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>These passengers may not have enough balance to complete their next trip. Send alerts now.</div>
          </div>
          <button onClick={() => alerts.forEach(a => !a.notified && onNotify(a.user_id))} style={{ padding: "8px 18px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            Notify All
          </button>
        </div>
      )}

      {/* Threshold info */}
      <div style={{ padding: "12px 16px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, fontSize: 12, color: "#1E40AF" }}>
        <strong>Alert threshold: {fmt(threshold)}</strong> — passengers below this balance receive an in-app warning and push notification.
      </div>

      {/* Critical */}
      {critical.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Critical (balance below {fmt(threshold * 0.4)})
          </div>
          {critical.map(a => <AlertRow key={a.user_id} a={a} />)}
        </div>
      )}

      {/* Warning */}
      {warning.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Warning (balance {fmt(threshold * 0.4)}–{fmt(threshold)})
          </div>
          {warning.map(a => <AlertRow key={a.user_id} a={a} />)}
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", background: "#ECFDF5", borderRadius: 12, border: "1px solid #A7F3D0" }}>
          <div style={{ fontSize: 28, marginBottom: 8, color: "#059669", fontWeight: 700 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>All wallet balances are healthy</div>
          <div style={{ fontSize: 12, color: "#6EE7B7", marginTop: 4 }}>No passengers are below the ${threshold} threshold.</div>
        </div>
      )}
    </div>
  );
}

// ── Spend Summary Tab ─────────────────────────────────────────────────────────
function SummaryTab({ summary }) {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  // Guard: summary may be empty array before data loads
  if (!summary || Array.isArray(summary) || !summary.current || !summary.previous) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0", color: "#94A3B8" }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No spend summary data available</div>
        <div style={{ fontSize: 12 }}>Spend data is generated from wallet recharge records. Data will appear once passengers have made recharge transactions.</div>
      </div>
    );
  }

  const { current, previous, per_passenger } = summary;
  const totalDelta = deltaMeta(current.total, previous.total, currency);
  const tripDelta  = deltaMeta(current.transactions, previous.transactions, currency);
  const avgDelta   = deltaMeta(current.avg_per_trip, previous.avg_per_trip, currency);

  const maxVal = Math.max(...(per_passenger ?? []).map(p => Math.max(p.current ?? 0, p.previous ?? 0)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Overall comparison cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {[
          { label: "Total Spent",       curr: fmt(current.total),        prev: fmt(previous.total),        meta: totalDelta, accent: "#2563EB" },
          { label: "Trips",             curr: current.transactions,       prev: previous.transactions,      meta: tripDelta,  accent: "#7C3AED" },
          { label: "Avg Fare / Trip",   curr: fmt(current.avg_per_trip),  prev: fmt(previous.avg_per_trip), meta: avgDelta,   accent: "#10B981" },
        ].map(({ label, curr, prev, meta, accent }) => (
          <div key={label} style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: accent, letterSpacing: "-.5px" }}>{curr}</div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>vs {prev}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: meta.up ? "#059669" : "#DC2626" }}>
              {meta.up ? "▼" : "▲"} {meta.label}
            </div>
            {/* Mini bar comparison */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {[{ l: current.label, w: 100 }, { l: previous.label, w: previous.total > 0 ? Math.round((previous.total / current.total) * 100) : 80 }].map(({ l, w }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: "#94A3B8", width: 52, textAlign: "right", flexShrink: 0 }}>{l}</span>
                  <div style={{ flex: 1, height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, w)}%`, height: "100%", background: accent, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "#2563EB" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{current.label} (current)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: "#BFDBFE" }} />
          <span style={{ fontSize: 12, color: "#64748B" }}>{previous.label} (previous)</span>
        </div>
      </div>

      {/* Per-passenger breakdown */}
      <div style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          Per-Passenger Breakdown — {current.label} vs {previous.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {(per_passenger ?? []).map((p, i) => {
            const diff  = p.current - p.previous;
            const isUp  = diff > 0;
            return (
              <div key={p.user_id} style={{ padding: "14px 18px", borderBottom: i < per_passenger.length - 1 ? "1px solid #F8FAFC" : "none", display: "flex", alignItems: "center", gap: 16 }}>
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                  {p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>{p.name}</div>
                  {/* Grouped bars */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {[{ label: current.label,  val: p.current,  color: "#2563EB" },
                      { label: previous.label, val: p.previous, color: "#BFDBFE" }].map(({ label, val, color }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, color: "#94A3B8", width: 52, textAlign: "right", flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s ease" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", width: 50, textAlign: "right", flexShrink: 0 }}>{fmt(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Delta */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isUp ? "#059669" : "#DC2626" }}>
                    {isUp ? "▲" : "▼"} {fmt(Math.abs(diff))}
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{p.trips_current} trips</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ── Main WalletPage ───────────────────────────────────────────────────────────
export default function WalletPage() {
  const { currency } = useSettings();
  const fmt = n => fmtMoney(n, currency);
  const [tab,       setTab]       = useState("recharge");
  const [users,     setUsers]     = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formErr,   setFormErr]   = useState({});

  // Freeze management state
  const [walletStatuses, setWalletStatuses] = useState([]);
  const [freezeLog,      setFreezeLog]      = useState([]);
  const [lowBalanceAlerts, setLowBalanceAlerts] = useState([]);
  // Spend summary — computed from recharges, no separate API call needed
  const [allRecharges,     setAllRecharges]     = useState([]);

  // Audit log filters
  const [filterUser,  setFilterUser]  = useState("");
  const [filterLoc,   setFilterLoc]   = useState("");
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);

  const loadRecharges = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterUser) params.set("user_id", filterUser);
    if (filterLoc)  params.set("location", filterLoc);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to", filterTo);
    try {
      const res = await apiClient.get(`/wallet/recharges?${params}`);
      setRecharges(Array.isArray(res) ? res : (res?.data ?? []));
    } catch { setRecharges([]); }
  }, [filterUser, filterLoc, filterFrom, filterTo]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get("/users");
        const userList = Array.isArray(res) ? res : (res?.data ?? []);
        setUsers(userList.filter(u => u.role === "passenger" || u.role === "Passenger"));
      } catch { setUsers([]); }
      setLoading(false);
    };
    init();

    // Load freeze data
    getWalletStatuses()
      .then(d => setWalletStatuses(Array.isArray(d) ? d : []))
      .catch(() => setWalletStatuses([]));

    getFreezeLog()
      .then(d => setFreezeLog(Array.isArray(d) ? d : []))
      .catch(() => setFreezeLog([]));
  }, []);

  useEffect(() => { loadRecharges(); }, [loadRecharges]);

  useEffect(() => {
    if (!form.user_id) { setSelectedBalance(null); return; }
    apiClient.get(`/wallet?user_id=${form.user_id}`)
      .then(r => setSelectedBalance(r?.balance ?? r?.data?.balance ?? 0))
      .catch(() => setSelectedBalance(null));
  }, [form.user_id]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.user_id) e.user_id = "Select a user";
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = "Enter a positive amount";
    if (!form.location_name.trim()) e.location_name = "Location is required";
    if (!form.tx_ref.trim())        e.tx_ref        = "Transaction reference is required";
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  const handleRecharge = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiClient.post("/wallet/topup", {
        user_id: parseInt(form.user_id),
        amount: parseFloat(form.amount),
        location_name: form.location_name.trim(),
        tx_ref: form.tx_ref.trim(),
        notes: form.notes.trim() || undefined,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setFormErr({});
      await loadRecharges();
    } catch (err) {
      setFormErr({ submit: err.response?.data?.error ?? "Recharge failed. Please try again." });
    } finally { setSaving(false); }
  };

  function reloadFreezeData() {
    getWalletStatuses()
      .then(d => setWalletStatuses(Array.isArray(d) ? d : []))
      .catch(() => {});
    getFreezeLog()
      .then(d => setFreezeLog(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  async function handleFreeze(userId, reason, notes) {
    try {
      await freezeWallet(userId, { reason, notes });
      reloadFreezeData();
    } catch (err) {
      alert(err?.message ?? "Failed to freeze wallet");
    }
  }

  async function handleUnfreeze(userId, notes) {
    try {
      await unfreezeWallet(userId, { notes });
      reloadFreezeData();
    } catch (err) {
      alert(err?.message ?? "Failed to unfreeze wallet");
    }
  }

  // Load all recharges (unfiltered) when summary tab opens
  useEffect(() => {
    if (tab !== "summary") return;
    apiClient.get("/wallet/recharges")
      .then(d => setAllRecharges(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setAllRecharges([]));
  }, [tab]);

  // Compute spend summary: current month vs previous month from recharge records
  const spendSummary = useMemo(() => {
    const data = allRecharges.length > 0 ? allRecharges : recharges;
    if (!data.length) return null;

    const now = new Date();
    const cy = now.getFullYear(), cm = now.getMonth();
    const py = cm === 0 ? cy - 1 : cy, pm = cm === 0 ? 11 : cm - 1;

    const label = (y, m) => new Date(y, m, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

    const isCurr = r => { const d = new Date(r.created_at); return d.getMonth() === cm && d.getFullYear() === cy; };
    const isPrev = r => { const d = new Date(r.created_at); return d.getMonth() === pm && d.getFullYear() === py; };

    const curr = data.filter(isCurr);
    const prev = data.filter(isPrev);

    const total = arr => arr.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    const ct = total(curr), pt = total(prev);
    const cc = curr.length,  pc = prev.length;

    // Per-passenger
    const map = {};
    data.forEach(r => {
      const name = r.user_name ?? "Unknown";
      if (!map[name]) map[name] = { name, current: 0, previous: 0, trips_current: 0 };
      if (isCurr(r)) { map[name].current += parseFloat(r.amount || 0); map[name].trips_current++; }
      if (isPrev(r))   map[name].previous += parseFloat(r.amount || 0);
    });

    const per_passenger = Object.values(map)
      .filter(p => p.current > 0 || p.previous > 0)
      .sort((a, b) => b.current - a.current);

    return {
      current:  { label: label(cy, cm), total: ct, transactions: cc, avg_per_trip: cc > 0 ? ct / cc : 0 },
      previous: { label: label(py, pm), total: pt, transactions: pc, avg_per_trip: pc > 0 ? pt / pc : 0 },
      per_passenger,
    };
  }, [allRecharges, recharges]);

  const totalRecharged  = recharges.reduce((s, r) => s + parseFloat(r.amount ?? 0), 0);
  const frozenCount     = walletStatuses.filter(w => w.status === "Frozen").length;
  const unnotifiedAlerts = lowBalanceAlerts.filter(a => !a.notified).length;

  function handleNotify(userId) {
    setLowBalanceAlerts(prev => prev.map(a => a.user_id === userId ? { ...a, notified: true } : a));
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2563EB,#1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,.28)" }}>
            <Wallet size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>Wallet Management</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", marginTop: 2 }}>
              Process recharges, freeze wallets for investigation, and view audit logs
              {frozenCount > 0 && <span style={{ marginLeft: 8, color: "#DC2626", fontWeight: 600 }}>· {frozenCount} wallet{frozenCount !== 1 ? "s" : ""} frozen</span>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ExportBtn
            rows={recharges}
            columns={[
              { key: "user_name",     label: "Passenger",  value: r => r.user_name ?? "—"                                     },
              { key: "amount",        label: "Amount",     value: r => fmtMoney(r.amount || 0, currency)                   },
              { key: "location_name", label: "Location",   value: r => r.location_name ?? "—"                                 },
              { key: "tx_ref",        label: "Tx Ref",     value: r => r.tx_ref ?? "—"                                        },
              { key: "created_at",    label: "Date",       value: r => r.created_at ? new Date(r.created_at).toLocaleString() : "—" },
            ]}
            filename={`wallet-recharges-${new Date().toISOString().slice(0,10)}.csv`}
            title="Wallet Recharges Report"
          />
          {tab === "recharge" && (
            <button onClick={() => { setForm(EMPTY_FORM); setFormErr({}); setModalOpen(true); }} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff",
              border: "none", borderRadius: 10, padding: "10px 18px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(37,99,235,.28)",
            }}>
              <Plus size={16} strokeWidth={2.5} />
              Recharge Wallet
            </button>
          )}
          <TabNav active={tab} onChange={setTab} alertCount={unnotifiedAlerts} />
        </div>
      </div>

      {/* ── RECHARGE TAB ── */}
      {tab === "recharge" && (
        <>
          <WalletInsights wallets={walletStatuses} alerts={lowBalanceAlerts} spendSummary={spendSummary} />

          {/* Summary banner */}
          <div style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", borderRadius: 16, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20, boxShadow: "0 8px 24px rgba(37,99,235,.20)" }}>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500, marginBottom: 4 }}>Total Recharged (filtered)</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>{fmt(totalRecharged)}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500, marginBottom: 4 }}>Recharge Count</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>{recharges.length}</div>
            </div>
          </div>

          {/* Audit log */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flex: 1 }}>Recharge Audit Log</span>
              <button onClick={() => setFiltersOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, background: filtersOpen ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${filtersOpen ? "#BFDBFE" : "#E2E8F0"}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: filtersOpen ? "#2563EB" : "#64748B" }}>
                <Filter size={14} /> Filters {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button onClick={loadRecharges} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Refresh">
                <RefreshCw size={14} color="#64748B" />
              </button>
            </div>

            {filtersOpen && (
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", background: "#FAFBFC" }}>
                {[{ label: "User ID", val: filterUser, set: setFilterUser, ph: "e.g. 42" }, { label: "Location", val: filterLoc, set: setFilterLoc, ph: "e.g. Central Bus" }].map(f => (
                  <div key={f.label}>
                    <label style={labelStyle}>{f.label}</label>
                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
                  </div>
                ))}
                <div><label style={labelStyle}>From date</label><input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>To date</label><input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} /></div>
                <button onClick={() => { setFilterUser(""); setFilterLoc(""); setFilterFrom(""); setFilterTo(""); }} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#64748B" }}>Clear</button>
              </div>
            )}

            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Loading…</div>
            ) : recharges.length === 0 ? (
              <div style={{ padding: 56, textAlign: "center" }}>
                <Wallet size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No recharges found</div>
                <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>Adjust filters or process the first recharge</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Date", "User", "Amount", "Location", "Ref", "Processed By", "Notes"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recharges.map((r, i) => (
                      <tr key={r.recharge_id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                        <td style={tdStyle}><div style={{ fontWeight: 600, color: "#0F172A" }}>{r.user_name ?? "—"}</div><div style={{ color: "#94A3B8", fontSize: 11 }}>{r.user_email}</div></td>
                        <td style={tdStyle}><span style={{ background: "#D1FAE5", color: "#065F46", padding: "3px 10px", borderRadius: 99, fontWeight: 700 }}>{fmt(r.amount)}</span></td>
                        <td style={tdStyle}>{r.location_name}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.tx_ref}</td>
                        <td style={tdStyle}>{r.staff_name ?? "—"}</td>
                        <td style={{ ...tdStyle, color: "#64748B", maxWidth: 180 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── FREEZE TAB ── */}
      {tab === "freeze" && (
        <FreezeManagementTab
          wallets={walletStatuses}
          freezeLog={freezeLog}
          onFreeze={handleFreeze}
          onUnfreeze={handleUnfreeze}
        />
      )}

      {/* ── BALANCE ALERTS TAB ── */}
      {tab === "alerts" && (
        <AlertsTab
          alerts={lowBalanceAlerts}
          threshold={LOW_BALANCE_THRESHOLD}
          onNotify={handleNotify}
        />
      )}

      {/* ── SPEND SUMMARY TAB ── */}
      {tab === "summary" && (
        <SummaryTab summary={spendSummary} />
      )}

      {/* Recharge Modal */}
      {modalOpen && (
        <Modal title="Recharge Passenger Wallet" onClose={() => { setModalOpen(false); setFormErr({}); }} onSave={handleRecharge}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Passenger *</label>
              <select value={form.user_id} onChange={e => set("user_id", e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
                <option value="">— select passenger —</option>
                {users.map(u => <option key={u.user_id ?? u.id} value={u.user_id ?? u.id}>{u.full_name ?? u.name} ({u.email})</option>)}
              </select>
              {formErr.user_id && <div style={errStyle}>{formErr.user_id}</div>}
              {selectedBalance !== null && <div style={{ fontSize: 12, color: "#2563EB", marginTop: 4, fontWeight: 600 }}>Current balance: {fmt(selectedBalance)}</div>}
            </div>
            <div>
              <label style={labelStyle}>Amount (USD) *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 700, color: "#475569" }}>$</span>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 26 }} />
              </div>
              {formErr.amount && <div style={errStyle}>{formErr.amount}</div>}
            </div>
            <div>
              <label style={labelStyle}>Location Name *</label>
              <input value={form.location_name} onChange={e => set("location_name", e.target.value)} placeholder="e.g. Central Bus Station — Main Office" style={inputStyle} />
              {formErr.location_name && <div style={errStyle}>{formErr.location_name}</div>}
            </div>
            <div>
              <label style={labelStyle}>Transaction Reference *</label>
              <input value={form.tx_ref} onChange={e => set("tx_ref", e.target.value)} placeholder="e.g. RCPT-2024-00142" style={inputStyle} />
              {formErr.tx_ref && <div style={errStyle}>{formErr.tx_ref}</div>}
            </div>
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes…" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </div>
            {formErr.submit && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>{formErr.submit}</div>}
            <button onClick={handleRecharge} disabled={saving} style={{ background: saving ? "#93C5FD" : "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 14px rgba(37,99,235,.28)" }}>
              {saving ? "Processing…" : "Confirm Recharge"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Style tokens ──────────────────────────────────────────────────────────────
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
const inputStyle  = { width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1.5px solid #E2E8F0", outline: "none", color: "#0F172A", background: "#FAFBFC", boxSizing: "border-box" };
const errStyle    = { fontSize: 11, color: "#DC2626", marginTop: 4, fontWeight: 500 };
const thStyle     = { padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" };
const tdStyle     = { padding: "12px 16px", verticalAlign: "middle", whiteSpace: "nowrap" };
