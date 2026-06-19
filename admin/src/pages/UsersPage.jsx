import { useState, useEffect, useCallback } from "react";
import { Users, UserRound, UserCheck, Shield, BadgeCheck } from "lucide-react";
import { PageLoading, PageError, PageEmpty } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { getUsers, createUser, updateUser, deleteUserApi, getPassengerHeatmap, getTopRoutesReport, getDriverSchedules, updateDriverSchedule, getDrivers, getDriverPerformance, adminAdjustWallet, getAuditLogs } from "../api/endpoints";
import { useSettings } from "../context/SettingsContext";
import { fmtMoney } from "../utils/fmt";

const ROLES = ["Passenger", "Driver", "Admin", "Staff"];

const ROLE_STYLE = {
  Admin:     { bg: "#FEF2F2", color: "#B91C1C" },
  Driver:    { bg: "#F5F3FF", color: "#4C1D95" },
  Passenger: { bg: "#F5F3FF", color: "#6D28D9" },
  Staff:     { bg: "#F0FDF4", color: "#059669" },
};


const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_CONFIG = {
  morning:   { label: "Morning",   time: "6:00–14:00",  color: "#6D28D9", bg: "#F5F3FF" },
  afternoon: { label: "Afternoon", time: "14:00–22:00", color: "#D97706", bg: "#FFFBEB" },
  night:     { label: "Night",     time: "22:00–6:00",  color: "#7C3AED", bg: "#F5F3FF" },
  off:       { label: "Day Off",   time: "",             color: "#94A3B8", bg: "#F8FAFC" },
  vacation:  { label: "Vacation",  time: "",             color: "#10B981", bg: "#ECFDF5" },
};


function calcScore(d) {
  const onTime = d.on_time_pct * 0.40;
  const rating = (d.avg_rating / 5) * 100 * 0.35;
  const noComplaints = Math.max(0, 25 - d.complaints * 5);
  return Math.round(onTime + rating + noComplaints);
}

const EMPTY_FORM = { name: "", email: "", password: "", birthDate: "", role: "Passenger", status: "Active" };

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""; }

function normalizeUser(u) {
  return {
    id:            u.user_id ?? u.id,
    name:          u.full_name ?? u.name ?? "",
    email:         u.email ?? "",
    phone:         u.phone ?? null,
    role:          cap(u.role) || "Passenger",
    joined:        u.created_at ? u.created_at.slice(0, 10) : (u.joined ?? ""),
    trips:         u.trips ?? 0,
    status:        cap(u.status) || "Active",
    nationalId:    u.national_id ?? null,
    birthDate:     u.birth_date ?? null,
    photo:         u.photo ?? null,
    walletBalance: u.wallet_balance ?? null,
  };
}

// ── Shared drawer shell ──────────────────────────────────────────────────────
function ProfileDrawer({ onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px);opacity:0 } to { transform:none;opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />
      <div style={{
        width: "min(92vw, 560px)", background: "#fff",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,.14)",
        overflowY: "auto", animation: "slideInRight .25s ease",
      }}>
        {children}
      </div>
    </div>
  );
}

