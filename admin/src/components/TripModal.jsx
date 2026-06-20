import { useState, useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { getRouteTravelTime } from "../api/endpoints";

const STATUSES    = ["Scheduled", "Ongoing", "Completed", "Delayed", "Cancelled"];
const RECURRENCES = ["none", "daily", "weekdays", "weekends", "custom"];
const WEEK_DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RECURRENCE_LABEL = {
  none:     "One-time",
  daily:    "Daily",
  weekdays: "Weekdays (Mon–Fri)",
  weekends: "Weekends (Sat–Sun)",
  custom:   "Custom days",
};


function timeToMin(t = "") {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function checkFormConflicts(form, allTrips, excludeId = null) {
  if (!form.driver && !form.vehicle) return [];
  if (!form.date || !form.time) return [];
  const warnings = [];
  const fS = timeToMin(form.time);
  const fE = fS + (60);
  allTrips
    .filter(t => t.date === form.date && t.id !== excludeId)
    .forEach(t => {
      const tS = timeToMin(t.time), tE = tS + (60);
      if (fS >= tE || tS >= fE) return;
      if (form.driver && form.driver === t.driver)
        warnings.push({ type: "driver",  msg: `${form.driver} is already on ${t.id} (${t.route}) at ${t.time}` });
      if (form.vehicle && form.vehicle === t.vehicle)
        warnings.push({ type: "vehicle", msg: `${form.vehicle} is already on ${t.id} (${t.route}) at ${t.time}` });
    });
  return warnings;
}

const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

export function TripModal({ trip, allTrips = [], onClose, onSave, routeOpts = [], driverOpts = [], vehicleOpts = [] }) {
  const isEdit = Boolean(trip);
  const EMPTY  = { route: "", route_id: null, driver: "", driver_id: null, vehicle: "", vehicle_id: null, vehicle_type: null, date: new Date().toISOString().split("T")[0], time: "", end_time: "", status: "Scheduled", recurrence: "none", days: [], price: "", carpool_discount: "" };

  const editPrice           = isEdit && trip.price != null && trip.price !== "" ? String(trip.price) : "";
  const editCarpoolDiscount = isEdit && trip.carpool_price != null && trip.price > 0
    ? String(Math.round((1 - trip.carpool_price / trip.price) * 100))
    : "";
  const [form,     setForm]     = useState(isEdit ? { ...trip, route_id: trip.route_id ?? null, driver_id: trip.driver_id ?? null, vehicle_id: trip.vehicle_id ?? null, vehicle_type: trip.vehicle_type ?? null, recurrence: "none", days: [], price: editPrice, carpool_discount: editCarpoolDiscount, end_time: trip.end_time ?? "" } : EMPTY);
  const [warnings, setWarnings] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const etaDebounce = useRef(null);

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    setWarnings(checkFormConflicts(form, allTrips, trip?.id));
  }, [form.driver, form.vehicle, form.date, form.time, form.route]);

  // Auto-fill arrival time via HERE when route + departure time are both set
  useEffect(() => {
    if (!form.route_id || !form.time) { setForm(f => ({ ...f, end_time: "" })); return; }
    clearTimeout(etaDebounce.current);
    etaDebounce.current = setTimeout(async () => {
      setEtaLoading(true);
      try {
        const res = await getRouteTravelTime(form.route_id, form.time);
        if (res.data?.arrival_time) setForm(f => ({ ...f, end_time: res.data.arrival_time }));
      } catch { /* silently leave end_time empty */ }
      finally { setEtaLoading(false); }
    }, 400); // debounce — don't fire on every keystroke
  }, [form.route_id, form.time]);

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  }

  async function handleSave() {
    setError(null);
    if (!form.date || !form.time) { setError("Date and time are required."); return; }
    if (!form.route_id)           { setError("Please select a route."); return; }
    if (form.price === "" || Number(form.price) < 1) { setError("Price must be at least $1."); return; }
    setSaving(true);
    const err = await onSave(form);
    setSaving(false);
    if (err) { setError(err); return; }
    onClose();
  }

  return (
    <Modal title={isEdit ? "Edit Trip" : "Create New Trip"} onClose={onClose} onSave={handleSave} saving={saving}>
      {error && (
        <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706", marginBottom: 6 }}>
            ⚠ Scheduling Conflict Detected
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: "#92400E", marginBottom: 3 }}>
              <strong>{w.type === "driver" ? "Driver" : "Vehicle"}:</strong> {w.msg}
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#B45309", marginTop: 5 }}>You may still save — review before confirming.</div>
        </div>
      )}

      {/* Route */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Route *</label>
        <select
          value={form.route_id ?? ""}
          onChange={e => {
            const id  = e.target.value ? Number(e.target.value) : null;
            const obj = routeOpts.find(r => r.route_id === id);
            setForm(f => ({ ...f, route_id: id, route: obj?.route_name ?? obj?.name ?? "" }));
          }}
          style={inp}
        >
          <option value="">— Select route —</option>
          {routeOpts.map(r => (
            <option key={r.route_id} value={r.route_id}>{r.route_name ?? r.name}</option>
          ))}
        </select>
      </div>

      {/* Driver + Vehicle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
        <div>
          <label style={lbl}>Driver</label>
          <select
            value={form.driver_id ?? ""}
            onChange={e => {
              const id  = e.target.value ? Number(e.target.value) : null;
              const obj = driverOpts.find(d => d.driver_id === id);
              setForm(f => ({ ...f, driver_id: id, driver: obj?.full_name ?? obj?.name ?? "" }));
            }}
            style={inp}
          >
            <option value="">— Select driver —</option>
            {driverOpts.map(d => (
              <option key={d.driver_id} value={d.driver_id}>{d.full_name ?? d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Vehicle</label>
          <select
            value={form.vehicle_id ?? ""}
            onChange={e => {
              const id  = e.target.value ? Number(e.target.value) : null;
              const obj = vehicleOpts.find(v => v.vehicle_id === id);
              setForm(f => ({ ...f, vehicle_id: id, vehicle: obj?.plate_number ?? obj?.plate ?? "", vehicle_type: obj?.vehicle_type?.toLowerCase() ?? null }));
            }}
            style={inp}
          >
            <option value="">— Select vehicle —</option>
            {vehicleOpts.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number ?? v.plate}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Date + Departure + Arrival */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 13 }}>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" value={form.date} onChange={e => set("date")(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Departure Time</label>
          <input type="time" value={form.time} onChange={e => set("time")(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 5 }}>
            Arrival Time
            {etaLoading && (
              <span style={{ fontSize: 10, color: "#6D28D9", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                HERE…
              </span>
            )}
          </label>
          <input
            type="time"
            value={form.end_time}
            onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
            style={{ ...inp, background: form.end_time && !etaLoading ? "#F0FDF4" : "#F8FAFC", color: form.end_time ? "#065F46" : "#94A3B8" }}
            placeholder="auto"
          />
          {form.end_time && !etaLoading && (
            <div style={{ fontSize: 10, color: "#059669", marginTop: 3, fontWeight: 600 }}>
              Calculated via HERE routing
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Status */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Status</label>
        <select value={form.status} onChange={e => set("status")(e.target.value)} style={inp}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Pricing */}
      <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", marginBottom: 13, background: "#F8FAFC" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>Pricing</div>
        <div style={{ display: "grid", gridTemplateColumns: form.vehicle_type === "taxi" ? "1fr 1fr" : "1fr", gap: 12 }}>
          <div>
            <label style={lbl}>
              {["taxi", "tuktuk"].includes(form.vehicle_type) ? "Price per Trip ($)" : "Price per Seat ($)"}
            </label>
            <input
              type="number" min="1" step="0.01" placeholder="1.00"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              style={{ ...inp, background: "#fff" }}
            />
          </div>
          {form.vehicle_type === "taxi" && (
            <div>
              <label style={lbl}>Carpool Discount (%)</label>
              <input
                type="number" min="1" max="99" step="1" placeholder="e.g. 30"
                value={form.carpool_discount}
                onChange={e => setForm(f => ({ ...f, carpool_discount: e.target.value }))}
                style={{ ...inp, background: "#fff" }}
              />
            </div>
          )}
        </div>
        {form.vehicle_type === "taxi" && form.price && form.carpool_discount && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🪑</span>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                Carpool seat: ${(Number(form.price) * (1 - Number(form.carpool_discount) / 100)).toFixed(2)}
              </span>
              <span style={{ fontSize: 11, color: "#6EE7B7", marginLeft: 6 }}>
                ({form.carpool_discount}% off ${Number(form.price).toFixed(2)})
              </span>
            </div>
          </div>
        )}
        {form.vehicle_type === "tuktuk" && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#64748B" }}>
            Passengers book the whole tuktuk — no seat splitting.
          </div>
        )}
      </div>

      {!isEdit && (
        <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>Recurring Schedule</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            {RECURRENCES.map(r => (
              <button key={r} onClick={() => set("recurrence")(r)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                background: form.recurrence === r ? "#2563EB" : "#F1F5F9",
                color:      form.recurrence === r ? "#fff"    : "#64748B",
              }}>
                {RECURRENCE_LABEL[r]}
              </button>
            ))}
          </div>
          {form.recurrence === "custom" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEK_DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  width: 38, height: 34, borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: form.days.includes(d) ? "#2563EB" : "#F1F5F9",
                  color:      form.days.includes(d) ? "#fff"    : "#64748B",
                }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
