import { useState, useEffect, useRef, useCallback } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import {
  getVehicles, createVehicle, updateVehicle,
  getVehicleDocs, updateVehicleDocs,
  getMaintenanceLog, addMaintenanceRecord,
  getFuelLog, addFuelRecord,
  getVehiclePhotos, uploadVehiclePhoto, deleteVehiclePhotoApi,
} from "../api/endpoints";
import { PageLoading, PageError, PageEmpty } from "../components/DataStates";
import { MOCK_VEHICLES, MOCK_VEHICLE_DOCS, MOCK_MAINTENANCE_LOG, MOCK_FUEL_LOG } from "../data/mockData";

// ── Constants ─────────────────────────────────────────────────────────────────
const TODAY            = new Date("2026-05-10");
const VEHICLE_STATUSES = ["Active", "Maintenance", "Inactive"];
const VEHICLE_TYPES    = ["Bus", "Minibus", "Van", "Taxi"];
const SERVICE_TYPES    = ["Oil Change", "Tire Rotation", "Brake Check", "Engine Service", "Full Inspection", "AC Service", "Body Work", "Other"];
const AVAILABLE_DRIVERS = ["Karim Moussa","Lara Abi Nader","Joe Pharaon","Maya Salameh","Rami Khoury","Sara Khoury","Fadi Gemayel","Hassan Nasser","Nadia Haddad","Ziad Mansour"];