function DrawerHeader({ title, accent, onClose, onEdit, extra, children }) {
  return (
    <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {extra}
          {onEdit && (
            <button onClick={onEdit} style={{ background: accent?.bg ?? "#F5F3FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: accent?.color ?? "#6D28D9", fontSize: 12, fontWeight: 600 }}>
              Edit
            </button>
          )}
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoTile({ label, value, accent }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent ?? "#0F172A" }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>
      {children}
    </div>
  );
}

// ── Wallet Adjust Modal (inline, used in PassengerProfile) ───────────────────
function WalletAdjustModal({ user, onClose }) {
  const { currency } = useSettings();
  const [type,   setType]   = useState("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes,  setNotes]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState(null);
  const [ok,     setOk]     = useState(null);

  const fld = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

  const submit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setErr("Enter a valid positive amount."); return; }
    if (!reason) { setErr("Reason is required."); return; }
    setBusy(true); setErr(null);
    try {
      await adminAdjustWallet({ user_id: user.id, type, amount: parsed, reason, notes: notes || undefined });
      setOk(`${fmtMoney(parsed, currency)} ${type}ed successfully`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Wallet — ${user.name}`} onClose={onClose} onSave={ok ? undefined : submit} saving={busy}>
      {ok ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 32, color: "#059669", marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>{ok}</div>
          <button onClick={onClose} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
        </div>
      ) : (<>
        {user.walletBalance != null && (
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Current balance: <strong style={{ color: "#0F172A" }}>{fmtMoney(user.walletBalance, currency)}</strong></p>
        )}
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {["credit", "debit"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: type === t ? "#fff" : "transparent", color: type === t ? (t === "credit" ? "#059669" : "#DC2626") : "#64748B", fontWeight: type === t ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
              {t === "credit" ? "+ Credit" : "- Debit"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Amount ($) *</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={fld} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Reason *</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Refund for delayed trip" style={fld} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...fld, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginTop: 8, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{err}</div>}
      </>)}
    </Modal>
  );
}

// ── Passenger Profile ────────────────────────────────────────────────────────
function PassengerProfile({ user, onClose, onEdit }) {
  const { currency } = useSettings();
  const [tickets,      setTickets]      = useState(null);
  const [walletOpen,   setWalletOpen]   = useState(false);

  useEffect(() => {
    import("../api/endpoints").then(({ getUserTickets }) =>
      getUserTickets(user.id)
        .then(data => setTickets(Array.isArray(data) ? data : []))
        .catch(() => setTickets([]))
    );
  }, [user.id]);

  const completed  = (tickets || []).filter(t => ["completed","confirmed"].includes(t.status?.toLowerCase())).length;
  const rs         = ROLE_STYLE.Passenger;
  const initials   = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const walletBal  = user.walletBalance != null ? fmtMoney(user.walletBalance, currency) : "—";
  const phone      = user.phone || "—";
  const nationalId = user.nationalId || "IC-" + String(user.id).padStart(6, "0") + "X";

  return (
    <ProfileDrawer onClose={onClose}>
      {walletOpen && <WalletAdjustModal user={user} onClose={() => setWalletOpen(false)} />}
      <DrawerHeader title="Passenger Profile" accent={rs} onClose={onClose} onEdit={onEdit}
        extra={<button onClick={() => setWalletOpen(true)} style={{ background: "#ECFDF5", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#059669", fontSize: 12, fontWeight: 600 }}>Wallet</button>}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: rs.bg, border: `3px solid ${rs.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: rs.color }}>
            {user.photo
              ? <img src={user.photo} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rs.bg, color: rs.color }}>Passenger</span>
              <StatusPill status={user.status} />
            </div>
          </div>
        </div>
      </DrawerHeader>

      {/* Identity & Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Identity &amp; Contact</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoTile label="National ID"     value={nationalId} />
          <InfoTile label="Date of Birth"   value={user.birthDate ?? "—"} />
          <InfoTile label="Wallet Balance"  value={walletBal} accent="#059669" />
          <InfoTile label="Phone"           value={phone} />
          <InfoTile label="Joined"          value={user.joined || "—"} />
          <InfoTile label="Total Trips"     value={tickets === null ? "…" : (user.trips ?? tickets.length)} />
        </div>
      </div>

      {/* Trip History */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SectionLabel>Trip History</SectionLabel>
          {tickets && <span style={{ fontSize: 11, color: "#64748B", marginTop: -14 }}>{completed} completed · {tickets.length - completed} other</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tickets === null ? (
            <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "16px 0" }}>Loading…</div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "16px 0" }}>No trips found</div>
          ) : tickets.slice(0, 10).map((t, i) => {
            const statusLow = t.status?.toLowerCase() ?? "";
            const isOk = ["completed", "confirmed"].includes(statusLow);
            return (
              <div key={t.ticket_id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.route_name ?? (t.trip_id ? `Trip #${t.trip_id}` : `Ticket #${t.ticket_id}`)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString("en-GB") : "—"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {t.fare != null && <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{fmtMoney(t.fare, currency)}</div>}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: isOk ? "#F0FDF4" : "#FEF2F2", color: isOk ? "#059669" : "#DC2626" }}>
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProfileDrawer>
  );
}

// ── Driver Profile (from Users list) ────────────────────────────────────────
function DriverUserProfile({ user, onClose, onEdit }) {
  const rs      = ROLE_STYLE.Driver;
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const [schedule,    setSchedule]    = useState(null);
  const [driverInfo,  setDriverInfo]  = useState(null);   // { license_number, driver_id, … }
  const [perf,        setPerf]        = useState(null);   // { trips_week, on_time_pct, … }
  const [editDay,     setEditDay]     = useState(null);
  const [pickedShift, setPickedShift] = useState("off");
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError,  setSchedError]  = useState(null);

  useEffect(() => {
    const uid = Number(user.id);
    Promise.all([
      getDriverSchedules().catch(() => []),
      getDrivers().catch(() => ({ data: [] })),
      getDriverPerformance().catch(() => []),
    ]).then(([schedList, driversResp, perfList]) => {
      const drivers = driversResp?.data ?? driversResp ?? [];
      // Use Number() on both sides — DB can return int while JS prop may be string
      const sched   = (schedList || []).find(s => Number(s.user_id) === uid);
      const info    = (drivers    || []).find(d => Number(d.user_id) === uid);
      const p       = (perfList   || []).find(d => Number(d.user_id) === uid);
      if (sched) setSchedule(sched);
      if (info)  setDriverInfo(info);
      if (p)     setPerf(p);
    });
  }, [user.id]);

  function openDayPicker(day) {
    setPickedShift(schedule?.[day.toLowerCase()] || "off");
    setEditDay(day);
    setSchedError(null);
  }

  async function saveDayShift() {
    if (!editDay) return;
    const driverId = schedule?.driver_id ?? driverInfo?.driver_id;
    if (!driverId) {
      setSchedError("No driver record found for this user. Add them through the Drivers page first.");
      return;
    }
    setSchedSaving(true);
    setSchedError(null);
    const base    = schedule ?? {};
    const dayKey  = editDay.toLowerCase();
    const updated = { ...base, [dayKey]: pickedShift };
    const payload = Object.fromEntries(
      DAYS.map(d => [d, updated[d.toLowerCase()] || "off"])
    );
    try {
      await updateDriverSchedule(driverId, payload);
      setSchedule({ ...updated, driver_id: driverId, user_id: user.id });
      setEditDay(null);
    } catch (err) {
      setSchedError(err?.message ?? "Failed to save");
    } finally {
      setSchedSaving(false);
    }
  }

  const perfData    = perf ?? { trips_week: 0, on_time_pct: 0, complaints: 0, avg_rating: null, idle_hours: 0 };
  const recentTrips = [];
  const ratings     = [];
  const score       = calcScore(perfData);
  const scoreColor  = score >= 85 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <ProfileDrawer onClose={onClose}>
      <DrawerHeader title="Driver Profile" accent={rs} onClose={onClose} onEdit={onEdit}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: rs.bg, border: `3px solid ${rs.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: rs.color }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rs.bg, color: rs.color }}>Driver</span>
              <StatusPill status={user.status} />
              {perfData.avg_rating && <span style={{ color: "#f9a825", fontWeight: 700, fontSize: 12 }}>★ {perfData.avg_rating}</span>}
            </div>
          </div>
        </div>
      </DrawerHeader>

      {/* Identity & Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Identity &amp; Contact</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoTile label="License No."  value={driverInfo?.license_number ?? "—"} />
          <InfoTile label="Phone"        value={user.phone ?? "—"} />
          <InfoTile label="Status"       value={user.status} />
          <InfoTile label="Trips Today"  value={perfData.trips_week ?? 0} />
          <InfoTile label="Perf. Score"  value={`${score} / 100`} accent={scoreColor} />
          <InfoTile label="Avg Rating"   value={perfData.avg_rating ? `★ ${perfData.avg_rating}` : "—"} />
        </div>
      </div>

      {/* Performance */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>This Week&apos;s Performance</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Trips",      value: perfData.trips_week,        color: "#6D28D9" },
            { label: "On-Time",    value: `${perfData.on_time_pct ?? 0}%`, color: (perfData.on_time_pct ?? 0) >= 90 ? "#10B981" : (perfData.on_time_pct ?? 0) >= 75 ? "#F59E0B" : "#EF4444" },
            { label: "Complaints", value: perfData.complaints,         color: perfData.complaints === 0 ? "#10B981" : "#EF4444" },
            { label: "Idle",       value: `${perfData.idle_hours}h`,  color: perfData.idle_hours > 4 ? "#EF4444" : "#64748B" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 8px", textAlign: "center", border: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>Performance Score</span>
          <span style={{ fontWeight: 700, color: scoreColor }}>{score} / 100</span>
        </div>
        <div style={{ height: 8, background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${score}%`, height: "100%", background: scoreColor, borderRadius: 4, transition: "width .6s ease" }} />
        </div>
      </div>

      {/* Weekly Schedule — editable */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SectionLabel>This Week&apos;s Schedule</SectionLabel>
          {(schedule || driverInfo) && <span style={{ fontSize: 10, color: "#94A3B8" }}>Click a day to change</span>}
        </div>

        {/* No driver record yet — user has role=Driver but no drivers table row */}
        {!schedule && !driverInfo ? (
          <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#92400E" }}>
            No driver record found for this user. Add them through the <strong>Drivers page</strong> to assign a schedule.
          </div>
        ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DAYS.map(day => {
            const key   = day.toLowerCase();
            const shift = schedule?.[key] || "off";
            const cfg   = SHIFT_CONFIG[shift] || SHIFT_CONFIG.off;
            return (
              <div key={day} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>{day}</div>
                <button
                  onClick={() => openDayPicker(day)}
                  style={{
                    padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                    background: cfg.bg, border: `1px solid ${cfg.color}44`,
                    fontSize: 10, fontWeight: 700, color: cfg.color, whiteSpace: "nowrap",
                    transition: "filter .15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.93)"}
                  onMouseLeave={e => e.currentTarget.style.filter = "none"}
                >
                  {cfg.label}
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Ratings */}
      {ratings.length > 0 && (
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <SectionLabel>Passenger Ratings</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ratings.slice(0, 4).map((r, i) => (
              <div key={i} style={{ background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{r.passenger}</span>
                  <span style={{ color: "#f9a825", fontSize: 12, fontWeight: 700 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic" }}>"{r.comment}"</div>}
                <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 4 }}>{r.route} · {r.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trips */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <SectionLabel>Recent Trips Driven</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentTrips.length === 0
            ? <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "16px 0" }}>No recent trips found</div>
            : recentTrips.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.date} · {t.time} · {t.vehicle}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                  background: t.status === "Completed" ? "#F0FDF4" : t.status === "Ongoing" ? "#F5F3FF" : t.status === "Delayed" ? "#FFFBEB" : "#F3F4F6",
                  color:      t.status === "Completed" ? "#059669" : t.status === "Ongoing" ? "#6D28D9" : t.status === "Delayed" ? "#D97706" : "#94A3B8",
                }}>
                  {t.status}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Day shift picker modal */}
      {editDay && (
        <Modal
          title={`${user.name} — ${editDay}`}
          onClose={() => { setEditDay(null); setSchedError(null); }}
          onSave={saveDayShift}
          saving={schedSaving}
        >
          {schedError && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
              {schedError}
            </div>
          )}
          <p style={{ fontSize: 13, color: "#475569", marginBottom: 14, marginTop: 0 }}>
            Select shift for <strong>{editDay}</strong>:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
              <label
                key={key}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${pickedShift === key ? cfg.color : "#E2E8F0"}`,
                  background: pickedShift === key ? cfg.bg : "#fff",
                  transition: "all .15s",
                }}
              >
                <input
                  type="radio" name="userDriverShift" value={key}
                  checked={pickedShift === key}
                  onChange={() => setPickedShift(key)}
                  style={{ accentColor: cfg.color }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                  {cfg.time && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{cfg.time}</div>}
                </div>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </ProfileDrawer>
  );
}

// ── Admin Profile ────────────────────────────────────────────────────────────
const ADMIN_MODULES = [
  "Dashboard", "Live Tracking", "Users", "Drivers", "Vehicles",
  "Routes", "Trips", "Analytics", "Tickets", "Notifications",
  "Ratings", "Wallet", "Roles & Permissions",
];

function AdminProfile({ user, onClose, onEdit }) {
  const rs       = ROLE_STYLE.Admin;
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    getAuditLogs({ user_id: user.id, limit: 5 })
      .then(d => {
        const rows = d?.data ?? (Array.isArray(d) ? d : []);
        setActivity(rows.map(r => ({
          action: r.action ?? r.description ?? "Action performed",
          date:   r.created_at ? r.created_at.slice(0, 10) : "—",
          time:   r.created_at ? new Date(r.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
        })));
      })
      .catch(() => {});
  }, [user.id]);

  return (
    <ProfileDrawer onClose={onClose}>
      <DrawerHeader title="Admin Profile" accent={rs} onClose={onClose} onEdit={onEdit}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#6D28D9,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", boxShadow: "0 4px 14px rgba(109,40,217,.30)" }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rs.bg, color: rs.color }}>Administrator</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#FFF7ED", color: "#C2410C" }}>Full Access</span>
              <StatusPill status={user.status} />
            </div>
          </div>
        </div>
      </DrawerHeader>

      {/* Account Details */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Account Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoTile label="Email"        value={user.email} />
          <InfoTile label="Joined"       value={user.joined || "—"} />
          <InfoTile label="Access Level" value="Full System Access" accent="#B91C1C" />
          <InfoTile label="Last Active"  value="Today" accent="#059669" />
          <InfoTile label="Status"       value={user.status} />
          <InfoTile label="Role"         value="System Administrator" />
        </div>
      </div>

      {/* System Permissions */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>System Access — All Modules</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ADMIN_MODULES.map(mod => (
            <div key={mod} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "5px 10px" }}>
              <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓</span>
              <span style={{ fontSize: 11, color: "#065F46", fontWeight: 600 }}>{mod}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 2 }}>Permissions: View · Create · Edit · Delete</div>
          <div style={{ fontSize: 11, color: "#92400E" }}>All RBAC modules — no restrictions applied to this account</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <SectionLabel>Recent Activity</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activity.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6D28D9", marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{a.action}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{a.date} at {a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProfileDrawer>
  );
}

// ── Staff Profile ────────────────────────────────────────────────────────────
const FLAG_CONFIG = {
  rapid_sequence: { label: "Rapid Sequence", color: "#D97706", bg: "#FFFBEB" },
  repeat_user:    { label: "Repeat Top-Up",  color: "#7C3AED", bg: "#F5F3FF" },
  large_amount:   { label: "Large Amount",   color: "#DC2626", bg: "#FEF2F2" },
  velocity_spike: { label: "Velocity Spike", color: "#9D174D", bg: "#FFF1F2" },
};

function StaffUserProfile({ user, onClose, onEdit }) {
  const { currency } = useSettings();
  const rs       = ROLE_STYLE.Staff;
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const staffRec  = {};
  const staffTxns = [];
  const suspicious = staffTxns.filter(t => t.flags.length > 0);

  return (
    <ProfileDrawer onClose={onClose}>
      <DrawerHeader title="Staff Profile" accent={rs} onClose={onClose} onEdit={onEdit}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#0EA5E9,#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 14px rgba(14,165,233,.30)",
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rs.bg, color: rs.color }}>Staff</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#F0F9FF", color: "#0369A1" }}>Top-Up Agent</span>
              <StatusPill status={user.status} />
            </div>
          </div>
        </div>
      </DrawerHeader>

      {/* Account Details */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Account Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoTile label="Station"        value={staffRec.location ?? "—"} />
          <InfoTile label="Joined"         value={user.joined || "—"} />
          <InfoTile label="Daily Limit"    value={staffRec.daily_limit ? fmtMoney(staffRec.daily_limit, currency) : "—"} />
          <InfoTile label="Per-TX Limit"   value={staffRec.tx_limit   ? fmtMoney(staffRec.tx_limit, currency)         : "—"} />
          <InfoTile label="Status"         value={user.status} />
          <InfoTile label="Flagged Txns"   value={suspicious.length} accent={suspicious.length > 0 ? "#DC2626" : "#059669"} />
        </div>
      </div>

      {/* Today's stats */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Today&apos;s Activity</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Top-Ups",     value: staffRec.today_count ?? 0,   color: "#6D28D9" },
            { label: "Volume",      value: fmtMoney(staffRec.today_total || 0, currency), color: "#059669" },
            { label: "Suspicious",  value: suspicious.length,            color: suspicious.length > 0 ? "#DC2626" : "#10B981" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 10px", textAlign: "center", border: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Access */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>System Access</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { module: "Wallet Top-Up", access: "Full — search, process, confirm" },
            { module: "Top-Up History", access: "Own transactions only" },
            { module: "Admin Dashboard", access: "No access" },
            { module: "User/Driver Data", access: "No access" },
          ].map(({ module, access }) => {
            const noAccess = access.startsWith("No");
            return (
              <div key={module} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 8, padding: "9px 14px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{module}</span>
                <span style={{ fontSize: 11, color: noAccess ? "#94A3B8" : "#059669", fontWeight: 600 }}>
                  {noAccess ? "✗ " : "✓ "}{access}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <SectionLabel>Recent Top-Ups</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {staffTxns.length === 0
            ? <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "16px 0" }}>No transactions recorded</div>
            : staffTxns.slice(0, 8).map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: t.flags.length > 0 ? "#FFFBFB" : "#F8FAFC",
                border: `1px solid ${t.flags.length > 0 ? "#FECACA" : "#F1F5F9"}`,
                borderRadius: 10, padding: "10px 14px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.passenger}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.location} · {new Date(t.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", marginBottom: 3 }}>{fmtMoney(t.amount, currency)}</div>
                  {t.flags.length > 0
                    ? <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#FEF2F2", color: "#DC2626" }}>⚠ {t.flags.length} flag{t.flags.length > 1 ? "s" : ""}</span>
                    : <span style={{ fontSize: 9, color: "#10B981", fontWeight: 600 }}>✓ Normal</span>
                  }
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </ProfileDrawer>
  );
}

// ── Role-dispatched profile ──────────────────────────────────────────────────
function UserProfile({ user, onClose, onEdit }) {
  if (user.role === "Admin")     return <AdminProfile      user={user} onClose={onClose} onEdit={onEdit} />;
  if (user.role === "Driver")    return <DriverUserProfile  user={user} onClose={onClose} onEdit={onEdit} />;
  if (user.role === "Staff")     return <StaffUserProfile   user={user} onClose={onClose} onEdit={onEdit} />;
  return                                <PassengerProfile   user={user} onClose={onClose} onEdit={onEdit} />;
}

// ── Export helpers ────────────────────────────────────────────────────────────
function exportCSV(rows, label) {
  const headers = ["Name", "Email", "Role", "Date of Birth", "National ID", "Joined", "Trips", "Status"];
  const body = rows.map(u => [
    u.name, u.email, u.role, u.birthDate ?? "—",
    u.nationalId ?? ("IC-" + String(u.id).padStart(6, "0") + "X"),
    u.joined, u.trips, u.status,
  ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const csv  = [headers.map(h => `"${h}"`).join(","), ...body].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${label.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(rows, label) {
  const tr = rows.map(u => `<tr>
    <td>${u.name}</td><td>${u.email}</td><td>${u.role}</td>
    <td>${u.birthDate ?? "—"}</td><td>${u.joined}</td>
    <td>${u.trips}</td><td>${u.status}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><title>${label}</title><style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}
    h2{font-size:16px;margin:0 0 4px}p{color:#64748b;font-size:11px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse}
    th{background:#6D28D9;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:700}
    td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}
    tr:nth-child(even) td{background:#f8fafc}
    @media print{@page{margin:15mm}button{display:none}}
  </style></head><body>
    <h2>${label} — Yalla Transit Admin</h2>
    <p>Exported ${new Date().toLocaleString()} · ${rows.length} records</p>
    <table><thead><tr>
      <th>Name</th><th>Email</th><th>Role</th><th>Date of Birth</th>
      <th>Joined</th><th>Trips</th><th>Status</th>
    </tr></thead><tbody>${tr}</tbody></table>
    <p style="margin-top:18px;color:#94a3b8;font-size:10px">Yalla Transit · Confidential</p>
  </body></html>`;
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Export dropdown button ────────────────────────────────────────────────────
function ExportMenu({ users, roleFilter }) {
  const [open, setOpen] = useState(false);
  const rows  = roleFilter !== "All" ? users.filter(u => u.role === roleFilter) : users;
  const label = roleFilter !== "All" ? `${roleFilter} List` : "User List";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
          background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        Export <span style={{ fontSize: 10, color: "#94A3B8" }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
            background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0",
            boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 180, overflow: "hidden",
          }}>
            <div style={{ padding: "6px 0" }}>
              {[
                { icon: "📋", label: "CSV (.csv)", fn: () => { exportCSV(rows, label); setOpen(false); } },
                { icon: "📄", label: "PDF (print)", fn: () => { exportPDF(rows, label); setOpen(false); } },
              ].map(({ icon, label: lbl, fn }) => (
                <button key={lbl} onClick={fn} style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 16px", border: "none", background: "none",
                  fontSize: 13, color: "#374151", cursor: "pointer", textAlign: "left",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span>{icon}</span>{lbl}
                </button>
              ))}
            </div>
            <div style={{ padding: "6px 16px 10px", borderTop: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>{rows.length} records will be exported</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Passenger Activity tab ────────────────────────────────────────────────────
function ActivityTab({ users }) {
  const [daily,        setDaily]        = useState([]);
  const [peakHours,    setPeakHours]    = useState([]);
  const [topRoutes,    setTopRoutes]    = useState([]);
  const [total,        setTotal]        = useState(null); // null = loading
  const [loadErr,      setLoadErr]      = useState(false);

  useEffect(() => {
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

    Promise.allSettled([
      getPassengerHeatmap(from, to),
      getTopRoutesReport(from, to),
    ]).then(([heatmapRes, routesRes]) => {
      if (heatmapRes.status === "fulfilled") {
        const d = heatmapRes.value;
        setDaily(Array.isArray(d?.daily) ? d.daily : []);
        setPeakHours(Array.isArray(d?.peak_hours) ? d.peak_hours : []);
        setTotal(d?.total ?? 0);
      } else {
        setLoadErr(true);
        setTotal(0);
      }
      if (routesRes.status === "fulfilled") {
        const rows = routesRes.value?.data ?? routesRes.value ?? [];
        setTopRoutes(Array.isArray(rows) ? rows : []);
      }
    });
  }, []);

  const passengers = users.filter(u => u.role === "Passenger");
  const loading     = total === null;

  const maxDaily  = Math.max(...daily.map(d => d.count), 1);
  const maxPeak   = Math.max(...peakHours.map(h => h.count), 1);
  const top3Hours = [...peakHours].sort((a, b) => b.count - a.count).slice(0, 3).map(h => h.hour);
  const maxRoute  = Math.max(...topRoutes.map(r => r.passengers ?? 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Passenger summary */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{passengers.length} total passengers</span>
      </div>

      {/* Daily booking activity */}
      <Panel title={`Booking Activity — Last 30 Days${!loading ? ` · ${total.toLocaleString()} bookings` : ""}`}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", color: "#94A3B8" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #E2E8F0", borderTopColor: "#6D28D9", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading booking data…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : loadErr ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            Could not reach the analytics endpoint. Check the backend connection.
          </div>
        ) : daily.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            No bookings recorded in the last 30 days.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140, overflowX: "auto", paddingTop: 6 }}>
            {daily.map(d => {
              const pct  = Math.round((d.count / maxDaily) * 100);
              const date = new Date(d.date);
              return (
                <div key={d.date} title={`${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${d.count} booking${d.count !== 1 ? "s" : ""}`}
                  style={{ flex: 1, minWidth: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{
                    width: "100%", maxWidth: 18, height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%`,
                    background: d.count > 0 ? "#6D28D9" : "#F1F5F9", borderRadius: 3,
                    transition: "height .3s ease",
                  }} />
                </div>
              );
            })}
          </div>
        )}
        {!loading && !loadErr && daily.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#94A3B8" }}>
            <span>{new Date(daily[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            <span>{new Date(daily[daily.length - 1].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </div>
        )}
      </Panel>

      {/* Peak hours + Route popularity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Peak hours bar chart */}
        <Panel title="Peak Hours">
          {peakHours.length === 0 || total === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No bookings yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...peakHours].sort((a, b) => a.hour - b.hour).map(h => {
                const isTop = top3Hours.includes(h.hour);
                const pct   = Math.round((h.count / maxPeak) * 100);
                return (
                  <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: isTop ? 700 : 400, color: isTop ? "#0F172A" : "#64748B", width: 36, flexShrink: 0, textAlign: "right" }}>
                      {`${h.hour}:00`}
                    </span>
                    <div style={{ flex: 1, height: 18, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%", borderRadius: 4,
                        background: isTop ? "#6D28D9" : "#DDD6FE",
                        transition: "width .4s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: isTop ? 700 : 400, color: isTop ? "#0F172A" : "#94A3B8", width: 38, flexShrink: 0 }}>
                      {h.count}
                      {isTop && h.count > 0 && <span style={{ fontSize: 9, color: "#6D28D9", marginLeft: 2 }}>▲</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Route popularity — real top-routes data by passenger count */}
        <Panel title="Route Popularity">
          {topRoutes.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No route activity in the last 30 days.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {topRoutes.slice(0, 6).map(route => (
                <div key={route.route}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{route.name ?? route.route}</span>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{route.passengers} passenger{route.passengers !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ height: 12, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((route.passengers / maxRoute) * 100)}%`, height: "100%", borderRadius: 6, background: "#6D28D9" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Tab nav (shared pattern) ──────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 20px", borderRadius: 7, border: "none",
          fontSize: 13, fontWeight: active === id ? 700 : 500, cursor: "pointer",
          background: active === id ? "#fff" : "transparent",
          color:      active === id ? "#6D28D9" : "#64748B",
          boxShadow:  active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          transition: "all .15s",
        }}>{label}</button>
      ))}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function UsersPage() {
  const [tab,          setTab]          = useState("users");
  const [users,        setUsers]        = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError,   setUsersError]   = useState(null);
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    getUsers()
      .then(data => {
        const rows = data?.data ?? data;
        setUsers((rows || []).map(normalizeUser));
      })
      .catch(err => {
        setUsers([]);
        setUsersError(err?.message ?? "Could not reach server");
      })
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        && (roleFilter === "All" || u.role === roleFilter);
  });

  const [saveError,   setSaveError]   = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(u) {
    setEditTarget(u.id);
    setForm({
      name:      u.name,
      email:     u.email,
      phone:     u.phone ?? "",
      birthDate: u.birthDate ?? "",
      role:      u.role,
      status:    u.status,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!form.name || !form.email) return;
    if (!editTarget && !form.password) { setSaveError("Password is required."); return; }
    if (form.birthDate && form.birthDate > today) { setSaveError("Date of birth cannot be in the future."); return; }
    setSaveError(null);
    setIsSaving(true);
    try {
      if (editTarget) {
        await updateUser(editTarget, {
          full_name:  form.name,
          phone:      form.phone || null,
          role:       form.role,
          status:     form.status,
          birth_date: form.birthDate || null,
        });
      } else {
        await createUser({
          full_name:  form.name,
          email:      form.email,
          password:   form.password,
          role:       form.role,
          birth_date: form.birthDate || null,
        });
        setSearch("");
        setRoleFilter("All");
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      setSaveError(err?.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteUserApi(deleteTarget.id);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setDeleteError(err?.message ?? "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  const counts = {
    all:        users.length,
    passengers: users.filter(u => u.role === "Passenger").length,
    drivers:    users.filter(u => u.role === "Driver").length,
    admins:     users.filter(u => u.role === "Admin").length,
    staff:      users.filter(u => u.role === "Staff").length,
  };

  const columns = [
    {
      key: "name", label: "User",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: ROLE_STYLE[row.role]?.bg ?? "#F5F3FF", color: ROLE_STYLE[row.role]?.color ?? "#6D28D9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {v.split(" ").map(w => w[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role", label: "Role",
      render: v => {
        const s = ROLE_STYLE[v] || {};
        return <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20 }}>{v}</span>;
      },
    },
    {
      key: "birthDate", label: "Date of Birth",
      render: v => <span style={{ fontSize: 12, color: "#334155" }}>{v ?? "—"}</span>,
    },
    {
      key: "nationalId", label: "National ID",
      render: (v, row) => (
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#334155" }}>
          {v ?? "IC-" + String(row.id).padStart(6, "0") + "X"}
        </span>
      ),
    },
    { key: "joined", label: "Joined" },
    { key: "trips",  label: "Trips" },
    { key: "status", label: "Status", render: v => <StatusPill status={v} /> },
    {
      key: "id", label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); setProfile(row); }} style={{ fontSize: 11, color: "#7C3AED", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Profile</button>
          <button onClick={e => { e.stopPropagation(); openEdit(row); }} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(row); setDeleteError(null); }} style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Delete</button>
        </div>
      ),
    },
  ];

  const fldLbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
  const fldInp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Users</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Manage all registered users · click any row or Profile to view full profile</p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", visibility: tab === "users" ? "visible" : "hidden", pointerEvents: tab === "users" ? "auto" : "none" }}>
          <ExportMenu users={users} roleFilter={roleFilter} />
          <button onClick={openAdd} style={{ background: "#6D28D9", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add user
          </button>
        </div>
        <TabNav
          tabs={[{ id: "users", label: "Users" }, { id: "activity", label: "Passenger Activity" }]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* KPI cards — always visible */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total users"  value={counts.all}        delta="registered"    accent="#6D28D9" icon={<Users size={18} color="#6D28D9" />} />
        <StatCard label="Passengers"   value={counts.passengers} delta="active"         accent="#7C3AED" icon={<UserRound size={18} color="#7C3AED" />} />
        <StatCard label="Drivers"      value={counts.drivers}    delta="on platform"    accent="#0EA5E9" icon={<UserCheck size={18} color="#0EA5E9" />} />
        <StatCard label="Admins"       value={counts.admins}     delta="system users"   accent="#EF4444" icon={<Shield size={18} color="#EF4444" />} />
        <StatCard label="Staff"        value={counts.staff}      delta="top-up agents"  accent="#059669" icon={<BadgeCheck size={18} color="#059669" />} />
      </div>

      {/* Passenger Activity tab */}
      {tab === "activity" && <ActivityTab users={users} />}

      {/* Users list tab */}
      {tab === "users" && usersLoading && <PageLoading message="Loading users…" />}
      {tab === "users" && usersError   && <PageError message={usersError} onRetry={loadUsers} />}
      {tab === "users" && !usersLoading && (<>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 260 }}
        />
        {["All", ...ROLES].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: roleFilter === r ? "none" : "1px solid #E2E8F0",
            background: roleFilter === r ? "#6D28D9" : "#fff",
            color: roleFilter === r ? "#fff" : "#555",
            fontWeight: roleFilter === r ? 600 : 400,
          }}>{r}</button>
        ))}
      </div>

      <Panel title={`${filtered.length} users`}>
        <DataTable columns={columns} rows={filtered} onRowClick={u => setProfile(u)} />
      </Panel>

      </>)}

      {/* Edit / Add modal */}
      {modalOpen && (
        <Modal title={editTarget ? "Edit user" : "Add new user"} onClose={() => { setModalOpen(false); setIsSaving(false); }} onSave={handleSave} saving={isSaving}>
          {saveError && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
              {saveError}
            </div>
          )}
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>Full name *</label>
            <input type="text" placeholder="e.g. Ali Hassan" value={form.name ?? ""}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={fldInp} />
          </div>
          {/* Email — read-only when editing */}
          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>Email *</label>
            <input type="email" placeholder="user@mail.com" value={form.email ?? ""}
              disabled={!!editTarget}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={{ ...fldInp, background: editTarget ? "#F8FAFC" : "#fff" }} />
          </div>
          {/* Password — only shown when adding */}
          {!editTarget && (
            <div style={{ marginBottom: 14 }}>
              <label style={fldLbl}>Password *</label>
              <input type="password" placeholder="Min 8 chars, 1 upper, 1 digit, 1 symbol"
                value={form.password ?? ""}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={fldInp} />
            </div>
          )}
          {/* Birthday — optional */}
          <div style={{ marginBottom: 14 }}>
            <label style={fldLbl}>Date of Birth <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
            <input type="date" value={form.birthDate ?? ""} max={today}
              onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))}
              style={fldInp} />
          </div>
          {/* Role + Status */}
          {[
            { label: "Role",   key: "role",   options: ROLES },
            { label: "Status", key: "status", options: ["Active", "Inactive"] },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={fldLbl}>{f.label}</label>
              <select value={form[f.key] ?? f.options[0]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ ...fldInp, cursor: "pointer" }}>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal title="Delete user" onClose={() => { setDeleteTarget(null); setDeleteError(null); setIsDeleting(false); }}>
          {deleteError && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
              {deleteError}
            </div>
          )}
          <p style={{ fontSize: 14, color: "#333", marginBottom: 8 }}>
            Permanently delete <strong>{deleteTarget.name}</strong>?
          </p>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>
            {deleteTarget.email} · {deleteTarget.role} — this cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              disabled={isDeleting}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Role-specific profile drawer */}
      {profile && (
        <UserProfile
          user={profile}
          onClose={() => setProfile(null)}
          onEdit={() => { setProfile(null); openEdit(profile); }}
        />
      )}
    </div>
  );
}

