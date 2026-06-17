import { useState, useEffect, useCallback, useRef } from "react";
import {
  Globe, Receipt, Wallet, BookOpen, MapPin,
  Shield, Wrench, AlertTriangle, Check, RefreshCw,
} from "lucide-react";
import { Panel } from "../components/Panel";
import apiClient from "../api/apiClient";
import { useSettings } from "../context/SettingsContext";

// ── Validation helpers ─────────────────────────────────────────────────────────

function errNum(val, min, max, label) {
  const n = parseFloat(val);
  if (val === "" || isNaN(n)) return `${label} must be a number`;
  if (min !== undefined && n < min) return `${label} must be ≥ ${min}`;
  if (max !== undefined && n > max) return `${label} must be ≤ ${max}`;
  return null;
}
function errInt(val, min, max, label) {
  const n = Number(val);
  if (val === "" || isNaN(n) || !Number.isInteger(n)) return `${label} must be a whole number`;
  if (min !== undefined && n < min) return `${label} must be ≥ ${min}`;
  if (max !== undefined && n > max) return `${label} must be ≤ ${max}`;
  return null;
}
function errEmail(val, label) {
  if (!val?.trim()) return `${label} is required`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return `${label} is not a valid email`;
  return null;
}
function errRequired(val, label) {
  return val?.trim() ? null : `${label} is required`;
}

// ── Primitive components ───────────────────────────────────────────────────────

function Field({ label, description, type = "text", value, onChange, unit, min, max, step, placeholder, error }) {
  const [focused, setFocused] = useState(false);
  const hasErr = !!error;
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: hasErr ? "#DC2626" : "#374151", marginBottom: 4 }}>
        {label}
        {unit && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400, marginLeft: 4 }}>({unit})</span>}
      </label>
      {description && <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, lineHeight: 1.5, marginTop: 0 }}>{description}</p>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "9px 12px", boxSizing: "border-box",
          border: `1.5px solid ${hasErr ? "#EF4444" : focused ? "#2563EB" : "#E2E8F0"}`,
          borderRadius: 9, fontSize: 14, color: "#1E293B",
          background: hasErr ? "#FEF2F2" : focused ? "#fff" : "#F8FAFC",
          outline: "none",
          boxShadow: focused ? `0 0 0 3px ${hasErr ? "rgba(239,68,68,.12)" : "rgba(37,99,235,.10)"}` : "none",
          transition: "border-color .15s, box-shadow .15s",
        }}
      />
      {hasErr && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4, marginBottom: 0, fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

function Select({ label, description, value, onChange, options, error }) {
  const [focused, setFocused] = useState(false);
  const hasErr = !!error;
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: hasErr ? "#DC2626" : "#374151", marginBottom: 4 }}>
        {label}
      </label>
      {description && <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, lineHeight: 1.5, marginTop: 0 }}>{description}</p>}
      <select
        value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "9px 12px", boxSizing: "border-box",
          border: `1.5px solid ${hasErr ? "#EF4444" : focused ? "#2563EB" : "#E2E8F0"}`,
          borderRadius: 9, fontSize: 14, color: "#1E293B",
          background: "#F8FAFC", outline: "none", cursor: "pointer",
          boxShadow: focused ? "0 0 0 3px rgba(37,99,235,.10)" : "none",
          transition: "border-color .15s",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hasErr && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4, marginBottom: 0, fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          cursor: "pointer", width: 44, height: 24, borderRadius: 12,
          background: checked ? "#2563EB" : "#CBD5E1",
          position: "relative", flexShrink: 0, marginTop: 2,
          transition: "background .2s",
        }}
      >
        <div style={{
          position: "absolute", top: 3,
          left: checked ? 23 : 3, width: 18, height: 18,
          borderRadius: "50%", background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transition: "left .2s",
        }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{label}</div>
        {description && <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 0, marginTop: 3, lineHeight: 1.5 }}>{description}</p>}
      </div>
    </div>
  );
}

