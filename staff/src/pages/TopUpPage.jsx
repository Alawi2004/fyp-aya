import { useState, useRef, useCallback } from "react";
import {
  Search, User, Wallet, CheckCircle, XCircle, AlertTriangle,
  ChevronRight, ArrowLeft, Loader, BadgeCheck,
} from "lucide-react";
import apiClient from "../api/apiClient";
import { C, cardStyle, inputStyle, labelStyle, btnPrimary } from "../styles/themes";

// ─── constants ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = ["Cash", "Card (Debit/Credit)", "Mobile Transfer", "Bank Transfer", "Voucher", "Other"];

const STEPS = { SEARCH: "search", CONFIRM_USER: "confirm_user", FORM: "form", CONFIRM: "confirm", SUCCESS: "success" };

const EMPTY_FORM = {
  amount: "",
  payment_method: "Cash",
  recharge_location: "",
  transaction_reference: "",
  notes: "",
};

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => `$${parseFloat(n ?? 0).toFixed(2)}`;
const statusColor = (s = "Active") => {
  const lower = s.toLowerCase();
  if (lower === "active")   return { color: C.success, bg: C.successBg };
  if (lower === "inactive" || lower === "blocked" || lower === "suspended")
                            return { color: C.danger,  bg: C.dangerBg  };
  return { color: C.warning, bg: C.warningBg };
};

