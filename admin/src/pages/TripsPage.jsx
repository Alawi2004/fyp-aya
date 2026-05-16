import { useState, useEffect, useMemo, useCallback } from "react";
import { PageLoading, PageError } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import {
  getTrips, createTrip, updateTripStatus,
  getTimetableTrips, getRecurringSchedules,
  createRecurringSchedule, updateRecurringSchedule, deleteRecurringSchedule,
  getTripConflicts, getTripDelays, getTripStopArrivals,
} from "../api/endpoints";
import {
  MOCK_TRIPS, MOCK_TIMETABLE_TRIPS, MOCK_RECURRING_SCHEDULES,
  MOCK_ROUTES, MOCK_DRIVERS, MOCK_VEHICLES,
} from "../data/mockData";

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

const ROUTE_DURATIONS = {
  "Route 12A": 55,
  "Route 7B":  80,
  "Route 3C":  90,
  "Route 5D":  75,
  "Route 9E":  110,
};

const STATUS_COLORS = {
  Completed: { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  Ongoing:   { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  Delayed:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  Scheduled: { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  Cancelled: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
};

const TODAY = "2026-05-06";

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeTrip(t) {
  const dt = t.start_time ? new Date(t.start_time) : null;
  return {
    id:      t.trip_id ?? t.id,
    route:   t.route_name ?? t.route ?? "",
    driver:  t.driver_name ?? t.driver ?? "",
    vehicle: t.plate_number ?? t.vehicle ?? "",
    seats:   t.seats ?? `0/${t.capacity ?? 30}`,
    date:    dt ? dt.toISOString().split("T")[0] : (t.date ?? ""),
    time:    dt ? dt.toTimeString().slice(0, 5) : (t.time ?? ""),
    status:  t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Scheduled",
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
      const aS = timeToMin(a.time), aE = aS + (ROUTE_DURATIONS[a.route] ?? 60);
      const bS = timeToMin(b.time), bE = bS + (ROUTE_DURATIONS[b.route] ?? 60);
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
  const fE = fS + (ROUTE_DURATIONS[form.route] ?? 60);
  allTrips
    .filter(t => t.date === form.date && t.id !== excludeId)
    .forEach(t => {
      const tS = timeToMin(t.time), tE = tS + (ROUTE_DURATIONS[t.route] ?? 60);
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
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(({ id, label, badge }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 18px", borderRadius: 7, border: "none",
          fontSize: 13, fontWeight: active === id ? 700 : 500, cursor: "pointer",
          background: active === id ? "#fff" : "transparent",
          color:      active === id ? "#2563EB" : "#64748B",
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

// ── Create / Edit Trip Modal (with conflict check + recurring) ────────────────
function TripModal({ trip, allTrips, onClose, onSave }) {
  const isEdit = Boolean(trip);
  const EMPTY  = { route: "", driver: "", vehicle: "", date: TODAY, time: "", status: "Scheduled", recurrence: "none", days: [] };

  const [form,       setForm]       = useState(isEdit ? { ...trip, recurrence: "none", days: [] } : EMPTY);
  const [warnings,   setWarnings]   = useState([]);

  const routeNames   = MOCK_ROUTES.map(r => r.name);
  const driverNames  = MOCK_DRIVERS.map(d => d.name);
  const vehiclePlates = [...new Set(MOCK_VEHICLES.filter(v => v.status === "Active").map(v => v.plate))];

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    setWarnings(checkFormConflicts(form, allTrips, trip?.id));
  }, [form.driver, form.vehicle, form.date, form.time, form.route]);

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  }

  function handleSave() {
    if (!form.date || !form.time || !form.route) return;
    onSave(form);
    onClose();
  }

  const field = (label, key, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 13 }}>
      <label style={lbl}>{label}</label>
      <input type={type} placeholder={placeholder} value={form[key]}
        onChange={e => set(key)(e.target.value)}
        style={inp} />
    </div>
  );

  return (
    <Modal title={isEdit ? "Edit Trip" : "Create New Trip"} onClose={onClose} onSave={handleSave}>
      {/* Conflict warnings */}
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

      {/* Route select */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Route</label>
        <select value={form.route} onChange={e => set("route")(e.target.value)} style={inp}>
          <option value="">— Select route —</option>
          {routeNames.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Driver select */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Driver</label>
        <select value={form.driver} onChange={e => set("driver")(e.target.value)} style={inp}>
          <option value="">— Select driver —</option>
          {driverNames.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Vehicle select */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Vehicle</label>
        <select value={form.vehicle} onChange={e => set("vehicle")(e.target.value)} style={inp}>
          <option value="">— Select vehicle —</option>
          {vehiclePlates.map(v => <option key={v}>{v}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" value={form.date} onChange={e => set("date")(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Departure Time</label>
          <input type="time" value={form.time} onChange={e => set("time")(e.target.value)} style={inp} />
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Status</label>
        <select value={form.status} onChange={e => set("status")(e.target.value)} style={inp}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Recurring */}
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

// ── Tab 1: Trips list ─────────────────────────────────────────────────────────
function TripsListTab({ trips, allTrips, onAdd, onEdit, onDetail }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = trips.filter(t => {
    const matchStatus = filter === "All" || t.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.route.toLowerCase().includes(q) || t.driver.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const columns = [
    {
      key: "id", label: "Trip ID",
      render: v => <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#2563EB", fontSize: 12 }}>{v}</span>,
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
            fontSize: 11, color: "#2563EB", background: "#EFF6FF",
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
              background: filter === s ? "#2563EB" : "#fff",
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

function TimetableTab({ timetableTrips }) {
  const [date,       setDate]       = useState(TODAY);
  const [routeFilter,setRouteFilter]= useState("All");
  const [tooltip,    setTooltip]    = useState(null);

  const routes = MOCK_ROUTES.map(r => r.name);

  const dayTrips = timetableTrips.filter(t => t.date === date &&
    (routeFilter === "All" || t.route === routeFilter));

  const hours = [];
  for (let m = GRID_START; m <= GRID_END; m += 60) {
    hours.push(`${String(m / 60).padStart(2, "0")}:00`);
  }

  function tripLeft(t)  { return Math.max(0, (timeToMin(t.time) - GRID_START) / 30 * SLOT_W); }
  function tripWidth(t) { return Math.max(SLOT_W, (ROUTE_DURATIONS[t.route] ?? 60) / 30 * SLOT_W); }

  const visibleRoutes = routeFilter === "All" ? routes : [routeFilter];
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
          {["All", ...routes].map(r => (
            <button key={r} onClick={() => setRouteFilter(r)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: routeFilter === r ? "none" : "1px solid #E2E8F0",
              background: routeFilter === r ? "#2563EB" : "#fff",
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
        {dayTrips.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>
            No trips scheduled for this date. Try {TODAY}.
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "visible" }}>
            <div style={{ minWidth: LABEL_W + totalW + 24 }}>
              {/* Hour header */}
              <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9", background: "#FAFAFA" }}>
                <div style={{ width: LABEL_W, flexShrink: 0, padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>Route</div>
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
                const routeInfo  = MOCK_ROUTES.find(r => r.name === route);
                return (
                  <div key={route} style={{
                    display: "flex", alignItems: "center",
                    borderBottom: ri < visibleRoutes.length - 1 ? "1px solid #F8FAFC" : "none",
                    background: ri % 2 === 0 ? "#fff" : "#FAFAFA",
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
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>🕐 {tooltip.t.time} ({ROUTE_DURATIONS[tooltip.t.route]} min)</div>
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>👤 {tooltip.t.driver}</div>
          <div style={{ color: "#94A3B8", marginBottom: 2 }}>🚌 {tooltip.t.vehicle}</div>
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
const RECURRENCE_BADGE = {
  daily:    { label: "Daily",    bg: "#EFF6FF", color: "#2563EB" },
  weekdays: { label: "Weekdays", bg: "#F0FDF4", color: "#059669" },
  weekends: { label: "Weekends", bg: "#F5F3FF", color: "#7C3AED" },
  custom:   { label: "Custom",   bg: "#FFFBEB", color: "#D97706" },
};

function RecurringTab({ recurring, onAdd, onEdit, onDelete, onToggle }) {
  const [modal, setModal] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [form, setForm] = useState({ route: "", driver: "", vehicle: "", time: "", recurrence: "daily", days: [], status: "Active" });

  const routeNames    = MOCK_ROUTES.map(r => r.name);
  const driverNames   = MOCK_DRIVERS.map(d => d.name);
  const vehiclePlates = MOCK_VEHICLES.filter(v => v.status === "Active").map(v => v.plate);

  function openAdd()   { setEditRec(null); setForm({ route: "", driver: "", vehicle: "", time: "", recurrence: "daily", days: [], status: "Active" }); setModal(true); }
  function openEdit(r) { setEditRec(r); setForm({ route: r.route, driver: r.driver, vehicle: r.vehicle, time: r.time, recurrence: r.recurrence, days: r.days ?? [], status: r.status }); setModal(true); }

  function handleSave() {
    if (!form.route || !form.driver || !form.time) return;
    if (editRec) {
      onEdit({ ...editRec, ...form });
      updateRecurringSchedule(editRec.id, form).catch(() => {});
    } else {
      const nr = { id: Date.now(), ...form, active_from: TODAY, next_run: TODAY };
      onAdd(nr);
      createRecurringSchedule(form).catch(() => {});
    }
    setModal(false);
  }

  function toggleDay(day) { setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] })); }

  const inp2 = { ...inp, marginTop: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Recurring Schedule
        </button>
      </div>

      <Panel title={`${recurring.length} recurring schedules`} noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
              {["Route", "Driver", "Vehicle", "Departs", "Recurrence", "Days", "Next Run", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recurring.map((r, i) => {
              const rb = RECURRENCE_BADGE[r.recurrence] || RECURRENCE_BADGE.daily;
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.route}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{r.driver}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: "#2563EB", fontWeight: 600 }}>{r.vehicle}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{r.time}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rb.bg, color: rb.color }}>{rb.label}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {r.recurrence === "custom" && r.days?.length > 0
                      ? <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {r.days.map(d => <span key={d} style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5, background: "#EFF6FF", color: "#2563EB" }}>{d}</span>)}
                        </div>
                      : <span style={{ fontSize: 11, color: "#94A3B8" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748B" }}>{r.next_run}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusPill status={r.status === "Active" ? "Active" : "Inactive"} />
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(r)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => { onToggle(r.id); updateRecurringSchedule(r.id, { status: r.status === "Active" ? "Paused" : "Active" }).catch(() => {}); }}
                        style={{ fontSize: 11, color: r.status === "Active" ? "#D97706" : "#059669", background: r.status === "Active" ? "#FFFBEB" : "#ECFDF5", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>
                        {r.status === "Active" ? "Pause" : "Resume"}
                      </button>
                      <button onClick={() => { onDelete(r.id); deleteRecurringSchedule(r.id).catch(() => {}); }}
                        style={{ fontSize: 11, color: "#DC2626", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recurring.length === 0 && (
              <tr><td colSpan={9} style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No recurring schedules. Click "+ New Recurring Schedule" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>

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
                  background: form.recurrence === r ? "#2563EB" : "#F1F5F9",
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
                    background: form.days.includes(d) ? "#2563EB" : "#F1F5F9",
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
              const icon   = isDriver ? "👤" : "🚌";
              return (
                <div key={i} style={{ padding: "14px 16px", background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
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
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 3, fontFamily: "monospace" }}>{t.id}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>🕐 {t.time} ({ROUTE_DURATIONS[t.route] ?? "?"} min)</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>👤 {t.driver} · 🚌 {t.vehicle}</div>
                        <div style={{ marginTop: 6 }}><StatusPill status={t.status} /></div>
                      </div>
                    ) : [
                      <div key="sep" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, color: color }}>⟺</div>
                        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>overlap</div>
                      </div>,
                      <div key={1} style={{ background: "#fff", borderRadius: 9, padding: "10px 12px", border: "1px solid #F1F5F9" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", marginBottom: 3, fontFamily: "monospace" }}>{t.id}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>🕐 {t.time} ({ROUTE_DURATIONS[t.route] ?? "?"} min)</div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>👤 {t.driver} · 🚌 {t.vehicle}</div>
                        <div style={{ marginTop: 6 }}><StatusPill status={t.status} /></div>
                      </div>,
                    ])}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => onResolve(c.a)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
                      Edit {c.a.id}
                    </button>
                    <button onClick={() => onResolve(c.b)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
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

const MOCK_TRIP_DELAYS = [
  { delay_id: 1, trip_id: 41, trip_ref: "TRP-041", route: "Route 12A", driver: "Karim Moussa",   vehicle: "BUS-01", reason: "Traffic",            delay_minutes: 15, notes: "Heavy traffic near downtown intersection",          reported_at: "2026-05-15T08:22:00", affected_passengers: 24 },
  { delay_id: 2, trip_id: 38, trip_ref: "TRP-038", route: "Route 7B",  driver: "Sara Khoury",    vehicle: "BUS-07", reason: "Road Block",          delay_minutes: 30, notes: "Police checkpoint at Jounieh highway",              reported_at: "2026-05-15T09:45:00", affected_passengers: 18 },
  { delay_id: 3, trip_id: 29, trip_ref: "TRP-029", route: "Route 3C",  driver: "Joe Pharaon",    vehicle: "BUS-09", reason: "Mechanical",          delay_minutes: 45, notes: "Engine warning light — waiting for inspection",     reported_at: "2026-05-15T10:10:00", affected_passengers: 30 },
  { delay_id: 4, trip_id: 33, trip_ref: "TRP-033", route: "Route 5D",  driver: "Maya Salameh",   vehicle: "BUS-02", reason: "Passenger Incident",  delay_minutes: 10, notes: "Medical situation onboard, waiting for paramedics", reported_at: "2026-05-14T14:30:00", affected_passengers: 11 },
  { delay_id: 5, trip_id: 45, trip_ref: "TRP-045", route: "Route 9E",  driver: "Lara Abi Nader", vehicle: "BUS-05", reason: "Traffic",             delay_minutes: 20, notes: null,                                               reported_at: "2026-05-14T16:55:00", affected_passengers: 22 },
];

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
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#2563EB", lineHeight: 1 }}>{totalAffected}</div>
          <div style={{ fontSize: 12, color: "#1D4ED8", marginTop: 6, fontWeight: 600 }}>Passengers Affected</div>
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
              background:  reasonFilter === r ? "#2563EB" : "#fff",
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
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
              {["Trip", "Route", "Driver", "Vehicle", "Reason", "Delay", "Notes", "Reported At", "Passengers"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((d, i) => {
              const rc = DELAY_REASON_COLORS[d.reason] ?? DELAY_REASON_COLORS["Other"];
              return (
                <tr key={d.delay_id} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563EB", fontSize: 12 }}>{d.trip_ref}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{d.route}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{d.driver}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: "#2563EB", fontWeight: 600 }}>{d.vehicle}</td>
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
  early:    { label: "Early",    bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE", icon: "↑" },
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
              <button onClick={() => { onClose(); onEdit(trip); }} style={{ background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#2563EB", fontSize: 12, fontWeight: 600 }}>
                Edit Trip
              </button>
              <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* Trip ID + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#EFF6FF", border: "2px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🚌</div>
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
              <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
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
                            <div style={{ fontSize: 11, color: a.delay_seconds > 0 ? "#DC2626" : a.delay_seconds < 0 ? "#2563EB" : "#059669", marginTop: 3, fontWeight: 600 }}>
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
  const [delays,          setDelays]          = useState([]);
  const [delaysLoading,   setDelaysLoading]   = useState(true);
  const [delaysError,     setDelaysError]     = useState(null);
  const [detailTrip,      setDetailTrip]      = useState(null);

  const loadTrips = useCallback(() => {
    setTripsLoading(true);
    setTripsError(null);
    getTrips()
      .then(d => {
        const rows = d?.data ?? d;
        setTrips((rows || []).map(normalizeTrip));
      })
      .catch(err => {
        setTrips(MOCK_TRIPS);
        setTripsError(err?.message ?? "Could not reach server — showing demo data");
      })
      .finally(() => setTripsLoading(false));
  }, []);

  useEffect(() => {
    loadTrips();

    getTimetableTrips(TODAY)
      .then(d => setTimetableTrips((d || []).length ? d : MOCK_TIMETABLE_TRIPS))
      .catch(() => setTimetableTrips(MOCK_TIMETABLE_TRIPS));

    getRecurringSchedules()
      .then(d => setRecurring((d || []).length ? d : MOCK_RECURRING_SCHEDULES))
      .catch(() => setRecurring(MOCK_RECURRING_SCHEDULES));

    getTripConflicts()
      .then(d => setServerConflicts(Array.isArray(d) ? d : null))
      .catch(() => setServerConflicts(null));

    getTripDelays()
      .then(d => setDelays(Array.isArray(d) ? d : MOCK_TRIP_DELAYS))
      .catch(() => setDelays(MOCK_TRIP_DELAYS))
      .finally(() => setDelaysLoading(false));
  }, []);

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
    ongoing:   trips.filter(t => t.status === "Ongoing").length,
    delayed:   trips.filter(t => t.status === "Delayed").length,
    completed: trips.filter(t => t.status === "Completed").length,
  };

  function handleSaveTrip(form) {
    const isEdit = tripModal && tripModal !== false;
    if (isEdit) {
      updateTripStatus(tripModal.id, form.status.toLowerCase()).catch(() => {});
      setTrips(prev => prev.map(t => t.id === tripModal.id ? { ...t, ...form } : t));
      setTimetableTrips(prev => prev.map(t => t.id === tripModal.id ? { ...t, ...form } : t));
    } else {
      createTrip({ start_time: `${form.date}T${form.time}:00`, status: form.status.toLowerCase() }).catch(() => {});
      const newTrip = { id: `TRP-${String(Date.now()).slice(-4)}`, ...form, seats: "0/30" };
      setTrips(prev => [newTrip, ...prev]);
      if (form.date === TODAY) setTimetableTrips(prev => [newTrip, ...prev]);
      // Create recurring schedule if needed
      if (form.recurrence !== "none") {
        const nr = { id: Date.now(), route: form.route, driver: form.driver, vehicle: form.vehicle, time: form.time, recurrence: form.recurrence, days: form.days, status: "Active", active_from: form.date, next_run: form.date };
        setRecurring(prev => [nr, ...prev]);
        createRecurringSchedule(nr).catch(() => {});
      }
    }
  }

  function handleResolve(trip) {
    setTripModal(trip);
    setTab("trips");
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
            {trips.length} trips · {recurring.length} recurring · {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} · {delays.length} delay{delays.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setTripModal(false)} style={{
          background: "#2563EB", color: "#fff", border: "none",
          borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          + Create trip
        </button>
        <TabNav tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total Trips"  value={stats.all}       delta="loaded"        accent="#2563EB" />
        <StatCard label="Ongoing"      value={stats.ongoing}   delta="in progress"   accent="#10B981" />
        <StatCard label="Delayed"      value={stats.delayed}   delta="need attention" up={stats.delayed === 0} accent="#F59E0B" />
        <StatCard label="Completed"    value={stats.completed} delta="today"          up accent="#059669" />
        <StatCard label="Conflicts"    value={conflicts.length} delta="detected today" up={conflicts.length === 0} accent="#EF4444" />
      </div>

      {/* Tab content */}
      {tab === "trips" && (
        tripsLoading
          ? <PageLoading message="Loading trips…" />
          : tripsError
          ? <PageError message={tripsError} onRetry={loadTrips} />
          : <TripsListTab trips={trips} allTrips={allTrips} onAdd={() => setTripModal(false)} onEdit={t => setTripModal(t)} onDetail={t => setDetailTrip(t)} />
      )}
      {tab === "timetable" && <TimetableTab  timetableTrips={timetableTrips} />}
      {tab === "recurring" && (
        <RecurringTab
          recurring={recurring}
          onAdd={r  => setRecurring(prev => [r, ...prev])}
          onEdit={r  => setRecurring(prev => prev.map(p => p.id === r.id ? r : p))}
          onDelete={id => setRecurring(prev => prev.filter(r => r.id !== id))}
          onToggle={id => setRecurring(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "Active" ? "Paused" : "Active" } : r))}
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
              .then(d => setDelays(Array.isArray(d) ? d : MOCK_TRIP_DELAYS))
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
        />
      )}
    </div>
  );
}
