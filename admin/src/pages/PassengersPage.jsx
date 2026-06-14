import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../api/apiClient";
import { createUser, updateUser, deleteUserApi } from "../api/endpoints";
import { Modal } from "../components/Modal";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";

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
function relDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatTripDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} ${time}`;
}


// shared button style matching all other admin pages
const actionBtn = (color, bg) => ({
  fontSize: 11, color, background: bg, border: "none",
  borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 500,
});

// ── Passenger Profile Drawer ──────────────────────────────────────────────────

const TRIP_STATUS_STYLE = {
  completed:  { bg: "#F0FDF4", color: "#059669", label: "Completed"  },
  upcoming:   { bg: "#EFF6FF", color: "#2563EB", label: "Upcoming"   },
  cancelled:  { bg: "#FEF2F2", color: "#DC2626", label: "Cancelled"  },
  confirmed:  { bg: "#EFF6FF", color: "#2563EB", label: "Confirmed"  },
  ongoing:    { bg: "#FFF7ED", color: "#EA580C", label: "Ongoing"    },
  scheduled:  { bg: "#EFF6FF", color: "#2563EB", label: "Scheduled"  },
  boarded:    { bg: "#F0FDF4", color: "#059669", label: "Boarded"    },
};

function TripDetailPanel({ trip, passenger, onBack }) {
  const tripSt     = TRIP_STATUS_STYLE[trip.trip_status?.toLowerCase()]      || TRIP_STATUS_STYLE.upcoming;
  const bookingSt  = TRIP_STATUS_STYLE[trip.ui_status ?? trip.trip_status?.toLowerCase()] || TRIP_STATUS_STYLE.upcoming;

  const routeLabel = trip.route_name
    || (trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : "—");

  const vehicleLabel = [
    trip.plate        || null,
    trip.vehicle_name || null,
    trip.vehicle_type ? `(${trip.vehicle_type.charAt(0).toUpperCase() + trip.vehicle_type.slice(1)})` : null,
  ].filter(Boolean).join(" · ") || "—";

  const fareLabel = trip.fare != null
    ? `$${fmt(trip.fare)}` + (trip.seat_count > 1 ? ` × ${trip.seat_count} seats` : "")
    : "—";

  const bookedAt = trip.booking_time
    ? formatTripDate(trip.booking_time)
    : trip.created_at ? formatTripDate(trip.created_at) : "—";

  const SectionLabel = ({ text }) => (
    <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".1em", padding: "18px 0 6px" }}>
      {text}
    </div>
  );

  const Row = ({ label, value, accent, last }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: last ? "none" : "1px solid #F1F5F9", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, flexShrink: 0, minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent ?? "#0F172A", textAlign: "right", wordBreak: "break-word" }}>
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "#FAFBFF" }}>
        <button onClick={onBack} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#475569", fontSize: 13, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".08em" }}>Trip Details</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {routeLabel}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: tripSt.bg, color: tripSt.color, flexShrink: 0 }}>
          {tripSt.label}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>

        {/* ── Trip section (admin-configured) ── */}
        <SectionLabel text="Trip Information" />
        <Row label="Route"      value={routeLabel} />
        <Row label="From"       value={trip.origin} />
        <Row label="To"         value={trip.destination} />
        <Row label="Date & Time" value={formatTripDate(trip.start_time)} />
        <Row label="Duration"   value={trip.duration} />
        <Row label="Driver"     value={trip.driver_name} accent={trip.driver_name ? "#1D4ED8" : undefined} />
        <Row label="Vehicle"    value={vehicleLabel} />
        <Row label="Capacity"   value={trip.vehicle_capacity ? `${trip.vehicle_capacity} seats` : null} last />

        {/* ── Booking section (passenger-specific) ── */}
        <SectionLabel text="Passenger Booking" />
        <Row label="Passenger"  value={passenger?.full_name} />
        <Row label="Seat"       value={trip.seat_number} accent="#7C3AED" />
        <Row label="Fare"       value={fareLabel} accent="#059669" />
        <Row label="Booked At"  value={bookedAt} />
        <Row label="Status"     value={bookingSt.label} accent={bookingSt.color} last />
      </div>
    </div>
  );
}

function PassengerProfileDrawer({ passenger, onClose, onEdit, onWallet }) {
  const [tickets,      setTickets]      = useState(null);
  const [ticketsError, setTicketsError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    setTickets(null);
    setTicketsError(null);
    apiClient.get(`/users/${passenger.user_id}/tickets`)
      .then(data => {
        const rows = Array.isArray(data) ? data : [];
        console.log(`[PassengerProfile] tickets for user ${passenger.user_id}:`, rows);
        setTickets(rows);
      })
      .catch(err => {
        console.error("[PassengerProfile] tickets fetch failed:", err);
        setTickets([]);
        setTicketsError(err?.message || "Failed to load trip history");
      });
  }, [passenger.user_id]);

  const initials = (passenger.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const nationalId = "IC-" + String(passenger.user_id).padStart(6, "0") + "X";
  const completedCount = (tickets || []).filter(t => ["completed", "confirmed", "upcoming"].includes((t.ui_status ?? t.status)?.toLowerCase())).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`
        @keyframes slideInRight { from { transform:translateX(40px);opacity:0 } to { transform:none;opacity:1 } }
        .trip-row:hover { background: #EFF6FF !important; border-color: #BFDBFE !important; }
      `}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />
      <div style={{ width: "min(92vw, 560px)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,.14)", animation: "slideInRight .25s ease", overflow: "hidden" }}>

        {selectedTrip ? (
          <TripDetailPanel trip={selectedTrip} passenger={passenger} onBack={() => setSelectedTrip(null)} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Passenger Profile</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onWallet(passenger)} style={{ background: "#ECFDF5", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#059669", fontSize: 12, fontWeight: 600 }}>Wallet</button>
                  <button onClick={() => onEdit(passenger)} style={{ background: "#F5F3FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#6D28D9", fontSize: 12, fontWeight: 600 }}>Edit</button>
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
                  { label: "Wallet Balance", value: `$${fmt(passenger.wallet_balance)}`, accent: "#059669" },
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
                {tickets && <span style={{ fontSize: 11, color: "#64748B" }}>{completedCount} active · {tickets.length} total</span>}
              </div>
              {ticketsError && (
                <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
                  ⚠ {ticketsError}
                </div>
              )}
              {tickets === null ? (
                <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: "20px 0" }}>Loading…</div>
              ) : tickets.length === 0 && !ticketsError ? (
                <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>No trips found</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tickets.slice(0, 15).map((t, i) => {
                    const statusKey = (t.ui_status ?? t.status ?? "upcoming").toLowerCase();
                    const st = TRIP_STATUS_STYLE[statusKey] || TRIP_STATUS_STYLE.upcoming;
                    return (
                      <button
                        key={t.ticket_id ?? i}
                        className="trip-row"
                        onClick={() => setSelectedTrip(t)}
                        style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left", width: "100%", transition: "background .15s, border-color .15s" }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.route_name || (t.origin && t.destination ? `${t.origin} → ${t.destination}` : `Ticket #${t.ticket_id}`)}
                          </div>
                          {t.origin && t.destination
                            ? <div style={{ fontSize: 11, color: "#64748B" }}>{t.origin} → {t.destination}</div>
                            : null}
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                            {t.start_time ? relDateTime(t.start_time) : relDate(t.created_at)}
                            {t.driver_name ? ` · ${t.driver_name}` : ""}
                            {t.seat_count > 1 ? ` · ${t.seat_count} seats` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {t.fare != null && <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 4 }}>${fmt(t.fare)}</div>}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                        <span style={{ color: "#CBD5E1", fontSize: 14, flexShrink: 0 }}>›</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suspend / Block Modal ─────────────────────────────────────────────────────