// ─── TopUpPage ────────────────────────────────────────────────────────────────
export default function TopUpPage() {
  const [step,        setStep]        = useState(STEPS.SEARCH);
  const [query,       setQuery]       = useState("");
  const [searching,   setSearching]   = useState(false);
  const [results,     setResults]     = useState([]);
  const [searchErr,   setSearchErr]   = useState(null);
  const [selectedUser,setSelectedUser]= useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [formErr,     setFormErr]     = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [receipt,     setReceipt]     = useState(null);  // success response
  const [submitErr,   setSubmitErr]   = useState(null);

  const searchTimer = useRef(null);

  // ── search ──────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults([]); setSearchErr(null); return; }
    setSearching(true);
    setSearchErr(null);
    try {
      const data = await apiClient.get(`/staff/wallet/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data ?? []);
      if ((data ?? []).length === 0) setSearchErr("No passengers found. Try a different search term.");
    } catch (err) {
      setSearchErr(err.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  // ── select user ─────────────────────────────────────────────────────────
  const selectUser = (u) => {
    const st = (u.status ?? "Active").toLowerCase();
    if (st === "inactive" || st === "blocked" || st === "suspended") {
      if (!window.confirm(`This account is ${u.status}. Are you sure you want to view it?`)) return;
    }
    setSelectedUser(u);
    setStep(STEPS.CONFIRM_USER);
  };

  // ── form helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0)    e.amount = "Enter a positive amount";
    if (amt > 10000)                                e.amount = "Single top-up cannot exceed $10,000";
    if (!form.recharge_location.trim())             e.recharge_location = "Location is required";
    if (!form.transaction_reference.trim())         e.transaction_reference = "Transaction reference / receipt number is required";
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  // ── submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const data = await apiClient.post("/staff/wallet/topup", {
        user_id:               selectedUser.user_id,
        amount:                parseFloat(form.amount),
        payment_method:        form.payment_method,
        recharge_location:     form.recharge_location.trim(),
        transaction_reference: form.transaction_reference.trim(),
        notes:                 form.notes.trim() || undefined,
      });
      setReceipt(data);
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── reset ────────────────────────────────────────────────────────────────
  const resetAll = () => {
    setStep(STEPS.SEARCH);
    setQuery("");
    setResults([]);
    setSearchErr(null);
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setFormErr({});
    setReceipt(null);
    setSubmitErr(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: "28px 32px", maxWidth: 800, margin: "0 auto",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>
          Wallet Top-Up
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
          Search for a passenger, verify their identity, then process the recharge.
        </p>
      </div>

      {/* ── Step indicator ── */}
      <StepIndicator current={step} />

      {/* ═══════════════ STEP 1 — SEARCH ═══════════════ */}
      {step === STEPS.SEARCH && (
        <div style={cardStyle}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Find Passenger</span>
          </div>
          <div style={{ padding: 24 }}>
            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <Search size={16} color={C.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Search by name, email, phone, or user ID…"
                autoFocus
                style={{ ...inputStyle, paddingLeft: 44, paddingRight: 44, fontSize: 14 }}
              />
              {searching && (
                <Loader size={14} color={C.primary} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", animation: "spin 1s linear infinite" }} />
              )}
            </div>

            {/* Error */}
            {searchErr && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 13, padding: "10px 0" }}>
                <AlertTriangle size={15} />
                {searchErr}
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map(u => {
                  const sc = statusColor(u.status);
                  return (
                    <div
                      key={u.user_id}
                      onClick={() => selectUser(u)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        padding: "14px 16px",
                        border: "1.5px solid #E2E8F0",
                        borderRadius: 12, cursor: "pointer",
                        transition: "border-color .15s, background .15s",
                        background: "#FAFBFC",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.primaryLight; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#FAFBFC"; }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <User size={18} color={C.primary} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{u.full_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: 99 }}>
                            {u.status ?? "Active"}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{u.email} {u.phone ? `· ${u.phone}` : ""}</span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{fmt(u.balance)}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>balance</div>
                      </div>
                      <ChevronRight size={16} color={C.textMuted} />
                    </div>
                  );
                })}
              </div>
            )}

            {!query && (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted }}>
                <Search size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 14 }}>Start typing to search for a passenger</p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>Search by name, email, phone number, or user ID</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 2 — CONFIRM USER ═══════════════ */}
      {step === STEPS.CONFIRM_USER && selectedUser && (
        <div>
          <button onClick={() => setStep(STEPS.SEARCH)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textSecond, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
            <ArrowLeft size={14} /> Back to search
          </button>

          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
              <BadgeCheck size={16} color={C.primary} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Verify Passenger Identity</span>
            </div>
            <div style={{ padding: 24 }}>
              <UserInfoCard user={selectedUser} />

              {/* Blocked account warning */}
              {["inactive","blocked","suspended"].includes((selectedUser.status ?? "").toLowerCase()) && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  background: C.dangerBg, border: `1px solid #FCA5A5`,
                  borderRadius: 10, padding: "12px 16px", marginTop: 16,
                }}>
                  <XCircle size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>Account is {selectedUser.status}</div>
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>
                      You cannot top up an inactive or blocked account. Please contact an admin.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!["inactive","blocked","suspended"].includes((selectedUser.status ?? "").toLowerCase()) && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStep(STEPS.FORM)}
                style={{ ...btnPrimary, gap: 8 }}
              >
                Confirm — Proceed to Recharge
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STEP 3 — RECHARGE FORM ═══════════════ */}
      {step === STEPS.FORM && selectedUser && (
        <div>
          <button onClick={() => setStep(STEPS.CONFIRM_USER)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textSecond, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
            <ArrowLeft size={14} /> Back
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>

            {/* Form panel */}
            <div style={cardStyle}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Recharge Details</span>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Amount */}
                <div>
                  <label style={labelStyle}>Amount (USD) *</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 800, color: "#475569" }}>$</span>
                    <input
                      type="number" min="0.01" step="0.01" max="10000"
                      value={form.amount}
                      onChange={e => set("amount", e.target.value)}
                      placeholder="0.00"
                      style={{ ...inputStyle, paddingLeft: 28, fontSize: 20, fontWeight: 800 }}
                    />
                  </div>
                  {formErr.amount && <ErrMsg msg={formErr.amount} />}
                  {/* Quick amount buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {[5,10,20,50,100,200].map(a => (
                      <button key={a} onClick={() => set("amount", String(a))}
                        style={{
                          padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${form.amount === String(a) ? C.primary : C.border}`,
                          background: form.amount === String(a) ? C.primaryLight : "#fff",
                          color: form.amount === String(a) ? C.primary : C.textSecond,
                        }}>
                        ${a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <label style={labelStyle}>Payment Method *</label>
                  <select
                    value={form.payment_method}
                    onChange={e => set("payment_method", e.target.value)}
                    style={{ ...inputStyle, appearance: "none" }}
                  >
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label style={labelStyle}>Recharge Location *</label>
                  <input
                    value={form.recharge_location}
                    onChange={e => set("recharge_location", e.target.value)}
                    placeholder="e.g. Central Bus Station — Main Office"
                    style={inputStyle}
                  />
                  {formErr.recharge_location && <ErrMsg msg={formErr.recharge_location} />}
                </div>

                {/* Transaction reference */}
                <div>
                  <label style={labelStyle}>Transaction Reference / Receipt No. *</label>
                  <input
                    value={form.transaction_reference}
                    onChange={e => set("transaction_reference", e.target.value)}
                    placeholder="e.g. RCPT-2024-00142"
                    style={inputStyle}
                  />
                  {formErr.transaction_reference && <ErrMsg msg={formErr.transaction_reference} />}
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={e => set("notes", e.target.value)}
                    placeholder="Any additional notes…"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>

                <button
                  onClick={() => { if (validate()) setStep(STEPS.CONFIRM); }}
                  style={{ ...btnPrimary, width: "100%", padding: "13px", fontSize: 15, gap: 8 }}
                >
                  Review & Confirm
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* User summary sidebar */}
            <div style={{ ...cardStyle, position: "sticky", top: 20 }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Selected Passenger</span>
              </div>
              <div style={{ padding: 18 }}>
                <UserInfoCard user={selectedUser} compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 4 — CONFIRMATION POPUP ═══════════════ */}
      {step === STEPS.CONFIRM && (
        <ConfirmDialog
          user={selectedUser}
          form={form}
          submitting={submitting}
          submitErr={submitErr}
          onBack={() => { setStep(STEPS.FORM); setSubmitErr(null); }}
          onConfirm={handleSubmit}
        />
      )}

      {/* ═══════════════ STEP 5 — SUCCESS ═══════════════ */}
      {step === STEPS.SUCCESS && receipt && (
        <SuccessCard receipt={receipt} onNewTopUp={resetAll} />
      )}

      {/* Global CSS for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = [
    { id: STEPS.SEARCH,       label: "Search" },
    { id: STEPS.CONFIRM_USER, label: "Verify" },
    { id: STEPS.FORM,         label: "Details" },
    { id: STEPS.CONFIRM,      label: "Confirm" },
    { id: STEPS.SUCCESS,      label: "Done"    },
  ];
  const idx = steps.findIndex(s => s.id === current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done    = i < idx;
        const active  = i === idx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? C.primary : active ? C.primaryLight : "#F1F5F9",
                border: `2px solid ${done || active ? C.primary : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: done ? "#fff" : active ? C.primary : C.textMuted,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? C.primary : C.textMuted, whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? C.primary : C.border, margin: "0 4px", marginBottom: 18, minWidth: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserInfoCard({ user, compact }) {
  const sc = statusColor(user.status);
  return (
    <div style={{ display: "flex", alignItems: compact ? "center" : "flex-start", gap: 14 }}>
      <div style={{
        width: compact ? 40 : 52, height: compact ? 40 : 52,
        borderRadius: compact ? 12 : 14,
        background: C.primaryLight, border: `1px solid ${C.primaryBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <User size={compact ? 18 : 24} color={C.primary} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 800, color: "#0F172A" }}>{user.full_name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: 99 }}>
            {user.status ?? "Active"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{user.email}</div>
        {!compact && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <InfoChip label="User ID"  value={`#${user.user_id}`} />
            <InfoChip label="Phone"    value={user.phone ?? "—"} />
            <InfoChip label="Balance"  value={`$${parseFloat(user.balance).toFixed(2)}`} accent />
            <InfoChip label="Joined"   value={user.joined ?? "—"} />
          </div>
        )}
        {compact && (
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>ID #{user.user_id}</span>
            <span style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>{`$${parseFloat(user.balance).toFixed(2)}`}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoChip({ label, value, accent }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "10px 12px", border: `1px solid ${accent ? C.primaryBorder : C.border}` }}>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: accent ? C.primary : "#0F172A" }}>{value}</div>
    </div>
  );
}

function ErrMsg({ msg }) {
  return <div style={{ fontSize: 11, color: C.danger, marginTop: 4, fontWeight: 500 }}>{msg}</div>;
}

function ConfirmDialog({ user, form, submitting, submitErr, onBack, onConfirm }) {
  const newBalance = parseFloat(user.balance) + parseFloat(form.amount || 0);
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textSecond, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={14} /> Back to form
      </button>

      <div style={{ ...cardStyle, maxWidth: 520, margin: "0 auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={C.warning} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Confirm Top-Up</span>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted }}>
            Please review the details carefully before confirming. This action cannot be undone.
          </p>

          {/* Summary rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            {[
              ["Passenger",    user.full_name],
              ["User ID",      `#${user.user_id}`],
              ["Email",        user.email],
              ["Current Balance", `$${parseFloat(user.balance).toFixed(2)}`],
              ["Amount",       `$${parseFloat(form.amount).toFixed(2)}`],
              ["New Balance",  `$${newBalance.toFixed(2)}`],
              ["Payment",      form.payment_method],
              ["Location",     form.recharge_location],
              ["Reference",    form.transaction_reference],
              ...(form.notes ? [["Notes", form.notes]] : []),
            ].map(([k, v], i) => (
              <div key={k} style={{
                display: "flex", alignItems: "flex-start",
                background: i % 2 === 0 ? "#F8FAFC" : "#fff",
                padding: "10px 16px",
                borderBottom: i < 9 ? `1px solid ${C.border}` : "none",
              }}>
                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{k}</span>
                <span style={{
                  fontSize: 13, fontWeight: k === "Amount" || k === "New Balance" ? 800 : 500,
                  color: k === "Amount" ? C.success : k === "New Balance" ? C.primary : "#0F172A",
                }}>{v}</span>
              </div>
            ))}
          </div>

          {submitErr && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.dangerBg, border: `1px solid #FCA5A5`, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <XCircle size={15} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#B91C1C" }}>{submitErr}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onBack} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", color: C.textSecond }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={submitting} style={{
              ...btnPrimary, flex: 2, padding: "11px",
              opacity: submitting ? 0.75 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}>
              {submitting ? "Processing…" : "Confirm Top-Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessCard({ receipt, onNewTopUp }) {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
          padding: "32px 24px 28px",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <CheckCircle size={32} color="#fff" strokeWidth={2} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            Top-Up Successful!
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>
            {receipt.user_name}'s wallet has been recharged
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.primary, marginBottom: 4 }}>
            +${parseFloat(receipt.amount_credited).toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
            New balance: <strong style={{ color: "#0F172A" }}>${parseFloat(receipt.new_balance).toFixed(2)}</strong>
            &nbsp;(was ${parseFloat(receipt.balance_before).toFixed(2)})
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", marginBottom: 24 }}>
            {[
              ["Top-Up ID",  `#${receipt.top_up_id}`],
              ["Reference",  receipt.transaction_reference],
              ["Processed",  new Date(receipt.processed_at).toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted }}>{k}</span>
                <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: k !== "Processed" ? "monospace" : undefined }}>{v}</span>
              </div>
            ))}
          </div>

          <button onClick={onNewTopUp} style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: 15 }}>
            Process Another Top-Up
          </button>
        </div>
      </div>
    </div>
  );
}