function Textarea({ label, description, value, onChange, rows = 3, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {description && <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6, lineHeight: 1.5, marginTop: 0 }}>{description}</p>}
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        rows={rows} placeholder={placeholder}
        style={{
          width: "100%", padding: "9px 12px", boxSizing: "border-box",
          border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14,
          color: "#1E293B", background: "#F8FAFC", outline: "none",
          resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function TwoCol({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>{children}</div>;
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px" }}>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#F1F5F9" }} />
    </div>
  );
}

// ── Save hook ──────────────────────────────────────────────────────────────────

function useSectionSave(s, keys, validateFn) {
  const { reloadSettings } = useSettings();
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [valErrs, setValErrs] = useState({});
  const savedTimer = useRef(null);

  const save = useCallback(async () => {
    // Validate first
    const errs = validateFn ? validateFn(s) : {};
    setValErrs(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setSaveErr(null);
    const body = {};
    keys.forEach(k => { body[k] = String(s[k]); });
    try {
      await apiClient.put("/settings", body);
      reloadSettings(); // push changes into global SettingsContext immediately
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveErr(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [s, keys, validateFn, reloadSettings]);

  // Clear field error when user edits
  const clearErr = useCallback((key) => {
    setValErrs(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return { save, saving, saved, saveErr, valErrs, clearErr };
}

// ── Section header with save button ───────────────────────────────────────────

function SaveRow({ onSave, saving, saved, saveErr }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {saveErr && (
        <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>
          {saveErr}
        </span>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 18px", border: "none", borderRadius: 8,
          background: saved ? "#059669" : saving ? "#93C5FD" : "#2563EB",
          color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          transition: "background .2s", whiteSpace: "nowrap",
        }}
      >
        {saved ? <><Check size={13} /> Saved</> : saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

// ── DEFAULTS (match seed_azure.sql exactly) ────────────────────────────────────

const DEFAULTS = {
  "app.name":                    "Yalla Transit",
  "app.timezone":                "Asia/Beirut",
  "app.currency":                "USD",
  "app.exchange_rate":           "1",
  "app.language":                "en",
  "app.support_email":           "support@yallatransit.lb",
  "app.support_phone":           "+961 1 999 000",
  "fare.base_amount":            "1.50",
  "fare.per_km_rate":            "0.10",
  "fare.student_discount":       "0.25",
  "fare.senior_discount":        "0.30",
  "fare.employee_discount":      "0.10",
  "fare.school_discount":        "0.50",
  "wallet.max_balance":          "1000.00",
  "wallet.min_topup":            "5.00",
  "wallet.max_topup":            "500.00",
  "wallet.low_balance_alert":    "5.00",
  "booking.max_seats_per_trip":  "4",
  "booking.qr_ttl_minutes":      "30",
  "gps.update_interval_sec":     "10",
  "gps.stale_threshold_sec":     "60",
  "gps.geofence_radius_m":       "150",
  "security.max_login_attempts": "5",
  "security.lockout_minutes":    "15",
  "security.jwt_access_ttl":     "900",
  "security.jwt_refresh_ttl":    "604800",
  "maintenance.mode":            "false",
  "maintenance.message":         "We are upgrading the system. Back shortly.",
  "notifications.push_enabled":  "true",
  "notifications.sms_enabled":   "false",
};

// ── Options for select fields ──────────────────────────────────────────────────

const CURRENCY_OPTS = [
  { value: "USD", label: "USD — US Dollar"           },
  { value: "OMR", label: "OMR — Omani Rial"          },
  { value: "AED", label: "AED — UAE Dirham"          },
  { value: "SAR", label: "SAR — Saudi Riyal"         },
  { value: "EUR", label: "EUR — Euro"                },
  { value: "GBP", label: "GBP — British Pound"       },
  { value: "LBP", label: "LBP — Lebanese Pound"      },
  { value: "JOD", label: "JOD — Jordanian Dinar"     },
  { value: "EGP", label: "EGP — Egyptian Pound"      },
  { value: "QAR", label: "QAR — Qatari Riyal"        },
];

const LANG_OPTS = [
  { value: "en", label: "English (en)"    },
  { value: "ar", label: "Arabic (ar)"     },
  { value: "fr", label: "French (fr)"     },
  { value: "de", label: "German (de)"     },
  { value: "es", label: "Spanish (es)"    },
  { value: "tr", label: "Turkish (tr)"    },
];

const TIMEZONE_OPTS = [
  { value: "Asia/Beirut",    label: "Asia/Beirut (GMT+3)"         },
  { value: "Asia/Dubai",     label: "Asia/Dubai (GMT+4)"          },
  { value: "Asia/Riyadh",    label: "Asia/Riyadh (GMT+3)"        },
  { value: "Asia/Kuwait",    label: "Asia/Kuwait (GMT+3)"         },
  { value: "Asia/Qatar",     label: "Asia/Qatar (GMT+3)"          },
  { value: "Asia/Muscat",    label: "Asia/Muscat (GMT+4)"         },
  { value: "Asia/Amman",     label: "Asia/Amman (GMT+3)"          },
  { value: "Asia/Baghdad",   label: "Asia/Baghdad (GMT+3)"        },
  { value: "Africa/Cairo",   label: "Africa/Cairo (GMT+2)"        },
  { value: "Europe/London",  label: "Europe/London (GMT+0/+1)"    },
  { value: "Europe/Paris",   label: "Europe/Paris (GMT+1/+2)"     },
  { value: "UTC",            label: "UTC (GMT+0)"                  },
];

// ── Tab: General ───────────────────────────────────────────────────────────────

function validateGeneral(s) {
  const e = {};
  const name = errRequired(s["app.name"], "App Name");
  if (name) e["app.name"] = name;
  const email = errEmail(s["app.support_email"], "Support Email");
  if (email) e["app.support_email"] = email;
  const phone = errRequired(s["app.support_phone"], "Support Phone");
  if (phone) e["app.support_phone"] = phone;
  const rate = errNum(s["app.exchange_rate"], 0.0001, undefined, "Exchange Rate");
  if (rate) e["app.exchange_rate"] = rate;
  return e;
}

function GeneralTab({ s, set }) {
  const keys = ["app.name","app.timezone","app.currency","app.exchange_rate","app.language","app.support_email","app.support_phone"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateGeneral);
  const f = (k, v) => { set(k, v); clearErr(k); };

  return (
    <Panel title="General Application Settings" icon={<Globe size={14} color="#2563EB" />} accent="#2563EB"
      extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
      <div style={{ paddingTop: 10 }}>
        <TwoCol>
          <Field label="Application Name" placeholder="Yalla Transit"
            description="Public name shown in the mobile app and portals."
            value={s["app.name"]} onChange={v => f("app.name", v)} error={valErrs["app.name"]} />
          <Select label="Timezone" options={TIMEZONE_OPTS}
            description="System-wide timezone for schedules and logs."
            value={s["app.timezone"]} onChange={v => f("app.timezone", v)} />
          <Select label="Currency" options={CURRENCY_OPTS}
            description="ISO 4217 currency code used for fares and wallets."
            value={s["app.currency"]} onChange={v => f("app.currency", v)} />
          <Field label="Exchange Rate" unit="per 1 USD" type="number" min="0.0001" step="1"
            description="Units of the selected currency equal to 1 USD. Set to 1 for USD-based systems."
            value={s["app.exchange_rate"]} onChange={v => f("app.exchange_rate", v)} error={valErrs["app.exchange_rate"]} />
          <Select label="Default Language" options={LANG_OPTS}
            description="Default UI language for passengers and drivers."
            value={s["app.language"]} onChange={v => f("app.language", v)} />
          <Field label="Support Email" type="email" placeholder="support@yallatransit.lb"
            description="Contact email shown to passengers and drivers."
            value={s["app.support_email"]} onChange={v => f("app.support_email", v)} error={valErrs["app.support_email"]} />
          <Field label="Support Phone" placeholder="+961 1 999 000"
            description="Contact phone number shown in the mobile app."
            value={s["app.support_phone"]} onChange={v => f("app.support_phone", v)} error={valErrs["app.support_phone"]} />
        </TwoCol>
      </div>
    </Panel>
  );
}

// ── Tab: Fare Rules ────────────────────────────────────────────────────────────

function validateFare(s) {
  const e = {};
  const checks = [
    ["fare.base_amount",      errNum(s["fare.base_amount"],      0,   undefined, "Base Amount")],
    ["fare.per_km_rate",      errNum(s["fare.per_km_rate"],      0,   undefined, "Per-km Rate")],
    ["fare.student_discount", errNum(s["fare.student_discount"], 0,   1,         "Student Discount")],
    ["fare.senior_discount",  errNum(s["fare.senior_discount"],  0,   1,         "Senior Discount")],
    ["fare.employee_discount",errNum(s["fare.employee_discount"],0,   1,         "Employee Discount")],
    ["fare.school_discount",  errNum(s["fare.school_discount"],  0,   1,         "School Discount")],
  ];
  for (const [k, err] of checks) if (err) e[k] = err;
  return e;
}

function FareTab({ s, set }) {
  const keys = ["fare.base_amount","fare.per_km_rate","fare.student_discount","fare.senior_discount","fare.employee_discount","fare.school_discount"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateFare);
  const f = (k, v) => { set(k, v); clearErr(k); };

  const base  = parseFloat(s["fare.base_amount"]  || 0);
  const perKm = parseFloat(s["fare.per_km_rate"]  || 0);
  const curr  = s["app.currency"] || "USD";
  const KM    = 10;

  const preview = [
    { label: "Standard",  disc: 0 },
    { label: "Student",   disc: parseFloat(s["fare.student_discount"]  || 0) },
    { label: "Senior",    disc: parseFloat(s["fare.senior_discount"]   || 0) },
    { label: "School",    disc: parseFloat(s["fare.school_discount"]   || 0) },
    { label: "Employee",  disc: parseFloat(s["fare.employee_discount"] || 0) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel title="Fare Rules" icon={<Receipt size={14} color="#10B981" />} accent="#10B981"
        extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
        <div style={{ paddingTop: 10 }}>
          <TwoCol>
            <Field label="Base Amount" unit={curr} type="number" min="0" step="0.25"
              description="Flat fare charged for every journey regardless of distance."
              value={s["fare.base_amount"]} onChange={v => f("fare.base_amount", v)} error={valErrs["fare.base_amount"]} />
            <Field label="Per-km Rate" unit={`${curr}/km`} type="number" min="0" step="0.01"
              description="Variable component added on top of the base fare per kilometre."
              value={s["fare.per_km_rate"]} onChange={v => f("fare.per_km_rate", v)} error={valErrs["fare.per_km_rate"]} />
          </TwoCol>
          <Divider label="Discount Ratios — 0 = no discount · 1 = free" />
          <TwoCol>
            <Field label="Student Discount" unit="0 – 1" type="number" min="0" max="1" step="0.05"
              description="Fraction off for verified student accounts (e.g. 0.25 = 25% off)."
              value={s["fare.student_discount"]} onChange={v => f("fare.student_discount", v)} error={valErrs["fare.student_discount"]} />
            <Field label="Senior Discount" unit="0 – 1" type="number" min="0" max="1" step="0.05"
              description="Fraction off for senior citizens."
              value={s["fare.senior_discount"]} onChange={v => f("fare.senior_discount", v)} error={valErrs["fare.senior_discount"]} />
            <Field label="Employee Discount" unit="0 – 1" type="number" min="0" max="1" step="0.05"
              description="Fraction off for company employees."
              value={s["fare.employee_discount"]} onChange={v => f("fare.employee_discount", v)} error={valErrs["fare.employee_discount"]} />
            <Field label="School Child Discount" unit="0 – 1" type="number" min="0" max="1" step="0.05"
              description="Fraction off for school children."
              value={s["fare.school_discount"]} onChange={v => f("fare.school_discount", v)} error={valErrs["fare.school_discount"]} />
          </TwoCol>
        </div>
      </Panel>

      <Panel title={`Live Preview — ${KM} km journey`} accent="#10B981">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, paddingTop: 4 }}>
          {preview.map(({ label, disc }) => {
            const raw   = base + KM * perKm;
            const final = Math.max(0, raw * (1 - disc));
            return (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{curr} {final.toFixed(2)}</div>
                {disc > 0 && <div style={{ fontSize: 10, color: "#10B981", fontWeight: 600, marginTop: 4 }}>{Math.round(disc * 100)}% off</div>}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ── Tab: Wallet ────────────────────────────────────────────────────────────────

function validateWallet(s) {
  const e = {};
  const minTopup  = parseFloat(s["wallet.min_topup"]  || 0);
  const maxTopup  = parseFloat(s["wallet.max_topup"]  || 0);
  const maxBal    = parseFloat(s["wallet.max_balance"] || 0);
  const lowAlert  = parseFloat(s["wallet.low_balance_alert"] || 0);

  const checks = [
    ["wallet.max_balance",       errNum(s["wallet.max_balance"],       0.01, 100000, "Max Balance")],
    ["wallet.min_topup",         errNum(s["wallet.min_topup"],         0.01, undefined, "Min Top-up")],
    ["wallet.max_topup",         errNum(s["wallet.max_topup"],         0.01, undefined, "Max Top-up")],
    ["wallet.low_balance_alert", errNum(s["wallet.low_balance_alert"], 0,    undefined, "Low-Balance Alert")],
  ];
  for (const [k, err] of checks) if (err) e[k] = err;

  if (!e["wallet.min_topup"] && !e["wallet.max_topup"] && minTopup >= maxTopup)
    e["wallet.max_topup"] = "Max Top-up must be greater than Min Top-up";
  if (!e["wallet.low_balance_alert"] && !e["wallet.max_balance"] && lowAlert >= maxBal)
    e["wallet.low_balance_alert"] = "Low-Balance Alert must be less than Max Balance";
  return e;
}

function WalletTab({ s, set }) {
  const keys = ["wallet.max_balance","wallet.min_topup","wallet.max_topup","wallet.low_balance_alert"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateWallet);
  const f = (k, v) => { set(k, v); clearErr(k); };
  const curr = s["app.currency"] || "USD";

  return (
    <Panel title="Wallet Limits" icon={<Wallet size={14} color="#7C3AED" />} accent="#7C3AED"
      extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
      <div style={{ paddingTop: 10 }}>
        <TwoCol>
          <Field label="Max Wallet Balance" unit={curr} type="number" min="0.01" step="10"
            description="A passenger's wallet cannot exceed this balance."
            value={s["wallet.max_balance"]} onChange={v => f("wallet.max_balance", v)} error={valErrs["wallet.max_balance"]} />
          <Field label="Low-Balance Alert" unit={curr} type="number" min="0" step="0.5"
            description="Push notification triggered when balance falls below this threshold."
            value={s["wallet.low_balance_alert"]} onChange={v => f("wallet.low_balance_alert", v)} error={valErrs["wallet.low_balance_alert"]} />
          <Field label="Min Top-Up Amount" unit={curr} type="number" min="0.01" step="1"
            description="Smallest top-up a staff agent may process per transaction."
            value={s["wallet.min_topup"]} onChange={v => f("wallet.min_topup", v)} error={valErrs["wallet.min_topup"]} />
          <Field label="Max Top-Up Amount" unit={curr} type="number" min="0.01" step="10"
            description="Maximum top-up allowed per single transaction."
            value={s["wallet.max_topup"]} onChange={v => f("wallet.max_topup", v)} error={valErrs["wallet.max_topup"]} />
        </TwoCol>
      </div>
    </Panel>
  );
}

// ── Tab: Booking ───────────────────────────────────────────────────────────────

function validateBooking(s) {
  const e = {};
  const seats = errInt(s["booking.max_seats_per_trip"], 1, 20,   "Max Seats");
  const ttl   = errInt(s["booking.qr_ttl_minutes"],    1, 1440,  "QR TTL");
  if (seats) e["booking.max_seats_per_trip"] = seats;
  if (ttl)   e["booking.qr_ttl_minutes"]     = ttl;
  return e;
}

function BookingTab({ s, set }) {
  const keys = ["booking.max_seats_per_trip","booking.qr_ttl_minutes"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateBooking);
  const f = (k, v) => { set(k, v); clearErr(k); };

  return (
    <Panel title="Booking Rules" icon={<BookOpen size={14} color="#F59E0B" />} accent="#F59E0B"
      extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
      <div style={{ paddingTop: 10 }}>
        <TwoCol>
          <Field label="Max Seats Per Booking" type="number" min="1" max="20" step="1"
            description="Maximum tickets a single user may buy per trip (1 – 20)."
            value={s["booking.max_seats_per_trip"]} onChange={v => f("booking.max_seats_per_trip", v)} error={valErrs["booking.max_seats_per_trip"]} />
          <Field label="QR Code TTL" unit="minutes" type="number" min="1" max="1440" step="5"
            description="How long a boarding QR code is valid before it expires (1 – 1440 min)."
            value={s["booking.qr_ttl_minutes"]} onChange={v => f("booking.qr_ttl_minutes", v)} error={valErrs["booking.qr_ttl_minutes"]} />
        </TwoCol>
      </div>
    </Panel>
  );
}

// ── Tab: GPS & Tracking ────────────────────────────────────────────────────────

function validateGps(s) {
  const e = {};
  const interval  = errInt(s["gps.update_interval_sec"], 1,   60,   "Update Interval");
  const stale     = errInt(s["gps.stale_threshold_sec"], 10,  300,  "Stale Threshold");
  const radius    = errInt(s["gps.geofence_radius_m"],   50,  2000, "Geofence Radius");
  if (interval) e["gps.update_interval_sec"] = interval;
  if (stale)    e["gps.stale_threshold_sec"] = stale;
  if (radius)   e["gps.geofence_radius_m"]   = radius;

  // stale must be greater than update interval
  const iv = parseInt(s["gps.update_interval_sec"]);
  const st = parseInt(s["gps.stale_threshold_sec"]);
  if (!e["gps.stale_threshold_sec"] && !e["gps.update_interval_sec"] && st <= iv)
    e["gps.stale_threshold_sec"] = "Stale threshold must be greater than the update interval";
  return e;
}

function GpsTab({ s, set }) {
  const keys = ["gps.update_interval_sec","gps.stale_threshold_sec","gps.geofence_radius_m"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateGps);
  const f = (k, v) => { set(k, v); clearErr(k); };

  return (
    <Panel title="GPS & Tracking" icon={<MapPin size={14} color="#2563EB" />} accent="#2563EB"
      extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
      <div style={{ paddingTop: 10 }}>
        <TwoCol>
          <Field label="Update Interval" unit="seconds" type="number" min="1" max="60" step="1"
            description="How often driver apps send location pings to the server (1 – 60 s)."
            value={s["gps.update_interval_sec"]} onChange={v => f("gps.update_interval_sec", v)} error={valErrs["gps.update_interval_sec"]} />
          <Field label="Stale Threshold" unit="seconds" type="number" min="10" max="300" step="5"
            description="Mark vehicle offline if no update within this window (10 – 300 s)."
            value={s["gps.stale_threshold_sec"]} onChange={v => f("gps.stale_threshold_sec", v)} error={valErrs["gps.stale_threshold_sec"]} />
        </TwoCol>
        <Field label="Geofence Alert Radius" unit="metres" type="number" min="50" max="2000" step="10"
          description="Trigger alert when a vehicle strays beyond this distance from its planned route (50 – 2000 m)."
          value={s["gps.geofence_radius_m"]} onChange={v => f("gps.geofence_radius_m", v)} error={valErrs["gps.geofence_radius_m"]} />
      </div>
    </Panel>
  );
}

// ── Tab: Security ──────────────────────────────────────────────────────────────

function validateSecurity(s) {
  const e = {};
  const checks = [
    ["security.max_login_attempts", errInt(s["security.max_login_attempts"], 1,    20,       "Max Login Attempts")],
    ["security.lockout_minutes",    errInt(s["security.lockout_minutes"],    1,    1440,     "Lockout Duration")],
    ["security.jwt_access_ttl",     errInt(s["security.jwt_access_ttl"],    60,   86400,    "Access Token TTL")],
    ["security.jwt_refresh_ttl",    errInt(s["security.jwt_refresh_ttl"],   3600, 2592000,  "Refresh Token TTL")],
  ];
  for (const [k, err] of checks) if (err) e[k] = err;

  const access  = parseInt(s["security.jwt_access_ttl"]);
  const refresh = parseInt(s["security.jwt_refresh_ttl"]);
  if (!e["security.jwt_access_ttl"] && !e["security.jwt_refresh_ttl"] && access >= refresh)
    e["security.jwt_refresh_ttl"] = "Refresh TTL must be longer than Access TTL";
  return e;
}

function SecurityTab({ s, set }) {
  const keys = ["security.max_login_attempts","security.lockout_minutes","security.jwt_access_ttl","security.jwt_refresh_ttl"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateSecurity);
  const f = (k, v) => { set(k, v); clearErr(k); };

  const accessTTL  = parseInt(s["security.jwt_access_ttl"]  || 900);
  const refreshTTL = parseInt(s["security.jwt_refresh_ttl"] || 604800);

  return (
    <Panel title="Security Policy" icon={<Shield size={14} color="#EF4444" />} accent="#EF4444"
      extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
      <div style={{ paddingTop: 10 }}>
        <TwoCol>
          <Field label="Max Login Attempts" type="number" min="1" max="20" step="1"
            description="Failed logins before the account is temporarily locked (1 – 20)."
            value={s["security.max_login_attempts"]} onChange={v => f("security.max_login_attempts", v)} error={valErrs["security.max_login_attempts"]} />
          <Field label="Lockout Duration" unit="minutes" type="number" min="1" max="1440" step="1"
            description="How long an account stays locked after too many failures (1 – 1440 min)."
            value={s["security.lockout_minutes"]} onChange={v => f("security.lockout_minutes", v)} error={valErrs["security.lockout_minutes"]} />
          <Field label="Access Token TTL" unit="seconds" type="number" min="60" max="86400" step="60"
            description="JWT access token lifetime in seconds (60 – 86400 s)."
            value={s["security.jwt_access_ttl"]} onChange={v => f("security.jwt_access_ttl", v)} error={valErrs["security.jwt_access_ttl"]} />
          <Field label="Refresh Token TTL" unit="seconds" type="number" min="3600" max="2592000" step="3600"
            description="Refresh token lifetime in seconds (3600 – 2592000 s)."
            value={s["security.jwt_refresh_ttl"]} onChange={v => f("security.jwt_refresh_ttl", v)} error={valErrs["security.jwt_refresh_ttl"]} />
        </TwoCol>

        {/* TTL summary */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {[
            { label: "Access Token", val: accessTTL,  color: "#2563EB" },
            { label: "Refresh Token", val: refreshTTL, color: "#7C3AED" },
          ].map(({ label, val, color }) => {
            const d = Math.floor(val / 86400);
            const h = Math.floor((val % 86400) / 3600);
            const m = Math.floor((val % 3600) / 60);
            const parts = [];
            if (d) parts.push(`${d}d`);
            if (h) parts.push(`${h}h`);
            if (m) parts.push(`${m}m`);
            if (!parts.length) parts.push(`${val}s`);
            return (
              <div key={label} style={{ flex: 1, background: "#F8FAFC", border: `1px solid ${color}22`, borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color }}>{parts.join(" ")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ── Tab: Maintenance & Notifications ──────────────────────────────────────────

function validateMaintenance(s) {
  const e = {};
  if (s["maintenance.mode"] === "true") {
    const msg = errRequired(s["maintenance.message"], "Maintenance Message");
    if (msg) e["maintenance.message"] = msg;
  }
  return e;
}

function MaintenanceTab({ s, set }) {
  const keys = ["maintenance.mode","maintenance.message","notifications.push_enabled","notifications.sms_enabled"];
  const { save, saving, saved, saveErr, valErrs, clearErr } = useSectionSave(s, keys, validateMaintenance);
  const f = (k, v) => { set(k, v); clearErr(k); };
  const isOn = s["maintenance.mode"] === "true";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isOn && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 18px", borderRadius: 12,
          background: "#FEF2F2", border: "2px solid #FECACA",
        }}>
          <AlertTriangle size={18} color="#B91C1C" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, color: "#B91C1C", fontSize: 14, marginBottom: 3 }}>
              Maintenance Mode is ACTIVE
            </div>
            <div style={{ fontSize: 12, color: "#DC2626", lineHeight: 1.5 }}>
              All passenger and driver requests are returning 503. Only admin and staff portals can reach the backend.
              Save to turn it off.
            </div>
          </div>
        </div>
      )}

      <Panel title="Maintenance & Notifications" icon={<Wrench size={14} color="#F59E0B" />} accent="#F59E0B"
        extra={<SaveRow onSave={save} saving={saving} saved={saved} saveErr={saveErr} />}>
        <div style={{ paddingTop: 10 }}>
          <Toggle
            label="Enable Maintenance Mode"
            description="Puts the system into maintenance mode — all app users see a 503 message immediately."
            checked={isOn}
            onChange={v => f("maintenance.mode", String(v))}
          />
          <Textarea
            label="Maintenance Message"
            description="Message shown to passengers and drivers while maintenance is active."
            value={s["maintenance.message"]}
            onChange={v => f("maintenance.message", v)}
            placeholder="We are upgrading the system. Back shortly."
          />
          {valErrs["maintenance.message"] && (
            <p style={{ fontSize: 11, color: "#DC2626", marginTop: -10, marginBottom: 14, fontWeight: 500 }}>
              {valErrs["maintenance.message"]}
            </p>
          )}

          <Divider label="Notification Channels" />
          <Toggle
            label="Push Notifications (FCM)"
            description="Enable Firebase push notifications to passenger and driver mobile apps."
            checked={s["notifications.push_enabled"] === "true"}
            onChange={v => f("notifications.push_enabled", String(v))}
          />
          <Toggle
            label="SMS Notifications"
            description="Enable SMS delivery for OTP codes and emergency alerts."
            checked={s["notifications.sms_enabled"] === "true"}
            onChange={v => f("notifications.sms_enabled", String(v))}
          />
        </div>
      </Panel>
    </div>
  );
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "general",     label: "General",     Icon: Globe    },
  { id: "fare",        label: "Fare Rules",  Icon: Receipt  },
  { id: "wallet",      label: "Wallet",      Icon: Wallet   },
  { id: "booking",     label: "Booking",     Icon: BookOpen },
  { id: "gps",         label: "GPS",         Icon: MapPin   },
  { id: "security",    label: "Security",    Icon: Shield   },
  { id: "maintenance", label: "Maintenance", Icon: Wrench   },
];

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const [tab,       setTab]       = useState("general");
  const [s,         setS]         = useState({ ...DEFAULTS });
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadSettings = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    apiClient.get("/settings")
      .then(data => {
        const flat = data?.flat ?? {};
        setS(prev => ({ ...prev, ...flat }));
      })
      .catch(err => setLoadError(err?.message ?? "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const set = useCallback((key, value) => setS(prev => ({ ...prev, [key]: value })), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.4px" }}>
          System Settings
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
          Configure fare rules, wallet limits, booking rules, GPS intervals, security policy and maintenance mode
        </p>
      </div>

      {/* Load error */}
      {loadError && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
        }}>
          <AlertTriangle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600, flex: 1 }}>
            Could not load settings — {loadError}
          </span>
          <button
            onClick={loadSettings}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, color: "#EF4444", background: "#FEE2E2",
              border: "none", borderRadius: 6, padding: "4px 12px",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Tab nav */}
      <div style={{
        display: "flex", gap: 4, background: "#F8FAFC",
        borderRadius: 12, padding: 4, border: "1px solid #E2E8F0",
        flexWrap: "wrap", alignSelf: "flex-start",
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: tab === id ? "#fff" : "transparent",
              color: tab === id ? "#0F172A" : "#64748B",
              fontWeight: tab === id ? 700 : 500, fontSize: 13,
              cursor: "pointer",
              boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
              transition: "all .15s", whiteSpace: "nowrap",
            }}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          Loading settings…
        </div>
      ) : (
        <>
          {tab === "general"     && <GeneralTab     s={s} set={set} />}
          {tab === "fare"        && <FareTab        s={s} set={set} />}
          {tab === "wallet"      && <WalletTab      s={s} set={set} />}
          {tab === "booking"     && <BookingTab     s={s} set={set} />}
          {tab === "gps"         && <GpsTab         s={s} set={set} />}
          {tab === "security"    && <SecurityTab    s={s} set={set} />}
          {tab === "maintenance" && <MaintenanceTab s={s} set={set} />}
        </>
      )}
    </div>
  );
}