const REASONS   = ["Fraud", "Abuse", "Policy Violation", "Payment Issue", "Security Concern", "Other"];
const DURATIONS = [{ label: "1 day", value: 1 }, { label: "3 days", value: 3 }, { label: "7 days", value: 7 }, { label: "30 days", value: 30 }];

function SuspendModal({ passenger, onClose, onDone }) {
  const [tab,      setTab]      = useState("suspend");
  const [reason,   setReason]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [duration, setDuration] = useState(7);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState(null);

  const submit = async () => {
    if (!reason) { setErr("Please select a reason."); return; }
    setBusy(true); setErr(null);
    try {
      await apiClient.post(`/users/${passenger.user_id}/suspend`, { action: tab, reason, notes: notes || undefined, duration_days: tab === "suspend" ? duration : undefined });
      onDone(`User ${tab === "block" ? "blocked" : "suspended"} successfully`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Restrict — ${passenger.full_name}`} onClose={onClose} onSave={submit} saving={busy}>
      {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{err}</div>}
      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {["suspend", "block"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1E293B" : "#64748B", fontWeight: tab === t ? 700 : 500, fontSize: 13, cursor: "pointer", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
            {t === "suspend" ? "Suspend (Temporary)" : "Block (Permanent)"}
          </button>
        ))}
      </div>
      {tab === "suspend" && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Duration</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${duration === d.value ? "#2563EB" : "#E2E8F0"}`, background: duration === d.value ? "#EFF6FF" : "#fff", color: duration === d.value ? "#2563EB" : "#374151", cursor: "pointer" }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Reason *</label>
        <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}>
          <option value="">Select a reason…</option>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: tab === "block" ? 12 : 0 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details…" style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      </div>
      {tab === "block" && (
        <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
          Blocking is permanent — the passenger cannot log in until manually restored.
        </div>
      )}
    </Modal>
  );
}

