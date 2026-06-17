import { useState, useRef, useCallback } from "react";
import {
  Search, User, CheckCircle, XCircle, AlertTriangle,
  ChevronRight, ArrowLeft, Loader, BadgeCheck, QrCode,
  Lock, CloudOff, Clock, ShieldAlert,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/apiClient";
import { useAuth }        from "../context/AuthContext";
import { useShift }       from "../context/ShiftContext";
import { useOfflineCtx }  from "../context/OfflineContext";
import { idempotency }    from "../utils/idempotency";
import { C, cardStyle, inputStyle, labelStyle, btnPrimary } from "../styles/themes";
import QRScanModal from "../components/QRScanModal";
import { useSettings } from "../context/SettingsContext";

// ─── constants ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = ["Cash", "Card (Debit/Credit)", "Mobile Transfer", "Bank Transfer", "Voucher", "Other"];
const STEPS = { SEARCH: "search", CONFIRM_USER: "confirm_user", FORM: "form", CONFIRM: "confirm", SUCCESS: "success" };
const EMPTY_FORM = { amount: "", payment_method: "Cash", recharge_location: "", transaction_reference: "", notes: "" };

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt         = (n, cur = "USD", rate = 1) => { const v = (parseFloat(n ?? 0)) * rate; const dec = rate >= 100 ? 0 : 2; return `${cur} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`; };
const fmtDateTime = (iso) => new Date(iso).toLocaleString("en-GB", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const receiptNo   = (id) => `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(id).slice(-5).padStart(5, "0")}`;

const statusColor = (s = "Active") => {
  const l = s.toLowerCase();
  if (l === "active")                                         return { color: C.success, bg: C.successBg };
  if (l === "inactive" || l === "blocked" || l === "suspended") return { color: C.danger,  bg: C.dangerBg  };
  return { color: C.warning, bg: C.warningBg };
};

const parseScannedValue = (raw = "") => {
  const t = raw.trim();
  const m = t.match(/YALLA[-_]USER[-_](\d+)/i);
  if (m) return m[1];
  if (/^\d+$/.test(t)) return t;
  return t;
};

// ─── TopUpPage ────────────────────────────────────────────────────────────────
export default function TopUpPage() {
  const { user: staffUser }                       = useAuth();
  const { isShiftOpen, shift, recordTransaction } = useShift();
  const { isOnline, enqueue }                     = useOfflineCtx();
  const navigate                                  = useNavigate();
  const { currency, exchangeRate }                = useSettings();

  const [step,         setStep]         = useState(STEPS.SEARCH);
  const [query,        setQuery]        = useState("");
  const [searching,    setSearching]    = useState(false);
  const [results,      setResults]      = useState([]);
  const [searchErr,    setSearchErr]    = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [formErr,      setFormErr]      = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  const [receipt,      setReceipt]      = useState(null);
  const [submitErr,    setSubmitErr]    = useState(null);
  const [showScanner,  setShowScanner]  = useState(false);
  const [dupWarning,   setDupWarning]   = useState(null); // { secondsLeft }

  const searchTimer = useRef(null);

  // ── Shift gate ───────────────────────────────────────────────────────────
  if (!isShiftOpen) {
    return (
      <div style={{ padding: "28px 32px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ ...cardStyle, border: `1.5px solid #FCA5A5`, background: "#FEF2F2", textAlign: "center", padding: "48px 36px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FEE2E2", border: "2px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Lock size={28} color={C.danger} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#B91C1C", marginBottom: 8 }}>No Active Shift</div>
          <div style={{ fontSize: 14, color: "#DC2626", marginBottom: 28, lineHeight: 1.6 }}>
            You must open a shift before processing wallet top-ups.<br />
            This ensures all transactions are properly tracked and reconciled.
          </div>
          <button onClick={() => navigate("/shift")} style={{ ...btnPrimary, margin: "0 auto", padding: "12px 28px", fontSize: 15 }}>
            Open Shift Now <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Search ───────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) { setResults([]); setSearchErr(null); return; }
    setSearching(true); setSearchErr(null);
    try {
      const data = await apiClient.get(`/staff/wallet/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data ?? []);
      if ((data ?? []).length === 0) setSearchErr("No passengers found.");
    } catch (err) {
      setSearchErr(err.message); setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  const handleScanResult = async ({ raw }) => {
    setShowScanner(false);
    const q = parseScannedValue(raw);
    setQuery(q);
    await doSearch(q);
  };

  const selectUser = (u) => {
    const st = (u.status ?? "Active").toLowerCase();
    if (st === "inactive" || st === "blocked" || st === "suspended") {
      if (!window.confirm(`This account is ${u.status}. Continue?`)) return;
    }
    setSelectedUser(u);
    setStep(STEPS.CONFIRM_USER);
  };

  // ── Form helpers ─────────────────────────────────────────────────────────
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0)  e.amount            = "Enter a positive amount";
    if (amt > 500)                                e.amount            = "Single top-up cannot exceed $500 per transaction";
    if (!form.recharge_location.trim())           e.recharge_location = "Location is required";
    if (!form.transaction_reference.trim())       e.transaction_reference = "Transaction reference is required";
    setFormErr(e);
    return Object.keys(e).length === 0;
  };

  // ── Idempotency check on entering CONFIRM step ───────────────────────────
  const enterConfirm = () => {
    const dup = idempotency.check(selectedUser.user_id, form.amount);
    if (dup.isDuplicate) {
      setDupWarning(dup);
      return;
    }
    setDupWarning(null);
    setStep(STEPS.CONFIRM);
  };

  // ── Submit (online or offline) ───────────────────────────────────────────
  const handleSubmit = async () => {
    // Final idempotency guard
    const dup = idempotency.check(selectedUser.user_id, form.amount);
    if (dup.isDuplicate) {
      setSubmitErr(`Duplicate detected — please wait ${dup.secondsLeft}s before retrying the same amount for this passenger.`);
      return;
    }

    setSubmitting(true); setSubmitErr(null);

    const payload = {
      user_id:               selectedUser.user_id,
      amount:                parseFloat(form.amount),
      payment_method:        form.payment_method,
      recharge_location:     form.recharge_location.trim(),
      transaction_reference: form.transaction_reference.trim(),
      notes:                 form.notes.trim() || undefined,
    };

    // ── OFFLINE PATH ───────────────────────────────────────────────────────
    if (!isOnline) {
      try {
        const item = await enqueue(payload);
        idempotency.register(selectedUser.user_id, form.amount);
        const queuedReceipt = {
          queued:                true,
          queue_id:              item.id,
          created_at:            item.created_at,
          signature:             item.signature,
          user_name:             selectedUser.full_name,
          user_email:            selectedUser.email,
          user_id:               selectedUser.user_id,
          amount:                parseFloat(form.amount),
          payment_method:        form.payment_method,
          station:               form.recharge_location.trim(),
          transaction_reference: form.transaction_reference.trim(),
        };
        recordTransaction(parseFloat(form.amount), form.payment_method, {
          id:         item.id,
          receipt_no: item.id,
          user_name:  selectedUser.full_name,
          user_id:    selectedUser.user_id,
          user_email: selectedUser.email,
          station:    form.recharge_location.trim(),
          reference:  form.transaction_reference.trim(),
          time:       item.created_at,
          queued:     true,
        });
        setReceipt(queuedReceipt);
        setStep(STEPS.SUCCESS);
      } catch (err) {
        setSubmitErr("Failed to queue transaction: " + err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── ONLINE PATH ────────────────────────────────────────────────────────
    try {
      const data = await apiClient.post("/staff/wallet/topup", payload);
      idempotency.register(selectedUser.user_id, form.amount);

      const fullReceipt = {
        ...data,
        receipt_no:    receiptNo(data.top_up_id),
        user_email:    selectedUser.email,
        user_phone:    selectedUser.phone,
        user_id:       selectedUser.user_id,
        payment_method: form.payment_method,
        station:       form.recharge_location.trim(),
        notes:         form.notes.trim(),
        staff_id:      staffUser?.user_id  ?? 1,
        staff_name:    staffUser?.full_name ?? "Staff Member",
        shift_id:      shift?.shift_id ?? "—",
      };

      recordTransaction(parseFloat(form.amount), form.payment_method, {
        id:         data.top_up_id,
        receipt_no: fullReceipt.receipt_no,
        user_name:  data.user_name,
        user_id:    selectedUser.user_id,
        user_email: selectedUser.email,
        station:    form.recharge_location.trim(),
        reference:  form.transaction_reference.trim(),
        time:       data.processed_at,
      });

      setReceipt(fullReceipt);
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetAll = () => {
    setStep(STEPS.SEARCH); setQuery(""); setResults([]);
    setSearchErr(null); setSelectedUser(null); setForm(EMPTY_FORM);
    setFormErr({}); setReceipt(null); setSubmitErr(null); setDupWarning(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>Wallet Top-Up</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
          Search for a passenger, verify identity, then process the recharge.
        </p>
      </div>

      {/* Shift strip */}
      {shift && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, marginBottom: 14, background: C.successBg, border: `1px solid ${C.primaryBorder}` }}>
          <CheckCircle size={13} color={C.primary} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#064E3B" }}>
            Shift {shift.shift_id} · {shift.location} · {shift.tx_count} tx today
          </span>
        </div>
      )}

      {/* Offline strip */}
      {!isOnline && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, marginBottom: 14, background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
          <CloudOff size={13} color={C.danger} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C" }}>
            Offline mode — top-ups will be queued locally and synced when reconnected.
          </span>
        </div>
      )}

      <StepIndicator current={step} />

      {/* ════ STEP 1 — SEARCH ════ */}
      {step === STEPS.SEARCH && (
        <div style={cardStyle}>
          <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid #F1F5F9`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Find Passenger</span>
            <button onClick={() => setShowScanner(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${C.primaryBorder}`, background: C.primaryLight, fontSize: 12, fontWeight: 700, color: C.primary, cursor: "pointer" }}>
              <QrCode size={14} /> Scan QR Code
            </button>
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <Search size={16} color={C.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input value={query} onChange={e => handleQueryChange(e.target.value)} placeholder="Search by name, email, phone, or user ID…" autoFocus style={{ ...inputStyle, paddingLeft: 44, paddingRight: 44, fontSize: 14 }} />
              {searching && <Loader size={14} color={C.primary} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", animation: "spin 1s linear infinite" }} />}
            </div>
            {searchErr && <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 13, padding: "10px 0" }}><AlertTriangle size={15} /> {searchErr}</div>}
            {results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map(u => {
                  const sc = statusColor(u.status);
                  return (
                    <div key={u.user_id} onClick={() => selectUser(u)}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: "1.5px solid #E2E8F0", borderRadius: 12, cursor: "pointer", transition: "border-color .15s, background .15s", background: "#FAFBFC" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.primaryLight; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#FAFBFC"; }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: C.primaryLight, border: `1px solid ${C.primaryBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><User size={18} color={C.primary} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{u.full_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: 99 }}>{u.status ?? "Active"}</span>
                        </div>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{u.email}{u.phone ? ` · ${u.phone}` : ""}</span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{fmt(u.balance, currency, exchangeRate)}</div>
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
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>Or tap <strong style={{ color: C.primary }}>Scan QR Code</strong> to use the camera</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ STEP 2 — CONFIRM USER ════ */}
      {step === STEPS.CONFIRM_USER && selectedUser && (
        <div>
          <BackBtn onClick={() => setStep(STEPS.SEARCH)} label="Back to search" />
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid #F1F5F9`, display: "flex", alignItems: "center", gap: 8 }}>
              <BadgeCheck size={16} color={C.primary} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Verify Passenger Identity</span>
            </div>
            <div style={{ padding: 24 }}>
              <UserInfoCard user={selectedUser} />
              {["inactive","blocked","suspended"].includes((selectedUser.status ?? "").toLowerCase()) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.dangerBg, border: `1px solid #FCA5A5`, borderRadius: 10, padding: "12px 16px", marginTop: 16 }}>
                  <XCircle size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>Account is {selectedUser.status}</div>
                    <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>You cannot top up an inactive or blocked account.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!["inactive","blocked","suspended"].includes((selectedUser.status ?? "").toLowerCase()) && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(STEPS.FORM)} style={{ ...btnPrimary, gap: 8 }}>
                Confirm — Proceed to Recharge <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════ STEP 3 — RECHARGE FORM ════ */}
      {step === STEPS.FORM && selectedUser && (
        <div>
          <BackBtn onClick={() => setStep(STEPS.CONFIRM_USER)} label="Back" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
            <div style={cardStyle}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid #F1F5F9` }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Recharge Details</span>
              </div>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={labelStyle}>Amount (USD) *</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 800, color: "#475569" }}>$</span>
                    <input type="number" min="0.01" step="0.01" max="10000" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28, fontSize: 20, fontWeight: 800 }} />
                  </div>
                  {formErr.amount && <ErrMsg msg={formErr.amount} />}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {[5,10,20,50,100,200].map(a => (
                      <button key={a} onClick={() => set("amount", String(a))} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${form.amount === String(a) ? C.primary : C.border}`, background: form.amount === String(a) ? C.primaryLight : "#fff", color: form.amount === String(a) ? C.primary : C.textSecond }}>${a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Payment Method *</label>
                  <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Recharge Location *</label>
                  <input value={form.recharge_location} onChange={e => set("recharge_location", e.target.value)} placeholder={shift?.location ?? "e.g. Central Bus Station — Main Office"} style={inputStyle} />
                  {form.recharge_location === "" && shift?.location && (
                    <button onClick={() => set("recharge_location", shift.location)} style={{ fontSize: 11, color: C.primary, background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0, fontWeight: 600 }}>
                      Use current station: {shift.location}
                    </button>
                  )}
                  {formErr.recharge_location && <ErrMsg msg={formErr.recharge_location} />}
                </div>
                <div>
                  <label style={labelStyle}>Transaction Reference / Receipt No. *</label>
                  <input value={form.transaction_reference} onChange={e => set("transaction_reference", e.target.value)} placeholder="e.g. RCPT-2024-00142" style={inputStyle} />
                  {formErr.transaction_reference && <ErrMsg msg={formErr.transaction_reference} />}
                </div>
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes…" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
                </div>
                <button onClick={() => { if (validate()) enterConfirm(); }} style={{ ...btnPrimary, width: "100%", padding: "13px", fontSize: 15, gap: 8 }}>
                  Review & Confirm <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={{ ...cardStyle, position: "sticky", top: 20 }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid #F1F5F9` }}><span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Selected Passenger</span></div>
              <div style={{ padding: 18 }}><UserInfoCard user={selectedUser} compact /></div>
            </div>
          </div>

          {/* Duplicate warning (shown inline before step change) */}
          {dupWarning && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "#FEF3C7", border: "1.5px solid #FDE68A" }}>
              <ShieldAlert size={16} color={C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>Duplicate Transaction Detected</div>
                <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                  A top-up of {fmt(form.amount, currency, exchangeRate)} for this passenger was submitted {30 - dupWarning.secondsLeft}s ago.
                  Wait <strong>{dupWarning.secondsLeft}s</strong> before retrying to prevent double-charging.
                </div>
                <button onClick={() => { setDupWarning(null); setStep(STEPS.CONFIRM); }} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 7, border: "1.5px solid #FDE68A", background: "#fff", fontSize: 11, fontWeight: 700, color: "#92400E", cursor: "pointer" }}>
                  Override &amp; Continue Anyway
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ STEP 4 — CONFIRM ════ */}
      {step === STEPS.CONFIRM && (
        <ConfirmDialog
          user={selectedUser}
          form={form}
          isOnline={isOnline}
          submitting={submitting}
          submitErr={submitErr}
          onBack={() => { setStep(STEPS.FORM); setSubmitErr(null); }}
          onConfirm={handleSubmit}
        />
      )}

      {/* ════ STEP 5 — SUCCESS ════ */}
      {step === STEPS.SUCCESS && receipt && (
        receipt.queued
          ? <QueuedCard receipt={receipt} onNewTopUp={resetAll} />
          : <DigitalReceipt receipt={receipt} onNewTopUp={resetAll} staffUser={staffUser} />
      )}

      {showScanner && <QRScanModal onResult={handleScanResult} onClose={() => setShowScanner(false)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = [
    { id: STEPS.SEARCH, label: "Search" }, { id: STEPS.CONFIRM_USER, label: "Verify" },
    { id: STEPS.FORM,   label: "Details"}, { id: STEPS.CONFIRM,      label: "Confirm" },
    { id: STEPS.SUCCESS, label: "Done" },
  ];
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done = i < idx; const active = i === idx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? C.primary : active ? C.primaryLight : "#F1F5F9", border: `2px solid ${done || active ? C.primary : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: done ? "#fff" : active ? C.primary : C.textMuted }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? C.primary : C.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? C.primary : C.border, margin: "0 4px", marginBottom: 18, minWidth: 20 }} />}
          </div>
        );
      })}
    </div>
  );
}

function BackBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textSecond, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

function UserInfoCard({ user, compact }) {
  const { currency, exchangeRate } = useSettings();
  const sc = statusColor(user.status);
  return (
    <div style={{ display: "flex", alignItems: compact ? "center" : "flex-start", gap: 14 }}>
      <div style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, borderRadius: compact ? 12 : 14, background: C.primaryLight, border: `1px solid ${C.primaryBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <User size={compact ? 18 : 24} color={C.primary} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 800, color: "#0F172A" }}>{user.full_name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: 99 }}>{user.status ?? "Active"}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{user.email}</div>
        {!compact && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <InfoChip label="User ID" value={`#${user.user_id}`} />
            <InfoChip label="Phone" value={user.phone ?? "—"} />
            <InfoChip label="Balance" value={fmt(user.balance, currency, exchangeRate)} accent />
            <InfoChip label="Joined" value={user.joined ?? "—"} />
          </div>
        )}
        {compact && <div style={{ display: "flex", gap: 10, marginTop: 8 }}><span style={{ fontSize: 11, color: C.textMuted }}>ID #{user.user_id}</span><span style={{ fontSize: 11, color: C.primary, fontWeight: 700 }}>{fmt(user.balance, currency, exchangeRate)}</span></div>}
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

function ConfirmDialog({ user, form, isOnline, submitting, submitErr, onBack, onConfirm }) {
  const { currency, exchangeRate } = useSettings();
  const newBalance = parseFloat(user.balance) + parseFloat(form.amount || 0);
  return (
    <div>
      <BackBtn onClick={onBack} label="Back to form" />
      <div style={{ ...cardStyle, maxWidth: 520, margin: "0 auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid #F1F5F9`, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={C.warning} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Confirm Top-Up</span>
          {!isOnline && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: C.danger, background: "#FEF2F2", padding: "3px 9px", borderRadius: 99 }}>
              <CloudOff size={11} /> Will be queued offline
            </span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {!isOnline && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FEF2F2", border: `1px solid #FCA5A5`, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <CloudOff size={14} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: "#B91C1C" }}>
                <strong>Offline mode:</strong> This top-up will be saved locally with a cryptographic signature and synced automatically when connection is restored. The passenger's balance will update after sync.
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            {[
              ["Passenger",       user.full_name],
              ["User ID",         `#${user.user_id}`],
              ["Current Balance", fmt(user.balance, currency, exchangeRate)],
              ["Amount",          fmt(form.amount, currency, exchangeRate)],
              ["New Balance",     isOnline ? fmt(newBalance, currency, exchangeRate) : "Pending sync"],
              ["Payment",         form.payment_method],
              ["Location",        form.recharge_location],
              ["Reference",       form.transaction_reference],
              ...(form.notes ? [["Notes", form.notes]] : []),
            ].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", alignItems: "flex-start", background: i % 2 === 0 ? "#F8FAFC" : "#fff", padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: k === "Amount" || k === "New Balance" ? 800 : 500, color: k === "Amount" ? C.success : k === "New Balance" ? C.primary : "#0F172A" }}>{v}</span>
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
            <button onClick={onBack} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", color: C.textSecond }}>Cancel</button>
            <button onClick={onConfirm} disabled={submitting} style={{ ...btnPrimary, flex: 2, padding: "11px", opacity: submitting ? 0.75 : 1, cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Processing…" : isOnline ? "Confirm Top-Up" : "Queue Offline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Queued (offline) success card ───────────────────────────────────────────
function QueuedCard({ receipt, onNewTopUp }) {
  const { currency, exchangeRate } = useSettings();
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div style={cardStyle}>
        <div style={{ background: `linear-gradient(135deg, #1E3A5F, #0F4C81)`, padding: "28px 28px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <CloudOff size={26} color="#fff" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Queued Offline</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>Transaction saved locally — will sync when back online</div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            {[
              ["Queue ID",   receipt.queue_id],
              ["Passenger",  receipt.user_name],
              ["Amount",     fmt(receipt.amount, currency, exchangeRate)],
              ["Method",     receipt.payment_method],
              ["Station",    receipt.station],
              ["Queued At",  new Date(receipt.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })],
              ["Signature",  receipt.signature?.slice(0, 24) + "…"],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", alignItems: "flex-start", background: i % 2 === 0 ? "#F8FAFC" : "#fff", padding: "9px 14px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ width: 120, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 12, color: "#0F172A", fontFamily: k === "Signature" || k === "Queue ID" ? "monospace" : undefined, fontWeight: k === "Amount" ? 800 : 500, color: k === "Amount" ? C.primary : "#0F172A" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", marginBottom: 20 }}>
            <Clock size={14} color={C.info} />
            <span style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>
              This transaction will be automatically synced when your device reconnects to the internet.
            </span>
          </div>
          <button onClick={onNewTopUp} style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: 15 }}>
            Process Another Top-Up
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Digital receipt (online) ─────────────────────────────────────────────────
function DigitalReceipt({ receipt, onNewTopUp }) {
  const { currency, exchangeRate } = useSettings();
  const shareText = [
    `🧾 YALLA TRANSIT — WALLET TOP-UP RECEIPT`,
    `Receipt No: ${receipt.receipt_no}`,
    `Date: ${fmtDateTime(receipt.processed_at)}`,
    ``,
    `Passenger: ${receipt.user_name}`,
    `Email: ${receipt.user_email || ""}`,
    ``,
    `Amount Added: +${fmt(receipt.amount_credited, currency, exchangeRate)}`,
    `Previous Balance: ${fmt(receipt.balance_before, currency, exchangeRate)}`,
    `NEW BALANCE: ${fmt(receipt.new_balance, currency, exchangeRate)}`,
    ``,
    `Payment Method: ${receipt.payment_method}`,
    `Station: ${receipt.station}`,
    `Processed by: ${receipt.staff_name} (ID #${receipt.staff_id})`,
    `Shift: ${receipt.shift_id}`,
    ``,
    `Yalla Transit — Smart Transit System`,
  ].join("\n");

  const cleanPhone = (receipt.user_phone ?? "").replace(/\D/g, "");
  const shareWhatsApp = () => {
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };
  const shareSMS     = () => window.open(`sms:${cleanPhone}?body=${encodeURIComponent(shareText)}`, "_blank");
  const shareEmail   = () => window.open(`mailto:${encodeURIComponent(receipt.user_email || "")}?subject=${encodeURIComponent(`Receipt — ${receipt.receipt_no}`)}&body=${encodeURIComponent(shareText)}`, "_blank");
  const printReceipt = () => window.print();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div id="digital-receipt-print">
        <div style={cardStyle}>
          <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, padding: "28px 28px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,.18)", border: "2px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={28} color="#fff" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Top-Up Successful</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{fmtDateTime(receipt.processed_at)}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>+{fmt(receipt.amount_credited, currency, exchangeRate)}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{receipt.payment_method}</div>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px dashed ${C.border}`, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".5px" }}>Receipt No.</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>{receipt.receipt_no}</span>
            </div>

            <SLabel>Passenger</SLabel>
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryLight, border: `1px solid ${C.primaryBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><User size={16} color={C.primary} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{receipt.user_name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{receipt.user_email}</div>
                  {receipt.user_phone && <div style={{ fontSize: 12, color: C.textMuted }}>{receipt.user_phone}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>USER ID</div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#0F172A" }}>#{receipt.user_id}</div>
                </div>
              </div>
            </div>

            <SLabel>Balance Update</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>PREVIOUS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{fmt(receipt.balance_before, currency, exchangeRate)}</div>
              </div>
              <div style={{ fontSize: 20, color: C.primary, fontWeight: 800, textAlign: "center" }}>→</div>
              <div style={{ background: C.primaryLight, borderRadius: 10, border: `1px solid ${C.primaryBorder}`, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.primary, fontWeight: 600, marginBottom: 4 }}>NEW BALANCE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{fmt(receipt.new_balance, currency, exchangeRate)}</div>
              </div>
            </div>

            <SLabel>Transaction Details</SLabel>
            <div style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              {[
                ["Payment Method", receipt.payment_method],
                ["Station",        receipt.station],
                ["Shift",          receipt.shift_id],
                ["Ref Number",     receipt.transaction_reference],
                ...(receipt.notes ? [["Notes", receipt.notes]] : []),
              ].map(([k, v], i) => (
                <div key={k} style={{ display: "flex", alignItems: "flex-start", background: i % 2 === 0 ? "#F8FAFC" : "#fff", padding: "9px 14px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ width: 130, fontSize: 12, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>{v}</span>
                </div>
              ))}
            </div>

            <SLabel>Processed By</SLabel>
            <div style={{ background: "#F8FAFC", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px", marginBottom: 24 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{receipt.staff_name}</span>
              <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>Staff ID #{receipt.staff_id}</span>
            </div>

            <SLabel>Share Receipt</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
              <ShareBtn onClick={shareWhatsApp} icon="💬" label="WhatsApp" hoverColor="#25D366" />
              <ShareBtn onClick={shareSMS}      icon="📱" label="SMS"       hoverColor="#3B82F6" />
              <ShareBtn onClick={shareEmail}    icon="✉️"  label="Email"     hoverColor={C.info}  />
              <ShareBtn onClick={printReceipt}  icon="🖨"  label="Print"     hoverColor={C.textSecond} />
            </div>

            <button onClick={onNewTopUp} style={{ ...btnPrimary, width: "100%", padding: "12px", fontSize: 15 }}>
              Process Another Top-Up
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #digital-receipt-print,
          #digital-receipt-print * { visibility: visible !important; }
          #digital-receipt-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}

function SLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{children}</div>;
}

function ShareBtn({ onClick, icon, label, hoverColor }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 6px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, color: C.textMuted, transition: "border-color .15s, color .15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = hoverColor; e.currentTarget.style.color = hoverColor; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>{label}
    </button>
  );
}