const STATUS_STYLE = {
  Active:      { bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
  Maintenance: { bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
  Inactive:    { bg: "#F1F5F9", color: "#64748B", dot: "#94A3B8" },
};

const TYPE_ICON = { Bus: "🚌", Minibus: "🚐", Van: "🚐", Taxi: "🚕", Sedan: "🚗" };
const TYPE_STYLE = {
  Bus:     { bg: "#EFF6FF", color: "#1E40AF" },
  Minibus: { bg: "#F5F3FF", color: "#7C3AED" },
  Van:     { bg: "#ECFDF5", color: "#059669" },
  Taxi:    { bg: "#FFFBEB", color: "#D97706" },
  Sedan:   { bg: "#FEF2F2", color: "#DC2626" },
};

const PHOTO_SLOTS = [
  { key: "exterior", label: "Exterior", icon: "📸", hint: "Front/side view" },
  { key: "interior", label: "Interior", icon: "💺", hint: "Passenger area"  },
  { key: "plate",    label: "Plate",    icon: "🔢", hint: "License plate"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeVehicle(v) {
  return {
    id:          v.vehicle_id ?? v.id,
    plate:       v.plate_number ?? v.plate ?? "",
    type:        v.type ?? (v.vehicle_type === "bus" ? "Bus" : "Bus"),
    model:       v.model ?? "",
    year:        v.year ?? "",
    capacity:    v.capacity ?? 0,
    status:      v.status ?? "Active",
    driver:      v.driver ?? "—",
    lastService: v.last_service ?? v.lastService ?? "—",
    km:          v.km ?? 0,
  };
}

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] || TYPE_STYLE.Bus;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {TYPE_ICON[type] ?? "🚌"} {type}
    </span>
  );
}

function daysUntil(dateStr) {
  return Math.floor((new Date(dateStr) - TODAY) / 86400000);
}

function expiryBadge(dateStr) {
  if (!dateStr) return null;
  const d = daysUntil(dateStr);
  if (d < 0)  return { label: `Expired ${Math.abs(d)}d ago`, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", level: "expired"  };
  if (d <= 14) return { label: `${d}d left`,                  color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", level: "critical" };
  if (d <= 30) return { label: `${d}d left`,                  color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", level: "warning"  };
  return              { label: `${d}d left`,                  color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", level: "ok"       };
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(({ id, label, badge }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: active === id ? 700 : 500,
          background: active === id ? "#fff" : "transparent",
          color:      active === id ? "#2563EB" : "#64748B",
          boxShadow:  active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
        }}>
          {label}
          {badge > 0 && (
            <span style={{ background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>{badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function VehicleStatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Inactive;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VEHICLE PROFILE DRAWER
// ══════════════════════════════════════════════════════════════════════════════
function VehicleProfile({ vehicle, docs, mlog, fuelLog, photos, onClose, onEdit, onPhotoUpload, onPhotoRemove, onAddRecord }) {
  const doc     = docs.find(d => d.plate === vehicle.plate) ?? {};
  const history = [...mlog].filter(r => r.plate === vehicle.plate).sort((a, b) => new Date(b.date) - new Date(a.date));
  const fuelHistory = [...fuelLog].filter(r => r.plate === vehicle.plate).sort((a, b) => new Date(b.date) - new Date(a.date));
  const ts      = TYPE_STYLE[vehicle.type] || TYPE_STYLE.Bus;
  const icon    = TYPE_ICON[vehicle.type] ?? "🚌";

  const docItems = [
    { label: "Registration",   expiry: doc.reg_expiry  },
    { label: "Insurance",      expiry: doc.ins_expiry  },
    { label: "Roadworthiness", expiry: doc.road_expiry },
  ];

  const worstDoc = docItems
    .map(d => ({ ...d, badge: expiryBadge(d.expiry) }))
    .filter(d => d.badge && d.badge.level !== "ok")
    .sort((a, b) => ({ expired: 0, critical: 1, warning: 2 }[a.badge.level] ?? 9) - ({ expired: 0, critical: 1, warning: 2 }[b.badge.level] ?? 9))[0];

  // Inline add-record form state
  const [addingRecord, setAddingRecord] = useState(false);
  const EMPTY_REC = { date: "", type: "Oil Change", mechanic: "", cost: "", odometer: "", notes: "", next_service: "" };
  const [recForm, setRecForm] = useState(EMPTY_REC);

  function handleAddRecord() {
    if (!recForm.date || !recForm.mechanic) return;
    onAddRecord({ id: Date.now(), plate: vehicle.plate, ...recForm, cost: parseFloat(recForm.cost) || 0, odometer: parseInt(recForm.odometer) || 0 });
    setRecForm(EMPTY_REC);
    setAddingRecord(false);
  }

  // Photo helpers
  const fileRefs = useRef({});
  function photoKey(slot) { return `${vehicle.plate}-${slot}`; }

  const totalCost = history.reduce((s, r) => s + (r.cost ?? 0), 0);
  const nextService = history.find(r => r.next_service)?.next_service;
  const totalFuelCost = fuelHistory.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
  const totalFuelLiters = fuelHistory.reduce((sum, row) => sum + (Number(row.liters) || 0), 0);
  const fuelEfficiency = (() => {
    const ordered = [...fuelHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    let kmTravelled = 0;
    let litersUsed = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      kmTravelled += Math.max(0, (Number(ordered[i].odometer) || 0) - (Number(ordered[i - 1].odometer) || 0));
      litersUsed += Number(ordered[i].liters) || 0;
    }
    return { kmTravelled, litersUsed, kmPerLiter: litersUsed > 0 ? kmTravelled / litersUsed : 0 };
  })();
  const photoCount = PHOTO_SLOTS.filter(slot => Boolean(photos[photoKey(slot.key)])).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px);opacity:0 } to { transform:none;opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />

      <div style={{ width: "min(95vw, 660px)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,.14)", overflowY: "auto", animation: "slideInRight .25s ease" }}>

        {/* ── Header ── */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", flexShrink: 0, background: ts.bg + "66" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Vehicle Profile</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onClose(); onEdit(vehicle); }} style={{ background: "#fff", border: `1px solid ${ts.color}44`, borderRadius: 8, padding: "5px 14px", cursor: "pointer", color: ts.color, fontSize: 12, fontWeight: 700 }}>
                Edit Vehicle
              </button>
              <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15 }}>✕</button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, flexShrink: 0, background: "#fff", border: `2px solid ${ts.color}30`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, boxShadow: `0 4px 14px ${ts.color}18` }}>
              <span style={{ fontSize: 30 }}>{icon}</span>
              <span style={{ fontSize: 8, fontWeight: 800, color: ts.color, letterSpacing: ".06em" }}>{vehicle.plate}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-.4px", marginBottom: 4 }}>{vehicle.plate}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>{vehicle.model} · {vehicle.year}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <TypeBadge type={vehicle.type} />
                <VehicleStatusPill status={vehicle.status} />
                {worstDoc && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: worstDoc.badge.bg, color: worstDoc.badge.color, border: `1px solid ${worstDoc.badge.border}` }}>
                    ⚠ {worstDoc.label} expiring
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Key Details ── */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <SectionLabel>Vehicle Details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "Type",         value: `${icon} ${vehicle.type}` },
              { label: "Capacity",     value: `${vehicle.capacity} seats` },
              { label: "Year",         value: vehicle.year        },
              { label: "Odometer",     value: vehicle.km ? `${vehicle.km.toLocaleString()} km` : "—" },
              { label: "Last Service", value: fmtDate(vehicle.lastService) },
              { label: "Assigned Driver", value: vehicle.driver   },
            ].map(({ label, value }) => (
              <InfoTile key={label} label={label} value={value || "—"} />
            ))}
          </div>
          {nextService && (
            <div style={{ marginTop: 10, padding: "9px 14px", borderRadius: 9, background: expiryBadge(nextService)?.bg ?? "#F8FAFC", border: `1px solid ${expiryBadge(nextService)?.border ?? "#E2E8F0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>🔧 Next scheduled service</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>{fmtDate(nextService)}</span>
                {expiryBadge(nextService) && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,.7)", color: expiryBadge(nextService).color }}>{expiryBadge(nextService).label}</span>}
              </div>
            </div>
          )}
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <InfoTile label="Photos" value={`${photoCount}/${PHOTO_SLOTS.length}`} />
            <InfoTile label="Fuel Entries" value={fuelHistory.length} />
            <InfoTile label="Fuel Spend" value={`$${totalFuelCost.toFixed(0)}`} />
            <InfoTile label="Fuel Efficiency" value={fuelEfficiency.kmPerLiter ? `${fuelEfficiency.kmPerLiter.toFixed(1)} km/L` : "â€”"} />
          </div>
        </div>

        {/* ── Document / Expiry Alerts ── */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <SectionLabel>Registration &amp; Insurance Documents</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docItems.map(({ label, expiry }) => {
              const badge = expiryBadge(expiry);
              const noDoc = !expiry;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: badge?.bg ?? "#F8FAFC", border: `1.5px solid ${badge?.border ?? "#E2E8F0"}`, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>
                      {label === "Registration" ? "📋" : label === "Insurance" ? "🛡️" : "🔍"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {noDoc ? (
                      <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>No date set</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: "#64748B" }}>Expires {fmtDate(expiry)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,.8)", color: badge?.color ?? "#059669", border: `1px solid ${badge?.border ?? "#A7F3D0"}` }}>
                          {badge?.label ?? "OK"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Maintenance Log ── */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <SectionLabel>
              Maintenance Log
              {history.length > 0 && <span style={{ fontWeight: 400, color: "#94A3B8", marginLeft: 6 }}>({history.length} records · total ${totalCost.toLocaleString()})</span>}
            </SectionLabel>
            <button onClick={() => setAddingRecord(a => !a)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: addingRecord ? "none" : "1px solid #E2E8F0", background: addingRecord ? "#FEF2F2" : "#EFF6FF", color: addingRecord ? "#DC2626" : "#2563EB", cursor: "pointer" }}>
              {addingRecord ? "✕ Cancel" : "+ Add Record"}
            </button>
          </div>

          {/* Inline add form */}
          {addingRecord && (
            <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>Date *</label>
                  <input type="date" value={recForm.date} onChange={e => setRecForm(p => ({ ...p, date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Service Type *</label>
                  <select value={recForm.type} onChange={e => setRecForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                    {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={lbl}>Mechanic *</label>
                  <input value={recForm.mechanic} onChange={e => setRecForm(p => ({ ...p, mechanic: e.target.value }))} placeholder="Workshop name" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Cost ($)</label>
                  <input type="number" value={recForm.cost} onChange={e => setRecForm(p => ({ ...p, cost: e.target.value }))} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Odometer (km)</label>
                  <input type="number" value={recForm.odometer} onChange={e => setRecForm(p => ({ ...p, odometer: e.target.value }))} placeholder="km" style={inp} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Next Service Date</label>
                  <input type="date" value={recForm.next_service} onChange={e => setRecForm(p => ({ ...p, next_service: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Notes</label>
                  <input value={recForm.notes} onChange={e => setRecForm(p => ({ ...p, notes: e.target.value }))} placeholder="Work done..." style={inp} />
                </div>
              </div>
              <button onClick={handleAddRecord} style={{ width: "100%", padding: "9px 0", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Save Record
              </button>
            </div>
          )}

          {history.length === 0 ? (
            <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "20px 0" }}>No maintenance records yet. Add the first one above.</div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map(r => {
                const nb = r.next_service ? expiryBadge(r.next_service) : null;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🔧</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{r.type}</span>
                        {r.next_service && nb && nb.level !== "ok" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: nb.bg, color: nb.color }}>Next: {nb.label}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{r.mechanic} {r.odometer ? `· ${r.odometer.toLocaleString()} km` : ""}</div>
                      {r.notes && <div style={{ fontSize: 10, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.notes}>{r.notes}</div>}
                      {r.next_service && <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Next service: {fmtDate(r.next_service)}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>{r.cost ? `$${r.cost.toLocaleString()}` : "—"}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{fmtDate(r.date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Photos ── */}
        <div style={{ padding: "16px 24px 24px" }}>
          <SectionLabel>Fuel Tracking</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <InfoTile label="Fill-Ups" value={fuelHistory.length} />
            <InfoTile label="Liters Logged" value={`${totalFuelLiters.toFixed(1)} L`} />
            <InfoTile label="KM Travelled" value={fuelEfficiency.kmTravelled ? `${fuelEfficiency.kmTravelled.toLocaleString()} km` : "â€”"} />
            <InfoTile label="Avg KM/L" value={fuelEfficiency.kmPerLiter ? fuelEfficiency.kmPerLiter.toFixed(1) : "â€”"} />
          </div>

          {fuelHistory.length === 0 ? (
            <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "12px 0 18px" }}>No fuel history logged for this vehicle yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 250, overflowY: "auto", marginBottom: 18 }}>
              {fuelHistory.map((row) => (
                <div key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{fmtDate(row.date)} {row.station ? `Â· ${row.station}` : ""}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{Number(row.liters || 0).toFixed(1)} L Â· {Number(row.odometer || 0).toLocaleString()} km</div>
                    {row.notes && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{row.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>${Number(row.cost || 0).toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Fuel fill-up</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <SectionLabel>Vehicle Photos</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {PHOTO_SLOTS.map(slot => {
              const key      = photoKey(slot.key);
              const photoUrl = photos[key];
              return (
                <div key={slot.key}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    {slot.icon} {slot.label}
                  </div>
                  {/* Photo box */}
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: `2px dashed ${photoUrl ? "#2563EB" : "#E2E8F0"}`, background: photoUrl ? "#000" : "#F8FAFC", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={slot.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ textAlign: "center", color: "#CBD5E1", fontSize: 11 }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>{slot.icon}</div>
                        <div>No photo</div>
                      </div>
                    )}
                    {/* Hover overlay */}
                    {photoUrl && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: 0, transition: "opacity .2s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0"}>
                        <button onClick={() => fileRefs.current[key]?.click()} style={{ padding: "5px 10px", background: "rgba(255,255,255,.9)", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Change</button>
                        <button onClick={() => onPhotoRemove(key)} style={{ padding: "5px 10px", background: "rgba(239,68,68,.9)", color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => fileRefs.current[key]?.click()} style={{ marginTop: 6, width: "100%", padding: "7px 0", border: `1px dashed ${photoUrl ? "#2563EB" : "#E2E8F0"}`, borderRadius: 8, background: photoUrl ? "#EFF6FF" : "#F8FAFC", color: photoUrl ? "#2563EB" : "#94A3B8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {photoUrl ? "✓ Change" : "Upload"}
                  </button>
                  <input type="file" accept="image/*" style={{ display: "none" }} ref={el => fileRefs.current[key] = el}
                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; onPhotoUpload(key, f); e.target.value = ""; }} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#CBD5E1", textAlign: "center" }}>
            Photos are stored in session only — connect backend storage to persist.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared info tile + section label (used in profile) ────────────────────────
function InfoTile({ label, value }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "10px 12px", border: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Fleet list
// ══════════════════════════════════════════════════════════════════════════════
function FleetTab({ vehicles, docs, onEdit, onDelete, onViewProfile }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter,   setTypeFilter]   = useState("All");
  const [search,       setSearch]       = useState("");

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    return (statusFilter === "All" || v.status === statusFilter)
        && (typeFilter   === "All" || v.type   === typeFilter)
        && (!q || v.plate.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q));
  });

  // Alert counts per vehicle (from docs)
  const alertMap = {};
  docs.forEach(d => {
    const alerts = [d.reg_expiry, d.ins_expiry, d.road_expiry].filter(x => x && daysUntil(x) <= 14).length;
    if (alerts > 0) alertMap[d.plate] = alerts;
  });

  const columns = [
    {
      key: "plate", label: "Vehicle",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: (TYPE_STYLE[row.type] || TYPE_STYLE.Bus).bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            {TYPE_ICON[row.type] ?? "🚌"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 13 }}>{v}</span>
              {alertMap[v] && (
                <span title={`${alertMap[v]} document(s) expiring soon`} style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: "#FEF2F2", color: "#DC2626" }}>⚠ {alertMap[v]}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.model} · {row.year}</div>
          </div>
        </div>
      ),
    },
    { key: "type",        label: "Type",       render: v => <TypeBadge type={v} /> },
    { key: "capacity",    label: "Capacity",   render: v => `${v} seats` },
    { key: "driver",      label: "Driver",     render: v => <span style={{ fontSize: 12, color: v === "—" ? "#CBD5E1" : "#0F172A" }}>{v}</span> },
    { key: "km",          label: "Odometer",   render: v => v ? `${v.toLocaleString()} km` : "—" },
    { key: "status",      label: "Status",     render: v => <VehicleStatusPill status={v} /> },
    {
      key: "id", label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); onViewProfile(row); }} style={{ fontSize: 11, color: "#7C3AED", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Profile</button>
          <button onClick={e => { e.stopPropagation(); onEdit(row); }}        style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete(row.id); }}   style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Search */}
      <input placeholder="Search plate, model, driver..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }} />

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["All", ...VEHICLE_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "5px 13px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            border: statusFilter === s ? "none" : "1px solid #E2E8F0",
            background: statusFilter === s ? "#2563EB" : "#fff",
            color:      statusFilter === s ? "#fff"    : "#64748B",
            fontWeight: statusFilter === s ? 600 : 400,
          }}>{s}</button>
        ))}
        <div style={{ width: 1, background: "#E2E8F0", margin: "0 4px" }} />
        {["All", ...VEHICLE_TYPES].map(t => {
          const ts = TYPE_STYLE[t];
          return (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: "5px 13px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: typeFilter === t ? "none" : "1px solid #E2E8F0",
              background: typeFilter === t ? (ts?.bg ?? "#EFF6FF") : "#fff",
              color:      typeFilter === t ? (ts?.color ?? "#2563EB") : "#64748B",
              fontWeight: typeFilter === t ? 700 : 400,
            }}>
              {t === "All" ? "All Types" : `${TYPE_ICON[t]} ${t}`}
            </button>
          );
        })}
      </div>

      <Panel title={`${filtered.length} vehicles`}>
        <DataTable columns={columns} rows={filtered} onRowClick={onViewProfile} />
        {filtered.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No vehicles match your filter.</div>
        )}
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Expiry Alerts
// ══════════════════════════════════════════════════════════════════════════════
function ExpiryAlertsTab({ docs, onUpdateDocs }) {
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState({});

  // Enrich docs with badge info
  const enriched = docs.map(d => ({
    ...d,
    reg:  expiryBadge(d.reg_expiry),
    ins:  expiryBadge(d.ins_expiry),
    road: expiryBadge(d.road_expiry),
  }));

  const allBadges  = enriched.flatMap(d => [d.reg, d.ins, d.road].filter(Boolean));
  const expired    = allBadges.filter(b => b.level === "expired").length;
  const critical   = allBadges.filter(b => b.level === "critical").length;
  const warning    = allBadges.filter(b => b.level === "warning").length;
  const ok         = allBadges.filter(b => b.level === "ok").length;

  const needsAttention = enriched.filter(d =>
    [d.reg, d.ins, d.road].some(b => b && b.level !== "ok")
  );

  function openEdit(doc) {
    setEditTarget(doc.plate);
    setForm({ reg_expiry: doc.reg_expiry ?? "", ins_expiry: doc.ins_expiry ?? "", road_expiry: doc.road_expiry ?? "" });
  }

  function handleSave() {
    onUpdateDocs(editTarget, form);
    updateVehicleDocs(editTarget, form).catch(() => {});
    setEditTarget(null);
  }

  function DocCell({ badge }) {
    if (!badge) return <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: "nowrap" }}>
        {badge.label}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Expired"   value={expired}  delta="documents overdue"     up={expired === 0}  accent="#DC2626" />
        <StatCard label="Critical"  value={critical} delta="expiring ≤ 14 days"    up={critical === 0} accent="#F59E0B" />
        <StatCard label="Warning"   value={warning}  delta="expiring 15–30 days"   up={warning === 0}  accent="#D97706" />
        <StatCard label="Valid"     value={ok}       delta="documents in order"     up                  accent="#10B981" />
      </div>

      {/* Alert banner */}
      {(expired + critical) > 0 && (
        <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 24 }}>🚨</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>
              {expired} expired · {critical} critical — immediate action required
            </div>
            <div style={{ fontSize: 12, color: "#EF4444" }}>
              Vehicles with expired documents may not be legally operated. Update registrations immediately.
            </div>
          </div>
        </div>
      )}

      {/* Vehicles needing attention */}
      {needsAttention.length > 0 && (
        <Panel title={`${needsAttention.length} vehicles need attention`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {needsAttention.map(d => (
              <div key={d.plate} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 12 }}>
                <div style={{ fontSize: 26 }}>🚌</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>{d.plate}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[{ label: "Registration", badge: d.reg, date: d.reg_expiry }, { label: "Insurance", badge: d.ins, date: d.ins_expiry }, { label: "Roadworthiness", badge: d.road, date: d.road_expiry }].map(({ label, badge, date }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{label}:</span>
                        {badge ? <DocCell badge={badge} /> : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                        {date && <span style={{ fontSize: 10, color: "#94A3B8" }}>({fmtDate(date)})</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => openEdit(d)} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", color: "#2563EB", flexShrink: 0 }}>
                  Update Dates
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Full status table */}
      <Panel title="All Vehicles — Document Status" noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
              {["Vehicle", "Registration", "Ins. Expiry", "Roadworthiness", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.map((d, i) => (
              <tr key={d.plate} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 13 }}>{d.plate}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div><DocCell badge={d.reg} /></div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{fmtDate(d.reg_expiry)}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div><DocCell badge={d.ins} /></div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{fmtDate(d.ins_expiry)}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div><DocCell badge={d.road} /></div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{fmtDate(d.road_expiry)}</div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={() => openEdit(d)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Edit modal */}
      {editTarget && (
        <Modal title={`Update Documents — ${editTarget}`} onClose={() => setEditTarget(null)} onSave={handleSave}>
          {[
            { label: "Registration Expiry", key: "reg_expiry" },
            { label: "Insurance Expiry",    key: "ins_expiry" },
            { label: "Roadworthiness Expiry", key: "road_expiry" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={lbl}>{f.label}</label>
              <input type="date" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp} />
              {form[f.key] && (() => {
                const b = expiryBadge(form[f.key]);
                return b ? <span style={{ fontSize: 11, color: b.color, marginLeft: 8, fontWeight: 600 }}>{b.label}</span> : null;
              })()}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Maintenance Log
// ══════════════════════════════════════════════════════════════════════════════
function MaintenanceTab({ log, vehicles, onAdd }) {
  const [plateFilter, setPlateFilter] = useState("All");
  const [modalOpen,   setModalOpen]   = useState(false);
  const EMPTY = { plate: "", date: "", type: "Oil Change", mechanic: "", cost: "", odometer: "", notes: "", next_service: "" };
  const [form, setForm] = useState(EMPTY);

  const plates  = [...new Set(log.map(r => r.plate))].sort();
  const visible = plateFilter === "All" ? log : log.filter(r => r.plate === plateFilter);
  const sorted  = [...visible].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalCost2026 = log
    .filter(r => r.date?.startsWith("2026"))
    .reduce((s, r) => s + (r.cost ?? 0), 0);

  function handleSave() {
    if (!form.plate || !form.date || !form.mechanic) return;
    const record = { id: Date.now(), ...form, cost: parseFloat(form.cost) || 0, odometer: parseInt(form.odometer) || 0 };
    onAdd(record);
    addMaintenanceRecord(form).catch(() => {});
    setModalOpen(false);
    setForm(EMPTY);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Total Records"    value={log.length}            delta="all time"         accent="#2563EB" />
        <StatCard label="Cost This Year"   value={`$${totalCost2026}`}   delta="maintenance spend" accent="#7C3AED" />
        <StatCard label="Vehicles Covered" value={plates.length}         delta="in log"            accent="#10B981" />
        <StatCard label="Due for Service"  value={log.filter(r => r.next_service && daysUntil(r.next_service) <= 30 && daysUntil(r.next_service) >= 0).length} delta="within 30 days" up={false} accent="#F59E0B" />
      </div>

      {/* Filter + Add */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...vehicles.map(v => v.plate)].map(p => (
            <button key={p} onClick={() => setPlateFilter(p)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: plateFilter === p ? "none" : "1px solid #E2E8F0",
              background: plateFilter === p ? "#2563EB" : "#fff",
              color:      plateFilter === p ? "#fff"    : "#64748B",
              fontWeight: plateFilter === p ? 700 : 400,
            }}>{p}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setModalOpen(true)} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Service Record
        </button>
      </div>

      {/* Records table */}
      <Panel title={`${sorted.length} records`} noPad>
        {sorted.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No maintenance records for this vehicle.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                {["Vehicle", "Date", "Service Type", "Mechanic / Workshop", "Cost", "Odometer", "Next Service", "Notes"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const nextDays  = r.next_service ? daysUntil(r.next_service) : null;
                const nextBadge = r.next_service ? expiryBadge(r.next_service) : null;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 13 }}>{r.plate}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#EFF6FF", color: "#2563EB" }}>{r.type}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{r.mechanic}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                      {r.cost ? `$${r.cost.toLocaleString()}` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#475569" }}>
                      {r.odometer ? `${r.odometer.toLocaleString()} km` : "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {r.next_service ? (
                        <div>
                          <div style={{ fontSize: 11, color: nextBadge?.color ?? "#64748B", fontWeight: 600 }}>
                            {fmtDate(r.next_service)}
                          </div>
                          {nextBadge && nextDays <= 30 && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: nextBadge.bg, color: nextBadge.color }}>
                              {nextBadge.label}
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748B", maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.notes}>
                        {r.notes || "—"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Add Service modal */}
      {modalOpen && (
        <Modal title="Add Service Record" onClose={() => setModalOpen(false)} onSave={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <div>
              <label style={lbl}>Vehicle *</label>
              <select value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} style={inp}>
                <option value="">— Select —</option>
                {vehicles.map(v => <option key={v.plate}>{v.plate}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Service Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <div>
              <label style={lbl}>Service Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Mechanic / Workshop *</label>
              <input value={form.mechanic} onChange={e => setForm(p => ({ ...p, mechanic: e.target.value }))} placeholder="e.g. Al-Amine Garage" style={inp} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <div>
              <label style={lbl}>Cost ($)</label>
              <input type="number" min="0" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Odometer (km)</label>
              <input type="number" min="0" value={form.odometer} onChange={e => setForm(p => ({ ...p, odometer: e.target.value }))} placeholder="km reading" style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Next Service Date</label>
            <input type="date" value={form.next_service} onChange={e => setForm(p => ({ ...p, next_service: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Work performed, parts replaced, observations..." style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Vehicle Photos
// ══════════════════════════════════════════════════════════════════════════════
function FuelTab({ vehicles, fuelLog, onAdd }) {
  const [plateFilter, setPlateFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const EMPTY = { plate: "", date: "", liters: "", cost: "", odometer: "", station: "", notes: "" };
  const [form, setForm] = useState(EMPTY);

  const visible = plateFilter === "All" ? fuelLog : fuelLog.filter((row) => row.plate === plateFilter);
  const sorted = [...visible].sort((a, b) => new Date(b.date) - new Date(a.date));

  const byPlate = fuelLog.reduce((acc, row) => {
    acc[row.plate] ||= [];
    acc[row.plate].push(row);
    return acc;
  }, {});

  const efficiencyRows = Object.entries(byPlate).map(([plate, entries]) => {
    const ordered = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    let kmTravelled = 0;
    let litersUsed = 0;
    for (let i = 1; i < ordered.length; i += 1) {
      kmTravelled += Math.max(0, (ordered[i].odometer ?? 0) - (ordered[i - 1].odometer ?? 0));
      litersUsed += ordered[i].liters ?? 0;
    }
    return { plate, entries: ordered.length, kmTravelled, litersUsed, kmPerLiter: litersUsed > 0 ? kmTravelled / litersUsed : 0 };
  }).sort((a, b) => a.kmPerLiter - b.kmPerLiter);

  const totalLiters = fuelLog.reduce((sum, row) => sum + (parseFloat(row.liters) || 0), 0);
  const totalCost = fuelLog.reduce((sum, row) => sum + (parseFloat(row.cost) || 0), 0);
  const avgEfficiency = efficiencyRows.length ? (efficiencyRows.reduce((sum, row) => sum + row.kmPerLiter, 0) / efficiencyRows.length) : 0;
  const lowEfficiency = efficiencyRows.filter((row) => row.kmPerLiter > 0 && row.kmPerLiter < 10).length;

  function handleSave() {
    if (!form.plate || !form.date || !form.liters || !form.odometer) return;
    const row = {
      id: Date.now(),
      ...form,
      liters:   parseFloat(form.liters)     || 0,
      cost:     parseFloat(form.cost)       || 0,
      odometer: parseInt(form.odometer, 10) || 0,
    };
    onAdd(row);
    addFuelRecord(form).catch(() => {});
    setForm(EMPTY);
    setModalOpen(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Fill-Ups" value={fuelLog.length} delta="logged refuels" accent="#2563EB" />
        <StatCard label="Fuel Volume" value={`${totalLiters.toFixed(0)} L`} delta="tracked liters" accent="#0EA5E9" />
        <StatCard label="Fuel Cost" value={`$${totalCost.toFixed(0)}`} delta="recorded spend" accent="#7C3AED" />
        <StatCard label="Avg Efficiency" value={avgEfficiency ? `${avgEfficiency.toFixed(1)} km/L` : "—"} delta={lowEfficiency ? `${lowEfficiency} vehicles below 10 km/L` : "healthy efficiency"} up={lowEfficiency === 0} accent="#10B981" />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...vehicles.map((v) => v.plate)].map((p) => (
            <button key={p} onClick={() => setPlateFilter(p)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: plateFilter === p ? "none" : "1px solid #E2E8F0",
              background: plateFilter === p ? "#2563EB" : "#fff",
              color: plateFilter === p ? "#fff" : "#64748B",
              fontWeight: plateFilter === p ? 700 : 400,
            }}>{p}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setModalOpen(true)} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Fuel Fill-Up
        </button>
      </div>

      <Panel title="Fuel Efficiency by Vehicle" noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
            {["Vehicle", "Entries", "KM Travelled", "Liters", "KM/L", "Status"].map((h) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {efficiencyRows.map((row, i) => {
              const good = row.kmPerLiter >= 10;
              return (
                <tr key={row.plate} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "#2563EB" }}>{row.plate}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{row.entries}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{row.kmTravelled.toLocaleString()} km</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{row.litersUsed.toFixed(1)} L</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 800, color: good ? "#059669" : "#DC2626" }}>{row.kmPerLiter ? row.kmPerLiter.toFixed(1) : "—"}</td>
                  <td style={{ padding: "12px 14px" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: good ? "#ECFDF5" : "#FEF2F2", color: good ? "#059669" : "#B91C1C" }}>{row.kmPerLiter === 0 ? "Insufficient data" : good ? "Efficient" : "Needs review"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title={`${sorted.length} fuel log entries`} noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
            {["Vehicle", "Date", "Station", "Liters", "Cost", "Odometer", "Notes"].map((h) => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#2563EB" }}>{row.plate}</td>
                <td style={{ padding: "12px 14px", fontSize: 12 }}>{fmtDate(row.date)}</td>
                <td style={{ padding: "12px 14px", fontSize: 12 }}>{row.station || "—"}</td>
                <td style={{ padding: "12px 14px", fontSize: 12 }}>{row.liters} L</td>
                <td style={{ padding: "12px 14px", fontSize: 12 }}>${Number(row.cost || 0).toFixed(2)}</td>
                <td style={{ padding: "12px 14px", fontSize: 12 }}>{Number(row.odometer || 0).toLocaleString()} km</td>
                <td style={{ padding: "12px 14px", fontSize: 11, color: "#64748B" }}>{row.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {modalOpen && (
        <Modal title="Add Fuel Fill-Up" onClose={() => setModalOpen(false)} onSave={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
            <div><label style={lbl}>Vehicle *</label><select value={form.plate} onChange={e => setForm((p) => ({ ...p, plate: e.target.value }))} style={inp}><option value="">— Select —</option>{vehicles.map((v) => <option key={v.plate}>{v.plate}</option>)}</select></div>
            <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm((p) => ({ ...p, date: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 13 }}>
            <div><label style={lbl}>Liters *</label><input type="number" min="0" step="0.1" value={form.liters} onChange={e => setForm((p) => ({ ...p, liters: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Cost ($)</label><input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm((p) => ({ ...p, cost: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Odometer *</label><input type="number" min="0" value={form.odometer} onChange={e => setForm((p) => ({ ...p, odometer: e.target.value }))} style={inp} /></div>
          </div>
          <div style={{ marginBottom: 13 }}><label style={lbl}>Station</label><input value={form.station} onChange={e => setForm((p) => ({ ...p, station: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} /></div>
        </Modal>
      )}
    </div>
  );
}

function PhotosTab({ vehicles, photos, onPhotoUpload, onPhotoRemove }) {
  const [selectedPlate, setSelectedPlate] = useState(vehicles[0]?.plate ?? "");
  const fileInputRefs = useRef({});

  function getKey(plate, slot) { return `${plate}-${slot}`; }

  function handleUpload(plate, slot, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onPhotoUpload(getKey(plate, slot), file);
    e.target.value = "";
  }

  function removePhoto(plate, slot) {
    onPhotoRemove(getKey(plate, slot));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Vehicle selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {vehicles.map(v => (
          <button key={v.plate} onClick={() => setSelectedPlate(v.plate)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: selectedPlate === v.plate ? "none" : "1px solid #E2E8F0",
            background: selectedPlate === v.plate ? "#2563EB" : "#fff",
            color:      selectedPlate === v.plate ? "#fff" : "#64748B",
            fontWeight: selectedPlate === v.plate ? 700 : 400,
          }}>{v.plate}</button>
        ))}
      </div>

      {selectedPlate && (
        <>
          {/* Vehicle info banner */}
          {(() => {
            const v = vehicles.find(x => x.plate === selectedPlate);
            return v ? (
              <div style={{ padding: "12px 18px", background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>🚌</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF" }}>{v.plate} — {v.model} ({v.year})</div>
                  <div style={{ fontSize: 12, color: "#3B82F6" }}>Capacity: {v.capacity} seats · Driver: {v.driver}</div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Photo slots */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {PHOTO_SLOTS.map(slot => {
              const key      = getKey(selectedPlate, slot.key);
              const photoUrl = photos[key];
              return (
                <div key={slot.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{slot.icon}</span> {slot.label}
                    <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>— {slot.hint}</span>
                  </div>

                  {/* Photo area */}
                  <div style={{
                    width: "100%", aspectRatio: "4/3", borderRadius: 12, overflow: "hidden",
                    border: `2px dashed ${photoUrl ? "#2563EB" : "#E2E8F0"}`,
                    background: photoUrl ? "#000" : "#F8FAFC",
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt={slot.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ textAlign: "center", color: "#CBD5E1" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>{slot.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>No photo</div>
                        <div style={{ fontSize: 11 }}>Click Upload below</div>
                      </div>
                    )}

                    {/* Overlay on hover */}
                    {photoUrl && (
                      <div style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 10, opacity: 0, transition: "opacity .2s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0"}
                      >
                        <button
                          onClick={() => fileInputRefs.current[key]?.click()}
                          style={{ padding: "7px 14px", background: "rgba(255,255,255,.9)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >Change</button>
                        <button
                          onClick={() => removePhoto(selectedPlate, slot.key)}
                          style={{ padding: "7px 14px", background: "rgba(239,68,68,.9)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >Remove</button>
                      </div>
                    )}
                  </div>

                  {/* Upload button */}
                  <button
                    onClick={() => fileInputRefs.current[key]?.click()}
                    style={{
                      padding: "9px 0", borderRadius: 9, border: `1px dashed ${photoUrl ? "#2563EB" : "#E2E8F0"}`,
                      background: photoUrl ? "#EFF6FF" : "#F8FAFC",
                      color: photoUrl ? "#2563EB" : "#94A3B8",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {photoUrl ? "✓ Uploaded — Change" : "Upload Photo"}
                  </button>

                  {/* Hidden file input */}
                  <input
                    type="file" accept="image/*" style={{ display: "none" }}
                    ref={el => fileInputRefs.current[key] = el}
                    onChange={e => handleUpload(selectedPlate, slot.key, e)}
                  />
                </div>
              );
            })}
          </div>

          {/* Upload hint */}
          <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", padding: "6px 0" }}>
            Photos are persisted to the server at <code>POST /api/vehicles/:id/photos</code> and survive page refresh.
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ══════════════════════════════════════════════════════════════════════════════
// MAIN VehiclesPage
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_FORM = { plate: "", type: "Bus", model: "", year: new Date().getFullYear(), capacity: 30, status: "Active", driver: "—" };

export default function VehiclesPage() {
  const [tab,           setTab]           = useState("fleet");
  const [vehicles,      setVehicles]      = useState([]);
  const [vehiclesLoading,setVehiclesLoading]=useState(true);
  const [vehiclesError, setVehiclesError] = useState(null);
  const [docs,          setDocs]          = useState([]);
  const [mlog,          setMlog]          = useState([]);
  const [fuelLog,       setFuelLog]       = useState(MOCK_FUEL_LOG);
  const [photos,        setPhotos]        = useState({});
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [deleteId,      setDeleteId]      = useState(null);
  const [profile,       setProfile]       = useState(null);

  const loadVehicles = useCallback(() => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    getVehicles()
      .then(d => {
        const rows = d?.data ?? d;
        const normalised = (rows || []).map(normalizeVehicle);
        setVehicles(normalised);
        loadAllPhotos(normalised).catch(() => {});
      })
      .catch(err => {
        setVehicles(MOCK_VEHICLES.map(normalizeVehicle));
        setVehiclesError(err?.message ?? "Could not reach server — showing demo data");
      })
      .finally(() => setVehiclesLoading(false));
  }, [loadAllPhotos]);

  useEffect(() => {
    loadVehicles();

    getVehicleDocs()
      .then(d => setDocs((d || []).length ? d : MOCK_VEHICLE_DOCS))
      .catch(() => setDocs(MOCK_VEHICLE_DOCS));

    getMaintenanceLog()
      .then(d => setMlog((d || []).length ? d : MOCK_MAINTENANCE_LOG))
      .catch(() => setMlog(MOCK_MAINTENANCE_LOG));

    getFuelLog()
      .then(d => setFuelLog((d || []).length ? d : MOCK_FUEL_LOG))
      .catch(() => setFuelLog(MOCK_FUEL_LOG));
  }, [loadVehicles]);

  // Alert badge count for tab
  const alertCount = docs.filter(d =>
    [d.reg_expiry, d.ins_expiry, d.road_expiry].some(x => x && daysUntil(x) <= 14)
  ).length;

  function openAdd()   { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }
  function openEdit(v) { setEditTarget(v.id); setForm({ plate: v.plate, type: v.type ?? "Bus", model: v.model, year: v.year, capacity: v.capacity, status: v.status, driver: v.driver }); setModalOpen(true); }
  // Load persisted photos for all vehicles on mount
  const loadAllPhotos = useCallback(async (vehicleList) => {
    const results = await Promise.allSettled(
      vehicleList.map(v => {
        const id = v.id ?? v.vehicle_id;
        return getVehiclePhotos(id).then(photos => ({ id, photos }));
      })
    );
    const photoMap = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const { id, photos } = r.value;
        for (const p of photos ?? []) {
          photoMap[`${id}-${p.slot}`] = p.url;
        }
      }
    }
    if (Object.keys(photoMap).length > 0) {
      setPhotos(prev => ({ ...prev, ...photoMap }));
    }
  }, []);

  async function handlePhotoUpload(key, file) {
    // key = "{vehicleId}-{slot}"
    const [vehicleId, ...slotParts] = key.split("-");
    const slot = slotParts.join("-");

    // Optimistic preview while uploading
    const reader = new FileReader();
    reader.onload = ev => setPhotos(prev => ({ ...prev, [key]: ev.target.result }));
    reader.readAsDataURL(file);

    // Persist to server
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("slot",  slot);
    try {
      const res = await uploadVehiclePhoto(vehicleId, fd);
      const url = res?.url ?? res?.data?.url;
      if (url) setPhotos(prev => ({ ...prev, [key]: url }));
    } catch {
      // Preview stays; server save failed silently
    }
  }

  async function handlePhotoRemove(key) {
    // Find and delete the server file
    const [vehicleId] = key.split("-");
    setPhotos(prev => {
      const url = prev[key];
      if (url && !url.startsWith("data:")) {
        // Extract filename from URL
        const filename = url.split("/").pop();
        deleteVehiclePhotoApi(vehicleId, filename).catch(() => {});
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSave() {
    if (!form.plate || !form.model) return;
    if (editTarget) {
      await updateVehicle(editTarget, { plate_number: form.plate, model: form.model, vehicle_type: form.type?.toLowerCase(), capacity: Number(form.capacity), status: form.status }).catch(() => {});
      setVehicles(prev => prev.map(v => v.id === editTarget ? { ...v, ...form } : v));
    } else {
      await createVehicle({ plate_number: form.plate, model: form.model, vehicle_type: form.type?.toLowerCase(), capacity: Number(form.capacity), status: form.status }).catch(() => {});
      setVehicles(prev => [...prev, { id: Date.now(), ...form, lastService: "—", km: 0 }]);
    }
    setModalOpen(false);
  }

  function handleDelete() { setVehicles(prev => prev.filter(v => v.id !== deleteId)); setDeleteId(null); }

  function handleUpdateDocs(plate, patch) {
    setDocs(prev => prev.map(d => d.plate === plate ? { ...d, ...patch } : d));
  }

  const counts = {
    total:       vehicles.length,
    active:      vehicles.filter(v => v.status === "Active").length,
    maintenance: vehicles.filter(v => v.status === "Maintenance").length,
    inactive:    vehicles.filter(v => v.status === "Inactive").length,
    buses:       vehicles.filter(v => v.type === "Bus").length,
    minibuses:   vehicles.filter(v => v.type === "Minibus").length,
    vans:        vehicles.filter(v => v.type === "Van").length,
    taxis:       vehicles.filter(v => v.type === "Taxi").length,
  };

  const tabs = [
    { id: "fleet",       label: "Fleet",           badge: 0 },
    { id: "alerts",      label: "Expiry Alerts",   badge: alertCount },
    { id: "maintenance", label: "Maintenance Log",  badge: 0 },
    { id: "fuel",        label: "Fuel Tracking",    badge: 0 },
    { id: "photos",      label: "Photos",           badge: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Vehicles</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Fleet management · {alertCount > 0 && <span style={{ color: "#DC2626", fontWeight: 600 }}>{alertCount} document alert{alertCount !== 1 ? "s" : ""} · </span>}
            {mlog.length} maintenance records
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {tab === "fleet" && (
          <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add vehicle
          </button>
        )}
        <TabNav tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* KPI cards — status row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total Fleet"  value={counts.total}       delta="all vehicle types"  accent="#2563EB" />
        <StatCard label="Active"       value={counts.active}      delta="in service"         up accent="#10B981" />
        <StatCard label="Maintenance"  value={counts.maintenance} delta="need attention"      up={counts.maintenance === 0} accent="#F59E0B" />
        <StatCard label="Inactive"     value={counts.inactive}    delta="offline"            accent="#94A3B8" />
      </div>

      {/* Type breakdown row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { type: "Bus",     count: counts.buses     },
          { type: "Minibus", count: counts.minibuses },
          { type: "Van",     count: counts.vans      },
          { type: "Taxi",    count: counts.taxis     },
        ].map(({ type, count }) => {
          const ts = TYPE_STYLE[type];
          return (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: ts.bg, borderRadius: 20, border: `1px solid ${ts.color}22` }}>
              <span style={{ fontSize: 16 }}>{TYPE_ICON[type]}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ts.color }}>{count} {type}{count !== 1 ? (type === "Bus" ? "es" : "s") : ""}</span>
            </div>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "fleet" && (
        vehiclesLoading
          ? <PageLoading message="Loading fleet…" />
          : vehiclesError
          ? <PageError message={vehiclesError} onRetry={loadVehicles} />
          : vehicles.length === 0
          ? <PageEmpty message="No vehicles in fleet" hint="Register your first vehicle with the + Add Vehicle button" icon="🚌" />
          : <FleetTab vehicles={vehicles} docs={docs} onEdit={openEdit} onDelete={setDeleteId} onViewProfile={setProfile} />
      )}
      {tab === "alerts"      && <ExpiryAlertsTab docs={docs} onUpdateDocs={handleUpdateDocs} />}
      {tab === "maintenance" && <MaintenanceTab  log={mlog} vehicles={vehicles} onAdd={r => setMlog(prev => [r, ...prev])} />}
      {tab === "fuel"        && <FuelTab fuelLog={fuelLog} vehicles={vehicles} onAdd={r => setFuelLog(prev => [r, ...prev])} />}
      {tab === "photos"      && <PhotosTab       vehicles={vehicles} photos={photos} onPhotoUpload={handlePhotoUpload} onPhotoRemove={handlePhotoRemove} />}

      {/* Edit / Add modal */}
      {modalOpen && (
        <Modal title={editTarget ? "Edit vehicle" : "Add new vehicle"} onClose={() => setModalOpen(false)} onSave={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Plate / ID</label>
              <input placeholder="e.g. BUS-14 / TAXI-04" value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Vehicle Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inp}>
                {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Model</label>
            <input placeholder="e.g. Mercedes Sprinter / Toyota Camry" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[{ label: "Year", key: "year", type: "number" }, { label: "Capacity (seats)", key: "capacity", type: "number" }].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inp}>
              {VEHICLE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Assigned Driver</label>
            <select value={form.driver} onChange={e => setForm(p => ({ ...p, driver: e.target.value }))} style={{ ...inp, color: form.driver === "—" ? "#aaa" : "#111" }}>
              <option value="—">— No driver assigned —</option>
              {AVAILABLE_DRIVERS.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {/* Vehicle profile drawer */}
      {profile && (
        <VehicleProfile
          vehicle={profile}
          docs={docs}
          mlog={mlog}
          fuelLog={fuelLog}
          photos={photos}
          onClose={() => setProfile(null)}
          onEdit={v => { setProfile(null); openEdit(v); }}
          onPhotoUpload={handlePhotoUpload}
          onPhotoRemove={handlePhotoRemove}
          onAddRecord={r => setMlog(prev => [r, ...prev])}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Remove vehicle" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>Remove this vehicle from the fleet? This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Remove</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