function RestoreModal({ passenger, onClose, onDone }) {
  const [notes, setNotes] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await apiClient.post(`/users/${passenger.user_id}/restore`, { notes: notes || undefined }); onDone("Account restored successfully"); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Restore — ${passenger.full_name}`} onClose={onClose} onSave={submit} saving={busy}>
      {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{err}</div>}
      <p style={{ fontSize: 14, color: "#475569", marginBottom: 14 }}>Sets status back to <strong>Active</strong>.</p>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      </div>
    </Modal>
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

  const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

  const submit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setErr("Enter a valid positive amount."); return; }
    if (!reason) { setErr("Reason is required."); return; }
    setBusy(true); setErr(null);
    try {
      await apiClient.post("/wallet/adjust", { user_id: passenger.user_id, type, amount: parsed, reason, notes: notes || undefined });
      onDone(`$${parsed.toFixed(2)} ${type}ed successfully`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const isCredit = type === "credit";
  const newBal   = (parseFloat(passenger.wallet_balance || 0) + (isCredit ? 1 : -1) * parseFloat(amount || 0)).toFixed(2);

  return (
    <Modal title={`Wallet — ${passenger.full_name}`} onClose={onClose} onSave={submit} saving={busy}>
      {err && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{err}</div>}
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Balance: <strong style={{ color: "#0F172A" }}>${fmt(passenger.wallet_balance)}</strong></p>
      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {["credit", "debit"].map(t => (
          <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: type === t ? "#fff" : "transparent", color: type === t ? (t === "credit" ? "#059669" : "#DC2626") : "#64748B", fontWeight: type === t ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
            {t === "credit" ? "+ Credit" : "- Debit"}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Amount ($) *</label>
        <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inp} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Reason *</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder={isCredit ? "e.g. Refund for delayed trip" : "e.g. Penalty"} style={inp} />
      </div>
      <div style={{ marginBottom: amount && !isNaN(parseFloat(amount)) ? 12 : 0 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </div>
      {amount && !isNaN(parseFloat(amount)) && (
        <div style={{ padding: "10px 12px", background: isCredit ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${isCredit ? "#A7F3D0" : "#FECACA"}`, borderRadius: 8, fontSize: 13, color: isCredit ? "#059669" : "#DC2626" }}>
          New balance: <strong>${newBal}</strong>
        </div>
      )}
    </Modal>
  );
}

// ── Suspension history drawer ─────────────────────────────────────────────────

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
              ? <div style={{ textAlign: "center", padding: 40, color: "#94A3B8" }}><p style={{ fontSize: 13 }}>No suspension history</p></div>
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

