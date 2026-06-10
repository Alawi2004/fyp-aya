import { useState, useEffect, useCallback } from "react";
import apiClient from "../api/apiClient";

// ══════════════════════════════════════════════════════════════════════════════
//  Shared primitives
// ══════════════════════════════════════════════════════════════════════════════

const LABEL  = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };
const DESC   = { fontSize: 11, color: "#94A3B8", marginBottom: 8, lineHeight: 1.5 };
const INPUT  = { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 14, color: "#1E293B", background: "#F8FAFC", outline: "none", boxSizing: "border-box" };

function Field({ label, description, type = "text", value, onChange, unit, min, max, step, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={LABEL}>{label}{unit && <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400, marginLeft: 4 }}>({unit})</span>}</label>
      {description && <p style={DESC}>{description}</p>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...INPUT, border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`, background: focused ? "#fff" : "#F8FAFC", boxShadow: focused ? "0 0 0 3px rgba(37,99,235,.10)" : "none" }}
      />
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
      <div onClick={() => onChange(!checked)} style={{ cursor: "pointer", width: 44, height: 24, borderRadius: 12, background: checked ? "#2563EB" : "#E2E8F0", position: "relative", flexShrink: 0, marginTop: 2, transition: "background .2s" }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{label}</div>
        {description && <p style={{ ...DESC, marginBottom: 0, marginTop: 3 }}>{description}</p>}
      </div>
    </div>
  );
}

function Textarea({ label, description, value, onChange, rows = 3, placeholder }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={LABEL}>{label}</label>
      {description && <p style={DESC}>{description}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ ...INPUT, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
    </div>
  );
}

function SectionCard({ title, children, onSave, saving, saved, error }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,.05)", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 22px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", flex: 1 }}>{title}</span>
        {error && <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{error}</span>}
        <button onClick={onSave} disabled={saving} style={{
          padding: "7px 18px", border: "none", borderRadius: 8,
          background: saved ? "#059669" : saving ? "#93C5FD" : "#2563EB",
          color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
          transition: "background .2s",
        }}>
          {saved ? "Saved" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
      <div style={{ padding: "20px 22px" }}>{children}</div>
    </div>
  );
}

function TwoCol({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>{children}</div>;
}

// ── Default settings (used in FRONTEND_ONLY mode) ─────────────────────────────

// Keys match the actual system_settings DB keys
const DEFAULTS = {
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

const API_KEYS_INFO = [
  { key: "GOOGLE_MAPS_API_KEY",  label: "Google Maps API Key",    env: "GOOGLE_MAPS_API_KEY",  configured: false, note: "Used for map tiles and geocoding" },
  { key: "FIREBASE_SERVER_KEY",  label: "Firebase Server Key",    env: "FIREBASE_SERVER_KEY",  configured: false, note: "Push notifications via FCM" },
  { key: "SMS_API_KEY",          label: "SMS Gateway API Key",    env: "SMS_API_KEY",          configured: false, note: "OTP and alert SMS delivery" },
  { key: "SMTP_USER",            label: "SMTP Email",             env: "SMTP_USER",            configured: true,  note: "Password reset & scheduled reports" },
  { key: "JWT_SECRET",           label: "JWT Secret",             env: "JWT_SECRET",           configured: true,  note: "Token signing — keep this secret" },
];

// ══════════════════════════════════════════════════════════════════════════════
//  Tab components
// ══════════════════════════════════════════════════════════════════════════════

function useSave(s, keys) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState(null);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    const body = {};
    keys.forEach(k => { body[k] = s[k]; });
    try {
      await apiClient.put("/settings", body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }, [s, keys]);

  return { save, saving, saved, error };
}

function FareTab({ s, set }) {
  const keys = ["fare.base_amount","fare.per_km_rate","fare.student_discount","fare.senior_discount","fare.employee_discount","fare.school_discount"];
  const { save, saving, saved, error } = useSave(s, keys);
  return (
    <SectionCard title="Fare Rules" onSave={save} saving={saving} saved={saved} error={error}>
      <TwoCol>
        <Field label="Base Amount" unit="OMR" type="number" min="0" step="0.25" value={s["fare.base_amount"]} onChange={v => set("fare.base_amount", v)} description="Flat fare charged for every journey regardless of distance." />
        <Field label="Per-km Rate" unit="OMR/km" type="number" min="0" step="0.01" value={s["fare.per_km_rate"]} onChange={v => set("fare.per_km_rate", v)} description="Variable component added on top of the base fare." />
        <Field label="Student Discount" unit="ratio 0–1" type="number" min="0" max="1" step="0.05" value={s["fare.student_discount"]} onChange={v => set("fare.student_discount", v)} description="e.g. 0.25 = 25% off for verified student accounts." />
        <Field label="Senior Discount" unit="ratio 0–1" type="number" min="0" max="1" step="0.05" value={s["fare.senior_discount"]} onChange={v => set("fare.senior_discount", v)} description="e.g. 0.30 = 30% off for senior citizens." />
        <Field label="Employee Discount" unit="ratio 0–1" type="number" min="0" max="1" step="0.05" value={s["fare.employee_discount"]} onChange={v => set("fare.employee_discount", v)} description="Discount for company employees." />
        <Field label="School Discount" unit="ratio 0–1" type="number" min="0" max="1" step="0.05" value={s["fare.school_discount"]} onChange={v => set("fare.school_discount", v)} description="e.g. 0.50 = 50% off for school children." />
      </TwoCol>

      {/* Live preview */}
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "14px 18px", marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1D4ED8", marginBottom: 8 }}>Sample Fare Preview — 10 km journey</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Standard",  disc: 0 },
            { label: "Student",   disc: parseFloat(s["fare.student_discount"] || 0) },
            { label: "Senior",    disc: parseFloat(s["fare.senior_discount"]  || 0) },
          ].map(({ label, disc }) => {
            const base  = parseFloat(s["fare.base_amount"] || 0) + 10 * parseFloat(s["fare.per_km_rate"] || 0);
            const final = base * (1 - disc);
            return (
              <div key={label} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #BFDBFE" }}>
                <div style={{ fontSize: 11, color: "#64748B" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1D4ED8" }}>OMR {final.toFixed(2)}</div>
                {disc > 0 && <div style={{ fontSize: 10, color: "#059669" }}>{Math.round(disc*100)}% off</div>}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function WalletTab({ s, set }) {
  const { save, saving, saved, error } = useSave(s, ["wallet.max_balance","wallet.min_topup","wallet.max_topup","wallet.low_balance_alert"]);
  return (
    <SectionCard title="Wallet Limits" onSave={save} saving={saving} saved={saved} error={error}>
      <TwoCol>
        <Field label="Max Wallet Balance" unit="OMR" type="number" min="0" step="10" value={s["wallet.max_balance"]} onChange={v => set("wallet.max_balance", v)} description="A passenger's wallet cannot exceed this balance." />
        <Field label="Low-Balance Alert" unit="OMR" type="number" min="0" step="0.5" value={s["wallet.low_balance_alert"]} onChange={v => set("wallet.low_balance_alert", v)} description="Push notification sent when balance drops below this." />
        <Field label="Min Top-Up Amount" unit="OMR" type="number" min="0" step="1" value={s["wallet.min_topup"]} onChange={v => set("wallet.min_topup", v)} description="Smallest top-up a staff agent may process." />
        <Field label="Max Top-Up Amount" unit="OMR" type="number" min="0" step="10" value={s["wallet.max_topup"]} onChange={v => set("wallet.max_topup", v)} description="Maximum top-up per transaction." />
      </TwoCol>
    </SectionCard>
  );
}

function GpsTab({ s, set }) {
  const { save, saving, saved, error } = useSave(s, ["gps.update_interval_sec","gps.stale_threshold_sec","gps.geofence_radius_m"]);
  return (
    <SectionCard title="GPS & Tracking" onSave={save} saving={saving} saved={saved} error={error}>
      <TwoCol>
        <Field label="Update Interval" unit="seconds" type="number" min="1" max="60" value={s["gps.update_interval_sec"]} onChange={v => set("gps.update_interval_sec", v)} description="How often driver apps send location updates to the server." />
        <Field label="Stale Threshold" unit="seconds" type="number" min="10" max="300" value={s["gps.stale_threshold_sec"]} onChange={v => set("gps.stale_threshold_sec", v)} description="Consider a vehicle offline if no update received within this window." />
      </TwoCol>
      <Field label="Geofence Alert Radius" unit="metres" type="number" min="50" max="2000" value={s["gps.geofence_radius_m"]} onChange={v => set("gps.geofence_radius_m", v)} description="Alert when a vehicle strays further than this from its planned route." />
    </SectionCard>
  );
}

function SecurityTab({ s, set }) {
  const { save, saving, saved, error } = useSave(s, ["security.max_login_attempts","security.lockout_minutes","security.jwt_access_ttl","security.jwt_refresh_ttl"]);
  return (
    <SectionCard title="Security Policy" onSave={save} saving={saving} saved={saved} error={error}>
      <TwoCol>
        <Field label="Max Login Attempts" type="number" min="1" max="20" value={s["security.max_login_attempts"]} onChange={v => set("security.max_login_attempts", v)} description="Failed logins before the account is temporarily locked." />
        <Field label="Lockout Duration" unit="minutes" type="number" min="1" max="120" value={s["security.lockout_minutes"]} onChange={v => set("security.lockout_minutes", v)} description="How long an account stays locked after too many failed attempts." />
        <Field label="Access Token TTL" unit="seconds" type="number" min="60" max="3600" value={s["security.jwt_access_ttl"]} onChange={v => set("security.jwt_access_ttl", v)} description="JWT access tokens expire after this many seconds (default 900 = 15 min)." />
        <Field label="Refresh Token TTL" unit="seconds" type="number" min="3600" max="2592000" value={s["security.jwt_refresh_ttl"]} onChange={v => set("security.jwt_refresh_ttl", v)} description="Refresh tokens expire after this many seconds (default 604800 = 7 days)." />
      </TwoCol>
    </SectionCard>
  );
}

function MaintenanceTab({ s, set }) {
  const { save, saving, saved, error } = useSave(s, ["maintenance.mode","maintenance.message","notifications.push_enabled","notifications.sms_enabled"]);
  const isOn = s["maintenance.mode"] === "true";
  return (
    <>
      {isOn && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <div style={{ fontWeight: 700, color: "#B91C1C", fontSize: 14 }}>Maintenance mode is ACTIVE</div>
            <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>All non-admin users are currently blocked. Only IPs in the allow-list can access the system.</div>
          </div>
        </div>
      )}

      <SectionCard title="Maintenance & Notifications" onSave={save} saving={saving} saved={saved} error={error}>
        <Toggle label="Enable Maintenance Mode" description="Blocks all passenger and driver app access while updates are in progress." checked={isOn} onChange={v => set("maintenance.mode", String(v))} />
        <Textarea label="Maintenance Message" description="Shown to users attempting to access the system during maintenance." value={s["maintenance.message"]} onChange={v => set("maintenance.message", v)} placeholder="We are upgrading the system. Back shortly." />
        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16, marginTop: 4 }}>
          <Toggle label="Push Notifications Enabled" description="Enable push notifications to passenger and driver mobile apps." checked={s["notifications.push_enabled"] === "true"} onChange={v => set("notifications.push_enabled", String(v))} />
          <Toggle label="SMS Notifications Enabled" description="Enable SMS delivery for OTP codes and alerts." checked={s["notifications.sms_enabled"] === "true"} onChange={v => set("notifications.sms_enabled", String(v))} />
        </div>
      </SectionCard>
    </>
  );
}

function ApiKeysTab() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
      <div style={{ padding: "16px 22px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", flex: 1 }}>API Keys & Secrets</span>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>Configured via backend .env — not stored in DB</span>
      </div>
      <div style={{ padding: "20px 22px" }}>
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#92400E" }}>
          API keys are managed via the backend <code style={{ background: "#FEF3C7", padding: "1px 5px", borderRadius: 4 }}>.env</code> file for security. Never expose secret keys in the database or admin UI.
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Key", "Environment Variable", "Status", "Purpose"].map(h => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {API_KEYS_INFO.map((k, i) => (
              <tr key={k.key} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A" }}>{k.label}</td>
                <td style={{ padding: "12px 14px" }}><code style={{ fontSize: 12, background: "#F1F5F9", padding: "2px 7px", borderRadius: 5, color: "#475569" }}>{k.env}</code></td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontWeight: 700, fontSize: 12, padding: "2px 10px", borderRadius: 20, background: k.configured ? "#ECFDF5" : "#FEF2F2", color: k.configured ? "#059669" : "#DC2626", border: `1px solid ${k.configured ? "#A7F3D0" : "#FECACA"}` }}>
                    {k.configured ? "Set" : "Not set"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748B" }}>{k.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 20, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "14px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>How to update API keys</div>
          <ol style={{ paddingLeft: 20, fontSize: 12, color: "#475569", lineHeight: 2, margin: 0 }}>
            <li>Open <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4 }}>backend/.env</code> in your editor</li>
            <li>Add or update the variable (e.g. <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4 }}>GOOGLE_MAPS_API_KEY=your-key-here</code>)</li>
            <li>Restart the backend server to pick up the new value</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SystemSettingsPage
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "fare",        label: "Fare Rules"   },
  { id: "wallet",      label: "Wallet"       },
  { id: "gps",         label: "GPS"          },
  { id: "security",    label: "Security"     },
  { id: "maintenance", label: "Maintenance"  },
];

export default function SystemSettingsPage() {
  const [tab,    setTab]    = useState("fare");
  const [s,      setS]      = useState({ ...DEFAULTS });
  const [loading,setLoading]= useState(true);

  useEffect(() => {
    apiClient.get("/settings")
      .then(data => {
        const flat = data?.flat ?? data ?? {};
        if (Object.keys(flat).length > 0) setS(prev => ({ ...prev, ...flat }));
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback((key, value) => setS(prev => ({ ...prev, [key]: value })), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.4px" }}>System Settings</h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
          Fare rules, wallet limits, GPS intervals, security policy, maintenance mode and API keys
        </p>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 12, padding: 4, border: "1px solid #E2E8F0", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 16px", borderRadius: 9, border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? "#0F172A" : "#64748B",
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer",
            boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
            transition: "all .15s", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Loading settings…</div>
      ) : (
        <>
          {tab === "fare"        && <FareTab        s={s} set={set} />}
          {tab === "wallet"      && <WalletTab      s={s} set={set} />}
          {tab === "gps"         && <GpsTab         s={s} set={set} />}
          {tab === "security"    && <SecurityTab    s={s} set={set} />}
          {tab === "maintenance" && <MaintenanceTab s={s} set={set} />}
        </>
      )}
    </div>
  );
}
