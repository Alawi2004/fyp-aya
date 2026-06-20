import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, Play, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { ExportBtn } from "../components/ExportBtn";
import { PageLoading, PageError } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { TripModal } from "../components/TripModal";
import {
  getTrips, createTrip, updateTripStatus, updateTrip,
  getTimetableTrips, getRecurringSchedules,
  createRecurringSchedule, updateRecurringSchedule, deleteRecurringSchedule,
  getTripConflicts, getTripDelays, getTripStopArrivals,
} from "../api/endpoints";
import { getRoutes, getDrivers, getVehicles } from "../api/endpoints";

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES     = ["Scheduled", "Ongoing", "Completed", "Delayed", "Cancelled"];
const RECURRENCES  = ["none", "daily", "weekdays", "weekends", "custom"];
const WEEK_DAYS    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RECURRENCE_LABEL = {
  none:     "One-time",
  daily:    "Daily",
  weekdays: "Weekdays (Mon–Fri)",
  weekends: "Weekends (Sat–Sun)",
  custom:   "Custom days",
};


const STATUS_COLORS = {
  Completed: { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  Ongoing:   { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
  Delayed:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  Scheduled: { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  Cancelled: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

const TODAY = new Date().toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────────
function capitalizeStatus(s) {
  if (!s) return "Scheduled";
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeTrip(t) {
  // Use the date/time fields directly if the backend already split them (timetable endpoint),
  // otherwise parse start_time in UTC to avoid local-timezone drift.
  let date = t.date ?? "";
  let time = t.time ?? "";
  if (!date && t.start_time) {
    // Parse as UTC: "2026-06-15T07:00:00.000Z" → date "2026-06-15", time "07:00"
    const iso = new Date(t.start_time).toISOString();
    date = iso.slice(0, 10);
    time = iso.slice(11, 16);
  }
  return {
    id:               t.trip_id  ?? t.id,
    route_id:         t.route_id   ?? null,
    driver_id:        t.driver_id  ?? t.drv_id ?? null,
    vehicle_id:       t.vehicle_id ?? null,
    vehicle_type:     t.vehicle_type ?? null,
    route:            t.route_name   ?? t.route   ?? "",
    driver:           t.driver_name  ?? t.driver  ?? "",
    vehicle:          t.plate_number ?? t.vehicle ?? "",
    seats:            t.seats ?? `0/${t.capacity ?? 30}`,
    date,
    time,
    status:           capitalizeStatus(t.status),
    price:            t.price        != null ? String(t.price) : "",
    carpool_price:    t.carpool_price ?? null,
  };
}

function timeToMin(t = "") {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function detectConflicts(trips) {
  const conflicts = [];
  for (let i = 0; i < trips.length; i++) {
    for (let j = i + 1; j < trips.length; j++) {
      const a = trips[i], b = trips[j];
      if (a.date !== b.date) continue;
      const aS = timeToMin(a.time), aE = aS + (60);
      const bS = timeToMin(b.time), bE = bS + (60);
      if (aS >= bE || bS >= aE) continue;          // no time overlap
      if (a.driver && a.driver === b.driver)
        conflicts.push({ type: "driver",  resource: a.driver,  a, b });
      if (a.vehicle && a.vehicle === b.vehicle)
        conflicts.push({ type: "vehicle", resource: a.vehicle, a, b });
    }
  }
  return conflicts;
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

// ── Shared tab nav ────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#DDE3EE", borderRadius: 10, padding: 4, border: "1px solid #C8D2E4" }}>
      {tabs.map(({ id, label, badge }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 18px", borderRadius: 7, border: "none",
          fontSize: 13, fontWeight: active === id ? 700 : 500, cursor: "pointer",
          background: active === id ? "#fff" : "transparent",
          color:      active === id ? "#6D28D9" : "#64748B",
          boxShadow:  active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
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

// ── Tab 1: Trips list ─────────────────────────────────────────────────────────
function TripsListTab({ trips, allTrips, onAdd, onEdit, onDetail }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = trips.filter(t => {
    const matchStatus = filter === "All" || t.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.route.toLowerCase().includes(q) || t.driver.toLowerCase().includes(q) || String(t.id).toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const columns = [
    {
      key: "id", label: "Trip ID",
      render: v => <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#6D28D9", fontSize: 12 }}>{v}</span>,
    },
    { key: "route",  label: "Route"   },
    { key: "driver", label: "Driver"  },
    { key: "vehicle",label: "Vehicle" },
    {
      key: "time", label: "Time",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 10, color: "#94A3B8" }}>{row.date}</div>
        </div>
      ),
    },
    { key: "seats",  label: "Seats"  },
    { key: "status", label: "Status", render: v => <StatusPill status={v} /> },
    {
      key: "id", label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={e => { e.stopPropagation(); onDetail(row); }} style={{
            fontSize: 11, color: "#059669", background: "#ECFDF5",
            border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer",
          }}>Details</button>
          <button onClick={e => { e.stopPropagation(); onEdit(row); }} style={{
            fontSize: 11, color: "#6D28D9", background: "#F5F3FF",
            border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer",
          }}>Edit</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search route, driver, ID..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 260 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: filter === s ? "none" : "1px solid #E2E8F0",
              background: filter === s ? "#6D28D9" : "#fff",
              color:      filter === s ? "#fff"    : "#64748B",
              fontWeight: filter === s ? 600 : 400,
            }}>{s}</button>
          ))}
        </div>
      </div>
      <Panel title={`${visible.length} trips`}>
        <DataTable columns={columns} rows={visible} onRowClick={onEdit} />
        {visible.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No trips match your filter.</div>
        )}
      </Panel>
    </div>
  );
}

// ── Tab 2: Timetable grid ─────────────────────────────────────────────────────
const SLOT_W    = 52;   // px per 30-min slot
const GRID_START = 5 * 60;   // 05:00
const GRID_END   = 22 * 60;  // 22:00
const SLOTS      = (GRID_END - GRID_START) / 30;  // 34 slots
const ROW_H      = 54;
const LABEL_W    = 130;

function TimetableTab({ routeOpts = [] }) {
  const [date,        setDate]       = useState(TODAY);
  const [routeFilter, setRouteFilter]= useState("All");
  const [tooltip,     setTooltip]    = useState(null);
  const [trips,       setTrips]      = useState([]);
  const [loading,     setLoading]    = useState(false);

  useEffect(() => {
    setLoading(true);
    getTimetableTrips(date)
      .then(d => setTrips(Array.isArray(d) ? d : []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [date]);

  // Normalize timetable trip statuses
  const normalizedTrips = trips.map(t => ({ ...t, status: capitalizeStatus(t.status) }));

  // Only show routes that actually have trips on the selected date
  const routesWithTrips = [...new Set(normalizedTrips.map(t => t.route).filter(Boolean))];

  const dayTrips = normalizedTrips.filter(t =>
    (routeFilter === "All" || t.route === routeFilter));
  const hours = [];
  for (let m = GRID_START; m <= GRID_END; m += 60) {
    hours.push(`${String(m / 60).padStart(2, "0")}:00`);
  }

  function tripLeft(t)  { return Math.max(0, (timeToMin(t.time) - GRID_START) / 30 * SLOT_W); }
  function tripWidth(t) { return Math.max(SLOT_W, (60) / 30 * SLOT_W); }

  const visibleRoutes = routeFilter === "All" ? routesWithTrips : [routeFilter];
  const totalW = SLOTS * SLOT_W;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...routesWithTrips].map(r => (
            <button key={r} onClick={() => setRouteFilter(r)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: routeFilter === r ? "none" : "1px solid #E2E8F0",
              background: routeFilter === r ? "#6D28D9" : "#fff",
              color:      routeFilter === r ? "#fff"    : "#64748B",
              fontWeight: routeFilter === r ? 600 : 400,
            }}>{r}</button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>{dayTrips.length} trips on {date}</span>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: c.bg, border: `1.5px solid ${c.border}` }} />
            <span style={{ fontSize: 11, color: "#64748B" }}>{s}</span>
          </div>
        ))}
      </div>

      <Panel title="Daily Timetable Grid" noPad>
        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
        ) : dayTrips.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>
            No trips scheduled for {date}.
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "visible" }}>
            <div style={{ minWidth: LABEL_W + totalW + 24 }}>
              {/* Hour header */}
              <div style={{ display: "flex", borderBottom: "2px solid #E2E8F0", background: "#F1F5F9" }}>
                <div style={{ width: LABEL_W, flexShrink: 0, padding: "8px 14px", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".07em" }}>Route</div>
                <div style={{ width: totalW, flexShrink: 0, position: "relative", height: 32 }}>
                  {hours.map((h, i) => (
                    <div key={h} style={{
                      position: "absolute", left: i * 2 * SLOT_W, top: 0, height: "100%",
                      borderLeft: "1px solid #F1F5F9",
                      fontSize: 10, fontWeight: 700, color: "#94A3B8",
                      paddingLeft: 4, paddingTop: 8,
                    }}>{h}</div>
                  ))}
                </div>
              </div>

              {/* Route rows */}
              {visibleRoutes.map((route, ri) => {
                const routeTrips = dayTrips.filter(t => t.route === route);
                const routeInfo  = routeOpts.find(r => (r.route_name ?? r.name) === route);
                return (
                  <div key={route} style={{
                    display: "flex", alignItems: "center",
                    borderBottom: ri < visibleRoutes.length - 1 ? "1px solid #E8EDF5" : "none",
                    background: ri % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                    minHeight: ROW_H,
                  }}>
                    {/* Route label */}
                    <div style={{ width: LABEL_W, flexShrink: 0, padding: "8px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{route}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8" }}>{routeInfo?.duration}</div>
                    </div>

                    {/* Trip blocks */}
                    <div style={{ width: totalW, flexShrink: 0, position: "relative", height: ROW_H }}>
                      {/* 30-min grid lines */}
                      {Array.from({ length: SLOTS }).map((_, i) => (
                        <div key={i} style={{
                          position: "absolute", left: i * SLOT_W, top: 0, bottom: 0,
                          borderLeft: i % 2 === 0 ? "1px solid #F1F5F9" : "1px dashed #F8FAFC",
                          width: 1,
                        }} />
                      ))}

                      {routeTrips.map(t => {
                        const sc  = STATUS_COLORS[t.status] || STATUS_COLORS.Scheduled;
                        const lft = tripLeft(t);
                        const wid = tripWidth(t);
                        return (
                          <div
                            key={t.id}
                            onMouseEnter={e => setTooltip({ t, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            style={{
                              position: "absolute",
                              left: lft + 2, top: 7,
                              width: wid - 4, height: ROW_H - 14,
                              background: sc.bg,
                              border: `1.5px solid ${sc.border}`,
                              borderRadius: 7,
                              overflow: "hidden",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,.07)",
                              transition: "transform .1s, box-shadow .1s",
                            }}
                            onMouseOver={e => { e.currentTarget.style.transform = "scaleY(1.04)"; e.currentTarget.style.boxShadow = "0 3px 8px rgba(0,0,0,.12)"; }}
                            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.07)"; }}
                          >
                            <div style={{ padding: "3px 6px" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: sc.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {t.time} · {t.id}
                              </div>
                              {wid > 80 && (
                                <div style={{ fontSize: 9, color: sc.color + "BB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {t.driver}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {routeTrips.length === 0 && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                          <span style={{ fontSize: 11, color: "#CBD5E1" }}>No trips</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 9000,
          background: "#1E293B", color: "#fff", borderRadius: 10, padding: "10px 14px",
          fontSize: 12, pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,.3)",
          minWidth: 180,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.t.id} — {tooltip.t.route}</div>
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>{tooltip.t.time} · {"—"} min</div>
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>Driver: {tooltip.t.driver ?? "—"}</div>
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>Vehicle: {tooltip.t.vehicle ?? "—"}</div>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
              background: STATUS_COLORS[tooltip.t.status]?.bg ?? "#F8FAFC",
              color:      STATUS_COLORS[tooltip.t.status]?.color ?? "#64748B",
            }}>{tooltip.t.status}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Recurring schedules ────────────────────────────────────────────────

const DAY_INDEX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

function nextOccurrence(r) {
  const now  = new Date();
  const todayDow = now.getDay(); // 0=Sun … 6=Sat
  const todayStr = now.toISOString().slice(0, 10);

  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const fmt = (iso) => {
    const d   = new Date(iso + "T00:00:00");
    const diff = Math.round((d - new Date(todayStr + "T00:00:00")) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff < 7)  return d.toLocaleDateString("en-GB", { weekday: "long" });
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  if (r.recurrence === "daily") {
    return fmt(addDays(1));
  }
  if (r.recurrence === "weekdays") {
    // Next Mon-Fri
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      if (d.getDay() >= 1 && d.getDay() <= 5) return fmt(d.toISOString().slice(0, 10));
    }
  }
  if (r.recurrence === "weekends") {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) return fmt(d.toISOString().slice(0, 10));
    }
  }
  if (r.recurrence === "custom" && r.days?.length > 0) {
    const targets = r.days.map(d => DAY_INDEX[d]).filter(x => x !== undefined);
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      if (targets.includes(d.getDay())) return fmt(d.toISOString().slice(0, 10));
    }
  }
  return r.next_run ?? "—";
}

function recurrenceLabel(r) {
  if (r.recurrence === "daily")    return "Runs every day";
  if (r.recurrence === "weekdays") return "Runs Mon – Fri";
  if (r.recurrence === "weekends") return "Runs Sat & Sun";
  if (r.recurrence === "custom" && r.days?.length > 0)
    return `Runs every ${r.days.join(", ")}`;
  return "Custom schedule";
}

const RECURRENCE_BADGE = {
  daily:    { label: "Daily",    bg: "#F5F3FF", color: "#6D28D9" },
  weekdays: { label: "Weekdays", bg: "#F0FDF4", color: "#059669" },
  weekends: { label: "Weekends", bg: "#F5F3FF", color: "#7C3AED" },
  custom:   { label: "Custom",   bg: "#FFFBEB", color: "#D97706" },
};

function RecurringTab({ recurring, onAdd, onEdit, onDelete, onToggle, routeOpts = [], driverOpts = [], vehicleOpts = [] }) {
  const [modal,   setModal]   = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [form,    setForm]    = useState({ route: "", driver: "", vehicle: "", time: "", recurrence: "daily", days: [], status: "Active" });

  const routeNames    = routeOpts.map(r => r.route_name ?? r.name).filter(Boolean);
  const driverNames   = driverOpts.map(d => d.full_name ?? d.name).filter(Boolean);
  const vehiclePlates = vehicleOpts.map(v => v.plate_number ?? v.plate).filter(Boolean);

  function openAdd()   { setEditRec(null); setForm({ route: "", driver: "", vehicle: "", time: "", recurrence: "daily", days: [], status: "Active" }); setModal(true); }
  function openEdit(r) { setEditRec(r); setForm({ route: r.route, driver: r.driver, vehicle: r.vehicle, time: r.time, recurrence: r.recurrence, days: r.days ?? [], status: r.status }); setModal(true); }

  async function handleSave() {
    if (!form.route || !form.driver || !form.time) return;
    if (editRec) {
      const prevRec = editRec;
      onEdit({ ...editRec, ...form });
      try {
        await updateRecurringSchedule(editRec.id, form);
      } catch (err) {
        onEdit(prevRec);
        alert(err?.message ?? "Failed to update recurring schedule");
      }
    } else {
      const payload = { ...form, active_from: TODAY, next_run: TODAY };
      try {
        const res = await createRecurringSchedule(payload);
        const realId = res?.schedule_id ?? Date.now();
        onAdd({ id: realId, ...payload });
      } catch {
        onAdd({ id: Date.now(), ...payload });
      }
    }
    setModal(false);
  }

  function toggleDay(day) { setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] })); }

  const inp2 = { ...inp, marginTop: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>{recurring.length} schedule{recurring.length !== 1 ? "s" : ""} · each runs automatically on its defined days</span>
        <button onClick={openAdd} style={{ background: "#6D28D9", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Recurring Schedule
        </button>
      </div>

      {recurring.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8", fontSize: 13 }}>
          No recurring schedules yet. Create one to auto-generate trips on a repeating pattern.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recurring.map(r => {
            const rb      = RECURRENCE_BADGE[r.recurrence] || RECURRENCE_BADGE.daily;
            const next    = nextOccurrence(r);
            const label   = recurrenceLabel(r);
            const active  = r.status === "Active";
            return (
              <div key={r.id} style={{ background: "#fff", border: `1px solid ${active ? "#E2E8F0" : "#F1F5F9"}`, borderRadius: 12, padding: "16px 20px", opacity: active ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>

                  {/* Left: time + recurrence badge */}
                  <div style={{ textAlign: "center", minWidth: 64 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: active ? "#0F172A" : "#94A3B8", lineHeight: 1 }}>{r.time}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: rb.bg, color: rb.color, marginTop: 4, display: "inline-block" }}>{rb.label}</span>
                  </div>

                  {/* Middle: route + details + next run */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 4 }}>{r.route}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>
                      {r.driver} · {r.vehicle}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{label}</span>
                      {r.recurrence === "custom" && r.days?.length > 0 && (
                        <div style={{ display: "flex", gap: 3 }}>
                          {r.days.map(d => (
                            <span key={d} style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5, background: "#F5F3FF", color: "#6D28D9" }}>{d}</span>
                          ))}
                        </div>
                      )}
                      <span style={{ fontSize: 11, color: active ? "#059669" : "#94A3B8", fontWeight: 600, background: active ? "#ECFDF5" : "#F8FAFC", padding: "2px 8px", borderRadius: 6 }}>
                        Next: {active ? next : "Paused"}
                      </span>
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <StatusPill status={active ? "Active" : "Inactive"} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(r)} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>Edit</button>
                      <button
                        onClick={async () => {
                          onToggle(r.id);
                          try {
                            await updateRecurringSchedule(r.id, { status: active ? "Paused" : "Active" });
                          } catch (err) {
                            onToggle(r.id);
                            alert(err?.message ?? "Failed to update schedule status");
                          }
                        }}
                        style={{ fontSize: 11, color: active ? "#D97706" : "#059669", background: active ? "#FFFBEB" : "#ECFDF5", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>
                        {active ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await deleteRecurringSchedule(r.id);
                            onDelete(r.id);
                          } catch (err) {
                            alert(err?.message ?? "Failed to delete schedule");
                          }
                        }}
                        style={{ fontSize: 11, color: "#DC2626", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={editRec ? "Edit Recurring Schedule" : "New Recurring Schedule"} onClose={() => setModal(false)} onSave={handleSave}>
          {[
            { label: "Route", key: "route", options: routeNames },
            { label: "Driver", key: "driver", options: driverNames },
            { label: "Vehicle", key: "vehicle", options: vehiclePlates },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 13 }}>
              <label style={lbl}>{f.label}</label>
              <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp2}>
                <option value="">— Select —</option>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Departure Time</label>
            <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={inp2} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Recurrence Pattern</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["daily", "weekdays", "weekends", "custom"].map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, recurrence: r }))} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                  background: form.recurrence === r ? "#6D28D9" : "#F1F5F9",
                  color:      form.recurrence === r ? "#fff"    : "#64748B",
                }}>
                  {RECURRENCE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          {form.recurrence === "custom" && (
            <div style={{ marginBottom: 13 }}>
              <label style={lbl}>Select Days</label>
              <div style={{ display: "flex", gap: 6 }}>
                {WEEK_DAYS.map(d => (
                  <button key={d} onClick={() => toggleDay(d)} style={{
                    width: 38, height: 34, borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: form.days.includes(d) ? "#6D28D9" : "#F1F5F9",
                    color:      form.days.includes(d) ? "#fff"    : "#64748B",
                  }}>{d}</button>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Tab 4: Conflicts ──────────────────────────────────────────────────────────
function ConflictsTab({ conflicts, onResolve }) {
  const driverConflicts  = conflicts.filter(c => c.type === "driver");
  const vehicleConflicts = conflicts.filter(c => c.type === "vehicle");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary banner */}
      {conflicts.length === 0 ? (
        <div style={{ padding: "18px 22px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28 }}>✓</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>No scheduling conflicts detected</div>
            <div style={{ fontSize: 12, color: "#6EE7B7" }}>All drivers and vehicles have conflict-free schedules.</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "16px 20px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C", marginBottom: 2 }}>
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
            </div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>
              {driverConflicts.length} driver double-booking{driverConflicts.length !== 1 ? "s" : ""} ·{" "}
              {vehicleConflicts.length} vehicle double-booking{vehicleConflicts.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      {conflicts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{driverConflicts.length}</div>
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 6, fontWeight: 600 }}>Driver Double-Bookings</div>
            <div style={{ fontSize: 11, color: "#EF4444", marginTop: 2 }}>Same driver on overlapping trips</div>
          </div>
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#D97706", lineHeight: 1 }}>{vehicleConflicts.length}</div>
            <div style={{ fontSize: 12, color: "#B45309", marginTop: 6, fontWeight: 600 }}>Vehicle Double-Bookings</div>
            <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>Same vehicle on overlapping trips</div>
          </div>
        </div>
      )}

      {/* Conflict list */}
      {conflicts.length > 0 && (
        <Panel title="Conflict Details">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {conflicts.map((c, i) => {
              const isDriver = c.type === "driver";
              const bg     = isDriver ? "#FEF2F2" : "#FFFBEB";
              const border = isDriver ? "#FECACA" : "#FDE68A";
              const color  = isDriver ? "#B91C1C" : "#B45309";
              return (
                <div key={i} style={{ padding: "14px 16px", background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color, color: "#fff", marginRight: 8 }}>
                        {isDriver ? "Driver Conflict" : "Vehicle Conflict"}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{c.resource}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    {[c.a, c.b].map((t, ti) => ti === 0 ? (
                      <div key={0} style={{ background: "#fff", borderRadius: 9, padding: "10px 12px", border: "1px solid #F1F5F9" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", marginBottom: 3, fontFamily: "monospace" }}>{t.id}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{t.time}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{t.driver} · {t.vehicle}</div>
                        <div style={{ marginTop: 6 }}><StatusPill status={t.status} /></div>
                      </div>
                    ) : [
                      <div key="sep" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, color: color }}>⟺</div>
                        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>overlap</div>
                      </div>,
                      <div key={1} style={{ background: "#fff", borderRadius: 9, padding: "10px 12px", border: "1px solid #F1F5F9" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", marginBottom: 3, fontFamily: "monospace" }}>{t.id}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{t.time}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{t.driver} · {t.vehicle}</div>
                        <div style={{ marginTop: 6 }}><StatusPill status={t.status} /></div>
                      </div>,
                    ])}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => onResolve(c.a)} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                      Edit {c.a.id}
                    </button>
                    <button onClick={() => onResolve(c.b)} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                      Edit {c.b.id}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Tab 5: Delay reports ──────────────────────────────────────────────────────
const DELAY_REASONS = ["Traffic", "Mechanical", "Road Block", "Passenger Incident", "Weather", "Other"];

const DELAY_REASON_COLORS = {
  "Traffic":            { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" },
  "Mechanical":         { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  "Road Block":         { bg: "#EDE9FE", color: "#7C3AED", border: "#C4B5FD" },
  "Passenger Incident": { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" },
  "Weather":            { bg: "#F0F9FF", color: "#0284C7", border: "#BAE6FD" },
  "Other":              { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
};


function DelaysTab({ delays, loading, error, onRetry }) {
  const [reasonFilter, setReasonFilter] = useState("All");
  const [search,       setSearch]       = useState("");

  const visible = delays.filter(d => {
    const matchReason = reasonFilter === "All" || d.reason === reasonFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (d.trip_ref  ?? "").toLowerCase().includes(q) ||
      (d.route     ?? "").toLowerCase().includes(q) ||
      (d.driver    ?? "").toLowerCase().includes(q) ||
      (d.reason    ?? "").toLowerCase().includes(q);
    return matchReason && matchSearch;
  });

  const totalAffected = visible.reduce((s, d) => s + (d.affected_passengers ?? 0), 0);
  const avgDelay      = visible.length
    ? Math.round(visible.reduce((s, d) => s + (d.delay_minutes ?? 0), 0) / visible.length)
    : 0;

  function fmtDate(dt) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <PageLoading message="Loading delay reports…" />;
  if (error)   return <PageError  message={error} onRetry={onRetry} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#DC2626", lineHeight: 1 }}>{visible.length}</div>
          <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 6, fontWeight: 600 }}>Total Delays</div>
          <div style={{ fontSize: 11, color: "#EF4444", marginTop: 2 }}>matching current filter</div>
        </div>
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#D97706", lineHeight: 1 }}>{avgDelay}</div>
          <div style={{ fontSize: 12, color: "#B45309", marginTop: 6, fontWeight: 600 }}>Avg Delay (min)</div>
          <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>across visible records</div>
        </div>
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#6D28D9", lineHeight: 1 }}>{totalAffected}</div>
          <div style={{ fontSize: 12, color: "#4C1D95", marginTop: 6, fontWeight: 600 }}>Passengers Affected</div>
          <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 2 }}>confirmed + boarded tickets</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search trip, route, driver, reason…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...DELAY_REASONS].map(r => (
            <button key={r} onClick={() => setReasonFilter(r)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border:      reasonFilter === r ? "none" : "1px solid #E2E8F0",
              background:  reasonFilter === r ? "#6D28D9" : "#fff",
              color:       reasonFilter === r ? "#fff" : "#64748B",
              fontWeight:  reasonFilter === r ? 600 : 400,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Panel title={`${visible.length} delay report${visible.length !== 1 ? "s" : ""}`} noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F1F5F9", borderBottom: "2px solid #E2E8F0", borderTop: "1px solid #E2E8F0" }}>
              {["Trip", "Route", "Driver", "Vehicle", "Reason", "Delay", "Notes", "Reported At", "Passengers"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((d, i) => {
              const rc = DELAY_REASON_COLORS[d.reason] ?? DELAY_REASON_COLORS["Other"];
              return (
                <tr key={d.delay_id} style={{ borderBottom: "1px solid #E8EDF5", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F5F3FF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC"; }}
              >
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#6D28D9", fontSize: 12 }}>{d.trip_ref}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{d.route}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{d.driver}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: "#6D28D9", fontWeight: 600 }}>{d.vehicle}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                      {d.reason}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: (d.delay_minutes ?? 0) >= 30 ? "#DC2626" : "#D97706" }}>
                      {d.delay_minutes}
                    </span>
                    <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 3 }}>min</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748B", maxWidth: 200 }}>
                    {d.notes ?? <span style={{ color: "#CBD5E1" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>{fmtDate(d.reported_at)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: (d.affected_passengers ?? 0) > 20 ? "#DC2626" : "#475569" }}>
                      {d.affected_passengers ?? 0}
                    </span>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>
                  No delay reports match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ── Trip detail drawer with stop arrival timeline ─────────────────────────────
const ARRIVAL_STATUS_CFG = {
  on_time:  { label: "On Time",  bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", icon: "✓" },
  late:     { label: "Late",     bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", icon: "!" },
  early:    { label: "Early",    bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE", icon: "↑" },
  pending:  { label: "Pending",  bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0", icon: "…" },
  skipped:  { label: "Skipped",  bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", icon: "—" },
};

function TripDetailDrawer({ trip, onClose, onEdit }) {
  const [arrivals, setArrivals] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!trip) return;
    setLoading(true);
    getTripStopArrivals(trip.id)
      .then(d => setArrivals(Array.isArray(d) ? d : []))
      .catch(() => setArrivals([]))
      .finally(() => setLoading(false));
  }, [trip?.id]);

  if (!trip) return null;

  function fmtTime(dt) {
    if (!dt) return "—";
    return new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function fmtDelay(sec) {
    if (sec == null) return null;
    if (sec === 0) return "On time";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60), s = abs % 60;
    const str = m > 0 ? `${m}m ${s}s` : `${s}s`;
    return sec > 0 ? `+${str} late` : `${str} early`;
  }

  const onTimeCount  = arrivals.filter(a => a.arrival_status === "on_time").length;
  const lateCount    = arrivals.filter(a => a.arrival_status === "late").length;
  const pendingCount = arrivals.filter(a => a.arrival_status === "pending").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px); opacity:0 } to { transform:none; opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />

      <div style={{ width: "min(92vw, 560px)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,.14)", overflowY: "auto", animation: "slideInRight .25s ease" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Trip Details</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onClose(); onEdit(trip); }} style={{ background: "#F5F3FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#6D28D9", fontSize: 12, fontWeight: 600 }}>
                Edit Trip
              </button>
              <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* Trip ID + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F5F3FF", border: "2px solid #DDD6FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="11" x2="22" y2="11"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="16" y1="5" x2="16" y2="11"/><circle cx="6.5" cy="20" r="1.5"/><circle cx="17.5" cy="20" r="1.5"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", marginBottom: 4 }}>{trip.id}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusPill status={trip.status} />
                <span style={{ fontSize: 11, color: "#64748B" }}>{trip.date} · {trip.time}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trip info grid */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 12 }}>Trip Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Route",   value: trip.route   },
              { label: "Driver",  value: trip.driver  },
              { label: "Vehicle", value: trip.vehicle },
              { label: "Seats",   value: trip.seats   },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{value || "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stop arrivals */}
        <div style={{ padding: "18px 24px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8" }}>
              Stop Arrival Timeline
            </div>
            {arrivals.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: `${onTimeCount} on time`, color: "#059669" },
                  { label: `${lateCount} late`,      color: "#DC2626" },
                  { label: `${pendingCount} pending`, color: "#64748B" },
                ].map(s => (
                  <span key={s.label} style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading stop data…</div>
          ) : arrivals.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8, color: "#CBD5E1" }}>—</div>
              <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>No stop arrival data yet</div>
              <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 4 }}>Stop arrivals are recorded as the driver marks each stop.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {arrivals.map((a, i) => {
                const cfg = ARRIVAL_STATUS_CFG[a.arrival_status] ?? ARRIVAL_STATUS_CFG.pending;
                const delayStr = fmtDelay(a.delay_seconds);
                const isLast = i === arrivals.length - 1;
                return (
                  <div key={a.id ?? i} style={{ display: "flex", gap: 14, position: "relative" }}>
                    {/* Timeline spine */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 32 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: cfg.bg, border: `2px solid ${cfg.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, color: cfg.color, flexShrink: 0,
                        marginTop: 8,
                      }}>
                        {a.stop_order ?? (i + 1)}
                      </div>
                      {!isLast && (
                        <div style={{ width: 2, flex: 1, minHeight: 16, background: "#E2E8F0", borderRadius: 1 }} />
                      )}
                    </div>

                    {/* Stop info */}
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14, paddingTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>
                            {a.stop_name ?? `Stop ${a.stop_order ?? i + 1}`}
                          </div>
                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748B" }}>
                            <span>Sched: <strong>{fmtTime(a.scheduled_arrival_at)}</strong></span>
                            <span>Actual: <strong style={{ color: a.arrival_status === "late" ? "#DC2626" : a.arrival_status === "on_time" ? "#059669" : "#64748B" }}>
                              {fmtTime(a.actual_arrival_at)}
                            </strong></span>
                          </div>
                          {delayStr && (
                            <div style={{ fontSize: 11, color: a.delay_seconds > 0 ? "#DC2626" : a.delay_seconds < 0 ? "#6D28D9" : "#059669", marginTop: 3, fontWeight: 600 }}>
                              {delayStr}
                            </div>
                          )}
                          {a.notes && (
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3, fontStyle: "italic" }}>{a.notes}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ── Main TripsPage ────────────────────────────────────────────────────────────
export default function TripsPage() {
  const [tab,            setTab]            = useState("trips");
  const [trips,           setTrips]           = useState([]);
  const [tripsLoading,    setTripsLoading]    = useState(true);
  const [tripsError,      setTripsError]      = useState(null);
  const [timetableTrips,  setTimetableTrips]  = useState([]);
  const [recurring,       setRecurring]       = useState([]);
  const [serverConflicts, setServerConflicts] = useState(null); // null = not yet loaded
  const [tripModal,       setTripModal]       = useState(null); // null = closed, false = new, trip obj = edit
  const [routeOpts,       setRouteOpts]       = useState([]);
  const [driverOpts,      setDriverOpts]      = useState([]);
  const [vehicleOpts,     setVehicleOpts]     = useState([]);
  const [delays,          setDelays]          = useState([]);
  const [delaysLoading,   setDelaysLoading]   = useState(true);
  const [delaysError,     setDelaysError]     = useState(null);
  const [detailTrip,      setDetailTrip]      = useState(null);

  const loadConflicts = useCallback(() => {
    getTripConflicts()
      .then(d => setServerConflicts(Array.isArray(d) ? d : null))
      .catch(() => setServerConflicts(null));
  }, []);

  const loadTrips = useCallback(() => {
    setTripsLoading(true);
    setTripsError(null);
    getTrips()
      .then(d => {
        const rows = d?.data ?? d;
        setTrips((rows || []).map(normalizeTrip));
      })
      .catch(err => {
        setTrips([]);
        setTripsError(err?.message ?? "Could not reach server");
      })
      .finally(() => setTripsLoading(false));
  }, []);

  useEffect(() => {
    loadTrips();

    getRoutes().then(d => setRouteOpts(Array.isArray(d) ? d : [])).catch(() => {});
    getDrivers().then(d => setDriverOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});
    getVehicles().then(d => setVehicleOpts(Array.isArray(d?.data ?? d) ? (d?.data ?? d) : [])).catch(() => {});

    getTimetableTrips(TODAY)
      .then(d => setTimetableTrips(Array.isArray(d) ? d : []))
      .catch(() => setTimetableTrips([]));

    getRecurringSchedules()
      .then(d => setRecurring(Array.isArray(d) ? d : []))
      .catch(() => setRecurring([]));

    loadConflicts();

    getTripDelays()
      .then(d => setDelays(Array.isArray(d) ? d : []))
      .catch(() => setDelays([]))
      .finally(() => setDelaysLoading(false));

    // Auto-refresh trip status every 30s so driver start/complete updates appear
    const statusPoll = setInterval(loadTrips, 30000);
    return () => clearInterval(statusPoll);
  }, [loadTrips]);

  // All trips for conflict checking (list + timetable for today)
  const allTrips = useMemo(() => {
    const seen = new Set();
    return [...trips, ...timetableTrips].filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  }, [trips, timetableTrips]);

  // Prefer server-side conflicts; fall back to client-side detection if server returns nothing
  const clientConflicts = useMemo(() => detectConflicts(timetableTrips), [timetableTrips]);
  const conflicts = (serverConflicts !== null && serverConflicts.length > 0)
    ? serverConflicts
    : (serverConflicts !== null ? serverConflicts : clientConflicts);

  const stats = {
    all:       trips.length,
    ongoing:   trips.filter(t => t.status?.toLowerCase() === "ongoing").length,
    delayed:   trips.filter(t => t.status?.toLowerCase() === "delayed").length,
    completed: trips.filter(t => t.status?.toLowerCase() === "completed").length,
  };

  async function handleSaveTrip(form) {
    const isEdit = tripModal && tripModal !== false;
    const start_time = form.date && form.time
      ? `${form.date}T${form.time}:00.000Z`
      : null;
    const end_time = form.date && form.end_time
      ? `${form.date}T${form.end_time}:00.000Z`
      : null;

    if (isEdit) {
      try {
        await updateTrip(tripModal.id, {
          route_id:         form.route_id   ?? null,
          driver_id:        form.driver_id  ?? null,
          vehicle_id:       form.vehicle_id ?? null,
          start_time,
          end_time,
          status:           form.status.toLowerCase(),
          price:            form.price !== "" && form.price != null ? Number(form.price) : null,
          carpool_discount: form.carpool_discount !== "" && form.carpool_discount != null ? Number(form.carpool_discount) : null,
        });
        loadTrips();
        loadConflicts();
        return null;
      } catch (err) {
        return err?.message ?? "Failed to update trip.";
      }
    } else {
      try {
        await createTrip({
          route_id:   form.route_id   ?? null,
          driver_id:  form.driver_id  ?? null,
          vehicle_id: form.vehicle_id ?? null,
          start_time,
          end_time,
          status:     form.status.toLowerCase(),
          price:            form.price !== "" && form.price != null ? Number(form.price) : null,
          carpool_discount: form.carpool_discount !== "" && form.carpool_discount != null ? Number(form.carpool_discount) : null,
        });
        loadTrips();
        if (form.recurrence !== "none") {
          const nr = { id: Date.now(), route: form.route, driver: form.driver, vehicle: form.vehicle, time: form.time, recurrence: form.recurrence, days: form.days, status: "Active", active_from: form.date, next_run: form.date };
          setRecurring(prev => [nr, ...prev]);
          createRecurringSchedule(nr).catch(() => {});
        }
        return null;
      } catch (err) {
        return err?.message ?? "Failed to create trip.";
      }
    }
  }

  function handleResolve(conflictTrip) {
    // Server conflicts now include route_id/driver_id/vehicle_id directly.
    // For client-side conflicts (timetableTrips), look up the normalized trip first.
    const fromList = allTrips.find(t => Number(t.id) === Number(conflictTrip.id));
    setTripModal(fromList ?? conflictTrip);
    // Modal renders at the top level — no tab switch needed
  }

  const tabs = [
    { id: "trips",     label: "Trips",      badge: stats.delayed },
    { id: "timetable", label: "Timetable",  badge: 0 },
    { id: "recurring", label: "Recurring",  badge: 0 },
    { id: "conflicts", label: "Conflicts",  badge: conflicts.length },
    { id: "delays",    label: "Delays",     badge: delays.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Trips</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {trips.length} trips · {stats.delayed} with delayed status · {delays.length} delay report{delays.length !== 1 ? "s" : ""} · {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <ExportBtn
          rows={trips}
          columns={[
            { key: "id",      label: "Trip ID"   },
            { key: "route",   label: "Route"     },
            { key: "driver",  label: "Driver"    },
            { key: "vehicle", label: "Vehicle"   },
            { key: "date",    label: "Date"      },
            { key: "time",    label: "Time"      },
            { key: "status",  label: "Status"    },
          ]}
          filename={`trips-${new Date().toISOString().slice(0,10)}.csv`}
          title="Trips Report"
        />
        <button onClick={() => setTripModal(false)} style={{
          background: "#6D28D9", color: "#fff", border: "none",
          borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          + Create trip
        </button>
        <TabNav tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total Trips"      value={stats.all}        delta="all trips loaded"          accent="#6D28D9" icon={<CalendarDays size={18} color="#6D28D9" />} />
        <StatCard label="Ongoing"          value={stats.ongoing}    delta="currently running"          accent="#10B981" icon={<Play size={18} color="#10B981" />} />
        <StatCard label="Delayed Status"   value={stats.delayed}    delta="trips marked as delayed"    up={stats.delayed === 0} accent="#F59E0B" icon={<Clock size={18} color="#F59E0B" />} />
        <StatCard label="Completed"        value={stats.completed}  delta="finished trips"             up accent="#059669" icon={<CheckCircle2 size={18} color="#059669" />} />
        <StatCard label="Delay Reports"    value={delays.length}    delta="logged delay incidents"     up={delays.length === 0} accent="#EF4444" icon={<AlertTriangle size={18} color="#EF4444" />} />
      </div>

      {/* Tab content */}
      {tab === "trips" && (
        tripsLoading
          ? <PageLoading message="Loading trips…" />
          : tripsError
          ? <PageError message={tripsError} onRetry={loadTrips} />
          : <TripsListTab trips={trips} allTrips={allTrips} onAdd={() => setTripModal(false)} onEdit={t => setTripModal(t)} onDetail={t => setDetailTrip(t)} />
      )}
      {tab === "timetable" && <TimetableTab routeOpts={routeOpts} />}
      {tab === "recurring" && (
        <RecurringTab
          recurring={recurring}
          onAdd={r  => setRecurring(prev => [r, ...prev])}
          onEdit={r  => setRecurring(prev => prev.map(p => p.id === r.id ? r : p))}
          onDelete={id => setRecurring(prev => prev.filter(r => r.id !== id))}
          onToggle={id => setRecurring(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "Active" ? "Paused" : "Active" } : r))}
          routeOpts={routeOpts}
          driverOpts={driverOpts}
          vehicleOpts={vehicleOpts}
        />
      )}
      {tab === "conflicts" && <ConflictsTab conflicts={conflicts} onResolve={handleResolve} />}
      {tab === "delays" && (
        <DelaysTab
          delays={delays}
          loading={delaysLoading}
          error={delaysError}
          onRetry={() => {
            setDelaysLoading(true);
            setDelaysError(null);
            getTripDelays()
              .then(d => setDelays(Array.isArray(d) ? d : []))
              .catch(err => setDelaysError(err?.message ?? "Could not load delay reports"))
              .finally(() => setDelaysLoading(false));
          }}
        />
      )}

      {/* Trip detail drawer */}
      {detailTrip && (
        <TripDetailDrawer
          trip={detailTrip}
          onClose={() => setDetailTrip(null)}
          onEdit={t => { setDetailTrip(null); setTripModal(t); }}
        />
      )}

      {/* Create / Edit modal */}
      {tripModal !== null && (
        <TripModal
          trip={tripModal || null}
          allTrips={allTrips}
          onClose={() => setTripModal(null)}
          onSave={handleSaveTrip}
          routeOpts={routeOpts}
          driverOpts={driverOpts}
          vehicleOpts={vehicleOpts}
        />
      )}
    </div>
  );
}