// ══════════════════════════════════════════════════════════════════════════════
//  PassengersPage
// ══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM = { name: "", email: "", password: "", phone: "", birthDate: "", status: "Active" };
const today = new Date().toISOString().slice(0, 10);
const fldSt = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

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
    return matchFilter && (!q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.phone?.includes(q));
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 2000, background: "#1E293B", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Passengers</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Manage passenger accounts, statuses, and wallet balances</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add passenger
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total passengers" value={counts.total}                              delta="registered"   />
        <StatCard label="Active"           value={counts.active}                             delta="accounts"     />
        <StatCard label="Suspended"        value={counts.suspended}                          delta="temporarily"  />
        <StatCard label="Blocked"          value={counts.blocked}                            delta="permanently"  accent="#DC2626" />
        <StatCard label="Total balance"    value={`$${counts.balance.toFixed(2)}`}        delta="all wallets"  accent="#7C3AED" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search name, email, phone…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
        />
        {["all", "active", "suspended", "blocked"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: filter === f ? "none" : "1px solid #E2E8F0",
            background: filter === f ? "#2563EB" : "#fff",
            color: filter === f ? "#fff" : "#555",
            fontWeight: filter === f ? 600 : 400,
          }}>
            {f === "all" ? `All (${counts.total})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Panel title={`${visible.length} passengers`} noPad>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 0.7fr 0.9fr auto", padding: "10px 16px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
          {["Name", "Email", "Status", "Balance", "Trips", "Joined", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading passengers…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No passengers match your filter.</div>
        ) : visible.map((p, i) => (
          <div key={p.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 0.7fr 0.9fr auto", padding: "11px 16px", borderBottom: "1px solid #F8FAFC", alignItems: "center", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1E293B" }}>{p.full_name}</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>{p.phone || "—"}</div>
            </div>
            <div style={{ fontSize: 13, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
            <div><StatusBadge status={p.status} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>${fmt(p.wallet_balance)}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>{p.trip_count ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{relDate(p.created_at)}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setProfileTarget(p)}                                   style={actionBtn("#7C3AED", "#F5F3FF")}>Profile</button>
              <button onClick={() => openEdit(p)}                                            style={actionBtn("#2563EB", "#EFF6FF")}>Edit</button>
              <button onClick={() => setWalletTarget(p)}                                    style={actionBtn("#059669", "#ECFDF5")}>Wallet</button>
              <button onClick={() => { setDeleteTarget(p); setDeleteError(null); }}         style={actionBtn("#B91C1C", "#FEF2F2")}>Delete</button>
              {p.status === "active"
                ? <button onClick={() => setSuspendTarget(p)}                               style={actionBtn("#D97706", "#FFFBEB")}>Suspend</button>
                : <button onClick={() => setRestoreTarget(p)}                               style={actionBtn("#059669", "#ECFDF5")}>Restore</button>}
              <button onClick={() => setHistoryTarget(p)}                                   style={actionBtn("#64748B", "#F8FAFC")}>History</button>
            </div>
          </div>
        ))}

        <div style={{ padding: "10px 16px", borderTop: "1px solid #F1F5F9", background: "#F8FAFC", fontSize: 12, color: "#94A3B8" }}>
          Showing {visible.length} of {passengers.length} passengers
        </div>
      </Panel>

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
            <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Profile Drawer */}
      {profileTarget && (
        <PassengerProfileDrawer passenger={profileTarget} onClose={() => setProfileTarget(null)} onEdit={p => { setProfileTarget(null); openEdit(p); }} onWallet={p => { setProfileTarget(null); setWalletTarget(p); }} />
      )}

      {walletTarget  && <WalletModal   passenger={walletTarget}  onClose={() => setWalletTarget(null)}  onDone={handleDone} />}
      {suspendTarget && <SuspendModal  passenger={suspendTarget} onClose={() => setSuspendTarget(null)} onDone={handleDone} />}
      {restoreTarget && <RestoreModal  passenger={restoreTarget} onClose={() => setRestoreTarget(null)} onDone={handleDone} />}
      {historyTarget && <HistoryDrawer passenger={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
