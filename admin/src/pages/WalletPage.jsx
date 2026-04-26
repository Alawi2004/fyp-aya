// pages/WalletPage.jsx
import { useState, useEffect, useCallback } from "react";
import { Wallet, Plus, Search, Filter, RefreshCw, ChevronDown, ChevronUp, User } from "lucide-react";
import { Modal } from "../components/Modal";
import apiClient from "../api/apiClient";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => `$${parseFloat(n ?? 0).toFixed(2)}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const EMPTY_FORM = { user_id: "", amount: "", location_name: "", tx_ref: "", notes: "" };

// ─── WalletPage ──────────────────────────────────────────────────────────────
export default function WalletPage() {
  const [users,    setUsers]    = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState({});

  // Audit log filters
  const [filterUser,  setFilterUser]  = useState("");
  const [filterLoc,   setFilterLoc]   = useState("");
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Balance lookup for selected user in modal
  const [selectedBalance, setSelectedBalance] = useState(null);

  // ── data loading ────────────────────────────────────────────────────────
  const loadRecharges = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterUser) params.set("user_id", filterUser);
    if (filterLoc)  params.set("location", filterLoc);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to",   filterTo);
    try {
      const res = await apiClient.get(`/wallet/recharges?${params}`);
      setRecharges(res.data ?? []);
    } catch {
      setRecharges([]);
    }
  }, [filterUser, filterLoc, filterFrom, filterTo]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get("/users");
        setUsers((res.data ?? []).filter(u => u.role === "passenger" || u.role === "Passenger"));
      } catch { setUsers([]); }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { loadRecharges(); }, [loadRecharges]);

  // ── when modal user changes, fetch their balance ────────────────────────
  useEffect(() => {
    if (!form.user_id) { setSelectedBalance(null); return; }
    apiClient.get(`/wallet?user_id=${form.user_id}`)
      .then(r => setSelectedBalance(r.data?.balance ?? 0))
      .catch(() => setSelectedBalance(null));
  }, [form.user_id]);

  // ── form helpers ────────────────────────────────────────────────────────
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.user_id)      e.user_id      = "Select a user";
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0)
                            e.amount       = "Enter a positive amount";
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
        user_id:       parseInt(form.user_id),
        amount:        parseFloat(form.amount),
        location_name: form.location_name.trim(),
        tx_ref:        form.tx_ref.trim(),
        notes:         form.notes.trim() || undefined,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setFormErr({});
      await loadRecharges();
    } catch (err) {
      setFormErr({ submit: err.response?.data?.error ?? "Recharge failed. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // ── stats ───────────────────────────────────────────────────────────────
  const totalRecharged = recharges.reduce((s, r) => s + parseFloat(r.amount ?? 0), 0);

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(37,99,235,.28)",
          }}>
            <Wallet size={20} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
              Wallet Management
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", marginTop: 2 }}>
              Process in-person recharges and view the full audit log
            </p>
          </div>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setFormErr({}); setModalOpen(true); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(37,99,235,.28)",
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Recharge Wallet
        </button>
      </div>

      {/* ── Summary stat ── */}
      <div style={{
        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
        borderRadius: 16, padding: "20px 24px", marginBottom: 28,
        display: "flex", alignItems: "center", gap: 20,
        boxShadow: "0 8px 24px rgba(37,99,235,.20)",
      }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500, marginBottom: 4 }}>
            Total Recharged (filtered view)
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
            {fmt(totalRecharged)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", fontWeight: 500, marginBottom: 4 }}>
            Recharge Count
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
            {recharges.length}
          </div>
        </div>
      </div>

      {/* ── Audit Log ── */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0",
        boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden",
      }}>

        {/* table header row */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flex: 1, whiteSpace: "nowrap" }}>
            Recharge Audit Log
          </span>

          {/* filter toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: filtersOpen ? "#EFF6FF" : "#F8FAFC",
              border: `1px solid ${filtersOpen ? "#BFDBFE" : "#E2E8F0"}`,
              borderRadius: 8, padding: "7px 12px", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              color: filtersOpen ? "#2563EB" : "#64748B",
            }}
          >
            <Filter size={14} />
            Filters
            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* refresh */}
          <button
            onClick={loadRecharges}
            style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 8, padding: "7px 10px", cursor: "pointer",
              display: "flex", alignItems: "center",
            }}
            title="Refresh"
          >
            <RefreshCw size={14} color="#64748B" />
          </button>
        </div>

        {/* filter panel */}
        {filtersOpen && (
          <div style={{
            padding: "14px 20px", borderBottom: "1px solid #F1F5F9",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
            gap: 10, alignItems: "end", background: "#FAFBFC",
          }}>
            <div>
              <label style={labelStyle}>User ID</label>
              <input
                value={filterUser} onChange={e => setFilterUser(e.target.value)}
                placeholder="e.g. 42"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input
                value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
                placeholder="e.g. Central Bus"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>From date</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>To date</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
            </div>
            <button
              onClick={() => { setFilterUser(""); setFilterLoc(""); setFilterFrom(""); setFilterTo(""); }}
              style={{
                background: "#F1F5F9", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "#64748B",
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* table */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>Loading…</div>
        ) : recharges.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center" }}>
            <Wallet size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No recharges found</div>
            <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>
              Adjust filters or process the first recharge
            </div>
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
                  <tr
                    key={r.recharge_id}
                    style={{
                      background: i % 2 === 0 ? "#fff" : "#FAFBFC",
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{r.user_name ?? "—"}</div>
                      <div style={{ color: "#94A3B8", fontSize: 11 }}>{r.user_email}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: "#D1FAE5", color: "#065F46",
                        padding: "3px 10px", borderRadius: 99, fontWeight: 700,
                      }}>
                        {fmt(r.amount)}
                      </span>
                    </td>
                    <td style={tdStyle}>{r.location_name}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.tx_ref}</td>
                    <td style={tdStyle}>{r.staff_name ?? "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748B", maxWidth: 180 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.notes || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recharge Modal ── */}
      {modalOpen && (
        <Modal
          title="Recharge Passenger Wallet"
          onClose={() => { setModalOpen(false); setFormErr({}); }}
          onSave={handleRecharge}
        >
          <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* User select */}
            <div>
              <label style={labelStyle}>Passenger *</label>
              <select
                value={form.user_id}
                onChange={e => set("user_id", e.target.value)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                <option value="">— select passenger —</option>
                {users.map(u => (
                  <option key={u.user_id ?? u.id} value={u.user_id ?? u.id}>
                    {u.full_name ?? u.name} ({u.email})
                  </option>
                ))}
              </select>
              {formErr.user_id && <div style={errStyle}>{formErr.user_id}</div>}
              {selectedBalance !== null && (
                <div style={{ fontSize: 12, color: "#2563EB", marginTop: 4, fontWeight: 600 }}>
                  Current balance: {fmt(selectedBalance)}
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label style={labelStyle}>Amount (USD) *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 700, color: "#475569" }}>
                  $
                </span>
                <input
                  type="number" min="0.01" step="0.01"
                  value={form.amount} onChange={e => set("amount", e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: 26 }}
                />
              </div>
              {formErr.amount && <div style={errStyle}>{formErr.amount}</div>}
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>Location Name *</label>
              <input
                value={form.location_name} onChange={e => set("location_name", e.target.value)}
                placeholder="e.g. Central Bus Station — Main Office"
                style={inputStyle}
              />
              {formErr.location_name && <div style={errStyle}>{formErr.location_name}</div>}
            </div>

            {/* Tx ref */}
            <div>
              <label style={labelStyle}>Transaction Reference *</label>
              <input
                value={form.tx_ref} onChange={e => set("tx_ref", e.target.value)}
                placeholder="e.g. RCPT-2024-00142"
                style={inputStyle}
              />
              {formErr.tx_ref && <div style={errStyle}>{formErr.tx_ref}</div>}
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Any additional notes about this recharge…"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>

            {formErr.submit && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, fontWeight: 500 }}>
                {formErr.submit}
              </div>
            )}

            <button
              onClick={handleRecharge}
              disabled={saving}
              style={{
                background: saving ? "#93C5FD" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
                color: "#fff", border: "none", borderRadius: 10, padding: "12px",
                fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 14px rgba(37,99,235,.28)",
                transition: "opacity .15s",
              }}
            >
              {saving ? "Processing…" : "Confirm Recharge"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── micro style tokens ───────────────────────────────────────────────────────
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6,
};
const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8,
  border: "1.5px solid #E2E8F0", outline: "none", color: "#0F172A",
  background: "#FAFBFC", boxSizing: "border-box",
};
const errStyle = { fontSize: 11, color: "#DC2626", marginTop: 4, fontWeight: 500 };
const thStyle = {
  padding: "10px 16px", textAlign: "left", fontSize: 11,
  fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
  letterSpacing: ".5px", whiteSpace: "nowrap",
};
const tdStyle = { padding: "12px 16px", verticalAlign: "middle", whiteSpace: "nowrap" };
