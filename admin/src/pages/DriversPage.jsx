import { useState, useEffect, useCallback } from "react";
import { PageLoading, PageError, PageEmpty } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { useWebSocketCamera } from "../hooks/useWebSocketCamera";
import { useCounterData } from "../hooks/useCounterData";
import {
  getDrivers, createDriver, updateDriver,
  getDriverPerformance, getDriverSchedules, updateDriverSchedule,
  createUser,
} from "../api/endpoints";
import { getTripChecklists } from "../api/endpoints";

import { CAMERA_REST_URL } from '../config/camera';
const CAMERA_SERVER_REST = CAMERA_REST_URL;
const DEFAULT_BUS_ID = "BUS-01";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = new Date("2026-05-10");

const SHIFT_CONFIG = {
  morning:   { label: "Morning",   time: "6:00–14:00",  color: "#2563EB", bg: "#EFF6FF" },
  afternoon: { label: "Afternoon", time: "14:00–22:00", color: "#D97706", bg: "#FFFBEB" },
  night:     { label: "Night",     time: "22:00–6:00",  color: "#7C3AED", bg: "#F5F3FF" },
  off:       { label: "Day Off",   time: "",             color: "#94A3B8", bg: "#F8FAFC" },
  vacation:  { label: "Vacation",  time: "",             color: "#10B981", bg: "#ECFDF5" },
};

function normalizeDriver(d) {
  return {
    id: d.driver_id ?? d.id,
    name: d.full_name ?? d.name ?? "",
    license: d.license_number ?? d.license ?? "",
    license_expiry: d.license_expiry ?? "",
    phone: d.phone ?? d.email ?? "",
    trips: d.trips ?? 0,
    rating: d.rating ?? null,
    status: d.status ?? "Active",
  };
}

const DEFAULT_SCHEDULE = { Mon: "off", Tue: "off", Wed: "off", Thu: "off", Fri: "off", Sat: "off", Sun: "off" };
const EMPTY_FORM = {
  // user fields
  name: "", email: "", password: "", phone: "", birthDate: "",
  // driver fields
  license: "", license_expiry: "", status: "Active",
  // schedule
  schedule: { ...DEFAULT_SCHEDULE },
};

function daysUntil(dateStr) {
  return Math.floor((new Date(dateStr) - TODAY) / 86400000);
}

function licenseAlert(dateStr) {
  if (!dateStr) return null;
  const d = daysUntil(dateStr);
  if (d < 0) return { label: `Expired ${Math.abs(d)}d ago`, color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", tier: "expired" };
  if (d <= 7) return { label: `${d}d left`, color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA", tier: "7-day" };
  if (d <= 14) return { label: `${d}d left`, color: "#C2410C", bg: "#FFF7ED", border: "#FDBA74", tier: "14-day" };
  if (d <= 30) return { label: `${d}d left`, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", tier: "30-day" };
  return { label: `${d}d left`, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", tier: "ok" };
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

// ── Tab navigation ───────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 4, background: "#F8FAFC",
      borderRadius: 10, padding: 4, border: "1px solid #E2E8F0",
    }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          padding: "7px 20px", borderRadius: 7, border: "none",
          fontSize: 13, fontWeight: active === tab ? 700 : 500,
          cursor: "pointer",
          background: active === tab ? "#fff" : "transparent",
          color: active === tab ? "#2563EB" : "#64748B",
          boxShadow: active === tab ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          transition: "all .15s",
        }}>
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Small live/demo badge ────────────────────────────────────────────────────
function StreamBadge({ connected, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: connected ? "#10B981" : "#6b7280",
        display: "inline-block",
        animation: connected ? "pulse 1.5s infinite" : "none",
      }} />
      <span style={{ color: connected ? "#059669" : "#6b7280", fontWeight: 600 }}>
        {connected ? "LIVE" : "DEMO"}
      </span>
      {label && <span style={{ color: "#9ca3af", fontWeight: 400 }}>· {label}</span>}
    </span>
  );
}

// ── Shared camera icon buttons ────────────────────────────────────────────────
function CamBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none", border: "1px solid #e5e7eb", borderRadius: 5,
      cursor: "pointer", padding: "2px 7px", fontSize: 13, color: "#6b7280",
      lineHeight: 1, display: "flex", alignItems: "center", transition: "all .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#111"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280"; }}
    >
      {children}
    </button>
  );
}

// ── Full-screen maximize overlay ──────────────────────────────────────────────
function CameraMaxOverlay({ title, onClose, onMinimize, children }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const overlayBtn = (onClick, label, tip) => (
    <button onClick={onClick} title={tip} style={{
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 6, color: "#e2e8f0", cursor: "pointer",
      fontSize: 13, padding: "5px 13px", fontWeight: 500, transition: "background .15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
    >{label}</button>
  );

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.93)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 1400, height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{title}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {onMinimize && overlayBtn(onMinimize, "— Minimize", "Collapse panel")}
            {overlayBtn(onClose, "✕ Close", "Exit fullscreen (Esc)")}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "100%", aspectRatio: "16/9", maxHeight: "100%", overflow: "hidden", borderRadius: 10, position: "relative" }}>
              {children}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "#374151", flexShrink: 0 }}>
          Esc · click outside · or — Minimize to collapse
        </div>
      </div>
    </div>
  );
}

// ── Passenger camera panel ───────────────────────────────────────────────────
function PassengerCamPanel({ busId }) {
  const { frameUrl, connected } = useWebSocketCamera(busId, "passenger");
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const placeholder = (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" stroke="#1a5c2e" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="10" width="34" height="24" rx="4" /><circle cx="20" cy="22" r="6" /><path d="M14 10l3-4h6l3 4" />
      </svg>
      <div style={{ fontSize: 11, color: "#2d6a4a", textAlign: "center" }}>
        Connecting to passenger cam…
        <div style={{ fontSize: 10, color: "#1a4a34", marginTop: 3 }}>Start camera server: python server.py</div>
      </div>
    </div>
  );

  return (
    <>
      {maximized && (
        <CameraMaxOverlay title={`Passenger Camera — ${busId}`} onClose={() => setMaximized(false)} onMinimize={() => { setMaximized(false); setCollapsed(true); }}>
          {frameUrl
            ? <img src={frameUrl} alt="passenger cam" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#051a0e" }} />
            : <div style={{ width: "100%", height: "100%", backgroundColor: "#051a0e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="48" height="48" viewBox="0 0 40 40" fill="none" stroke="#1a5c2e" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="10" width="34" height="24" rx="4" /><circle cx="20" cy="22" r="6" /><path d="M14 10l3-4h6l3 4" /></svg>
                <div style={{ fontSize: 13, color: "#2d6a4a", fontWeight: 600 }}>Connecting to passenger cam…</div>
              </div>
          }
        </CameraMaxOverlay>
      )}
      <Panel title="Passenger Camera" action={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StreamBadge connected={connected} label="3-zone counter" />
          <CamBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expand" : "Collapse"}>{collapsed ? "▲" : "▼"}</CamBtn>
          <CamBtn onClick={() => setMaximized(true)} title="Maximize">⛶</CamBtn>
        </div>
      }>
        {!collapsed && (
          <div style={{ width: "100%", aspectRatio: "16/9", background: "#051a0e", borderRadius: 8, overflow: "hidden", position: "relative", border: `2px solid ${connected ? "#059669" : "#1a3a2e"}`, boxShadow: connected ? "0 0 14px #05966933" : "none" }}>
            {frameUrl ? (
              <>
                <img src={frameUrl} alt="passenger cam" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,.70)", padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#e2e8f0" }}>
                  {busId} · PASSENGER
                </div>
              </>
            ) : placeholder}
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Driver camera panel ──────────────────────────────────────────────────────
function DriverCamPanel({ busId }) {
  const { frameUrl, connected } = useWebSocketCamera(busId, "driver");
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const placeholder = (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" stroke="#1e1e5a" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="10" width="34" height="24" rx="4" /><circle cx="20" cy="22" r="6" /><path d="M14 10l3-4h6l3 4" />
      </svg>
      <div style={{ fontSize: 11, color: "#3b4a8a", textAlign: "center" }}>
        Connecting to driver cam…
        <div style={{ fontSize: 10, color: "#2d3a7a", marginTop: 3 }}>Start camera server: python server.py</div>
      </div>
    </div>
  );

  return (
    <>
      {maximized && (
        <CameraMaxOverlay title={`Driver Camera — ${busId}`} onClose={() => setMaximized(false)} onMinimize={() => { setMaximized(false); setCollapsed(true); }}>
          {frameUrl
            ? <img src={frameUrl} alt="driver cam" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#0a0a1a" }} />
            : <div style={{ width: "100%", height: "100%", backgroundColor: "#0a0a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="48" height="48" viewBox="0 0 40 40" fill="none" stroke="#1e1e5a" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="10" width="34" height="24" rx="4" /><circle cx="20" cy="22" r="6" /><path d="M14 10l3-4h6l3 4" /></svg>
                <div style={{ fontSize: 13, color: "#3b4a8a", fontWeight: 600 }}>Connecting to driver cam…</div>
              </div>
          }
        </CameraMaxOverlay>
      )}
      <Panel title="Driver Camera" action={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StreamBadge connected={connected} label="behaviour analysis" />
          <CamBtn onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expand" : "Collapse"}>{collapsed ? "▲" : "▼"}</CamBtn>
          <CamBtn onClick={() => setMaximized(true)} title="Maximize">⛶</CamBtn>
        </div>
      }>
        {!collapsed && (
          <div style={{ width: "100%", aspectRatio: "16/9", background: "#0a0a1a", borderRadius: 8, overflow: "hidden", position: "relative", border: `2px solid ${connected ? "#3b82f6" : "#1e1e3a"}`, boxShadow: connected ? "0 0 14px #3b82f633" : "none" }}>
            {frameUrl ? (
              <>
                <img src={frameUrl} alt="driver cam" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,.70)", padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#e2e8f0" }}>
                  {busId} · DRIVER
                </div>
              </>
            ) : placeholder}
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Live passenger count panel ───────────────────────────────────────────────
function LiveCountPanel({ busId }) {
  const { counter: counts, events, online, resetCounter } = useCounterData(busId, 2000);
  const BUS_CAPACITY = 50;
  const onBus = counts?.on_bus ?? 0;
  const pct = Math.min(Math.round((onBus / BUS_CAPACITY) * 100), 100);
  const barColor = pct > 90 ? "#ef5350" : pct > 70 ? "#F59E0B" : "#10B981";

  return (
    <Panel title="Live passenger count" action={
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#10B981" : "#6b7280", display: "inline-block" }} />
          <span style={{ color: online ? "#059669" : "#6b7280", fontWeight: 600 }}>{online ? "Live" : "Demo"}</span>
        </span>
        <span style={{ fontSize: 10, color: "#bbb" }}>{counts?.fps ?? 0} fps</span>
        <button onClick={resetCounter} style={{ fontSize: 10, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Reset</button>
      </div>
    }>
      <div style={{ display: "flex", marginBottom: 14, borderRadius: 8, overflow: "hidden" }}>
        {[
          { label: "On bus now", value: onBus,              color: "#2563EB", bg: "#EFF6FF" },
          { label: "Entered",    value: counts?.entered ?? 0, color: "#059669", bg: "#ECFDF5" },
          { label: "Exited",     value: counts?.exited  ?? 0, color: "#D97706", bg: "#FFFBEB" },
        ].map((item, i) => (
          <div key={item.label} style={{ flex: 1, padding: "12px 8px", background: item.bg, textAlign: "center", borderRight: i < 2 ? "1px solid #fff" : "none" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 10, color: item.color, marginTop: 4, fontWeight: 500 }}>{item.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 5 }}>
          <span>Bus capacity</span>
          <span style={{ fontWeight: 600, color: barColor }}>{pct}% full</span>
        </div>
        <div style={{ height: 10, background: "#f0f0f0", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 5, transition: "width .5s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: "#bbb", marginTop: 3, textAlign: "right" }}>{onBus} / {BUS_CAPACITY} seats</div>
      </div>
      {counts?.last_event && (
        <div style={{ padding: "8px 10px", marginBottom: 14, borderRadius: 8, background: counts.last_event.event === "ENTER" ? "#ECFDF5" : "#FFFBEB", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: counts.last_event.event === "ENTER" ? "#10B981" : "#F59E0B", color: "#fff" }}>{counts.last_event.event}</span>
          <span style={{ fontSize: 11, color: "#475569" }}>Passenger #{counts.last_event.tid} · {counts.last_event.timestamp?.slice(11, 19)}</span>
        </div>
      )}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Recent events</div>
        <div style={{ maxHeight: 150, overflowY: "auto" }}>
          {events.length === 0
            ? <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: "8px 0" }}>No events yet</div>
            : events.slice(0, 12).map((evt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11, borderBottom: i < Math.min(events.length, 12) - 1 ? "1px solid #f7f7f7" : "none" }}>
                <span style={{ width: 44, textAlign: "center", padding: "1px 0", borderRadius: 8, fontWeight: 700, fontSize: 9, background: evt.event === "ENTER" ? "#ECFDF5" : "#FFFBEB", color: evt.event === "ENTER" ? "#059669" : "#D97706" }}>{evt.event}</span>
                <span style={{ color: "#64748B" }}>tid #{evt.tid}</span>
                <span style={{ flex: 1, color: "#bbb", textAlign: "right" }}>{evt.timestamp?.slice(11, 19)}</span>
                <span style={{ minWidth: 40, textAlign: "right", color: "#2563EB", fontWeight: 600 }}>{evt.on_bus} on bus</span>
              </div>
            ))
          }
        </div>
      </div>
    </Panel>
  );
}

// ── Bus selector strip ───────────────────────────────────────────────────────
function BusSelector({ selectedBusId, onSelect }) {
  const [buses, setBuses] = useState([]);

  useEffect(() => {
    fetch(`${CAMERA_SERVER_REST}/api/buses`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.buses?.length) setBuses(d.buses.map(b => b.bus_id)); })
      .catch(() => {});
  }, []);

  const list = buses.length ? buses : [DEFAULT_BUS_ID];
  if (list.length <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Bus:</span>
      {list.map(id => (
        <button key={id} onClick={() => onSelect(id)} style={{
          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
          border: `2px solid ${id === selectedBusId ? "#2563EB" : "#e5e7eb"}`,
          background: id === selectedBusId ? "#eff6ff" : "#fff",
          color: id === selectedBusId ? "#2563EB" : "#374151",
          cursor: "pointer",
        }}>{id}</button>
      ))}
    </div>
  );
}

// ── Driver Profile Drawer (admin view) ───────────────────────────────────────
function DriverProfile({ driver, onClose, onEdit }) {
  const [schedule,      setSchedule]      = useState(null);
  const [editDay,       setEditDay]       = useState(null);   // "Mon" | null
  const [pickedShift,   setPickedShift]   = useState("off");
  const [schedSaving,   setSchedSaving]   = useState(false);
  const [schedError,    setSchedError]    = useState(null);

  useEffect(() => {
    getDriverSchedules()
      .then(list => {
        const match = (list || []).find(s => s.driver_id === driver.id);
        if (match) setSchedule(match);
      })
      .catch(() => {});
  }, [driver.id]);

  function openDayPicker(day) {
    const current = schedule?.[day.toLowerCase()] || "off";
    setPickedShift(current);
    setEditDay(day);
    setSchedError(null);
  }

  async function saveDayShift() {
    if (!editDay) return;
    setSchedSaving(true);
    setSchedError(null);
    const base    = schedule ?? {};
    const dayKey  = editDay.toLowerCase();
    const updated = { ...base, [dayKey]: pickedShift };
    const payload = Object.fromEntries(
      DAYS.map(d => [d, updated[d.toLowerCase()] || "off"])
    );
    try {
      await updateDriverSchedule(driver.id, payload);
      setSchedule(updated);
      setEditDay(null);
    } catch (err) {
      setSchedError(err?.message ?? "Failed to save");
    } finally {
      setSchedSaving(false);
    }
  }

  const perf = {
    trips_week: driver.trips || 0, on_time_pct: 85, complaints: 0,
    avg_rating: driver.rating, idle_hours: 3.0,
  };
  const recentTrips = [];
  const driverRatings = [];
  const score      = calcScore(perf);
  const scoreColor = score >= 85 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  const initials   = driver.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px); opacity:0 } to { transform:none; opacity:1 } }`}</style>
      {/* backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />

      {/* drawer */}
      <div style={{
        width: "min(92vw, 580px)", background: "#fff",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,.14)",
        overflowY: "auto", animation: "slideInRight .25s ease",
      }}>
        {/* ── Header ── */}
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Driver Profile</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onClose(); onEdit(driver); }} style={{ background: "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#2563EB", fontSize: 12, fontWeight: 600 }}>
                Edit
              </button>
              <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: "#EFF6FF", border: "3px solid #2563EB30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#2563EB" }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{driver.name}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>{driver.phone}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "#EFF6FF", color: "#1E40AF" }}>Driver</span>
                <StatusPill status={driver.status} />
                {driver.rating && <span style={{ color: "#f9a825", fontWeight: 700, fontSize: 12 }}>★ {driver.rating}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Identity & Contact ── */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>Identity &amp; Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "License No.",   value: driver.license },
              { label: "Phone",         value: driver.phone   },
              { label: "Status",        value: driver.status  },
              { label: "Trips Today",   value: driver.trips || 0 },
              { label: "Perf. Score",   value: `${score} / 100` },
              { label: "Avg Rating",    value: driver.rating ? `★ ${driver.rating}` : "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "11px 14px", border: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── This Week's Performance ── */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>This Week&apos;s Performance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Trips",      value: perf.trips_week,            color: "#2563EB" },
              { label: "On-Time",    value: `${perf.on_time_pct}%`,     color: perf.on_time_pct >= 90 ? "#10B981" : perf.on_time_pct >= 75 ? "#F59E0B" : "#EF4444" },
              { label: "Complaints", value: perf.complaints,             color: perf.complaints === 0 ? "#10B981" : "#EF4444" },
              { label: "Idle",       value: `${perf.idle_hours}h`,      color: perf.idle_hours > 4 ? "#EF4444" : "#64748B" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 8px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>
              <span>Performance Score</span>
              <span style={{ fontWeight: 700, color: scoreColor }}>{score} / 100</span>
            </div>
            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${score}%`, height: "100%", background: scoreColor, borderRadius: 4, transition: "width .6s ease" }} />
            </div>
          </div>
        </div>

        {/* ── This Week's Schedule ── */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8" }}>This Week&apos;s Schedule</div>
            <span style={{ fontSize: 10, color: "#94A3B8" }}>Click a day to change</span>
          </div>
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
        </div>

        {/* ── Day shift picker modal ── */}
        {editDay && (
          <Modal
            title={`${driver.name} — ${editDay}`}
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
                    type="radio" name="profileShift" value={key}
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

        {/* ── Recent Ratings ── */}
        {driverRatings.length > 0 && (
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>Recent Passenger Ratings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {driverRatings.slice(0, 4).map((r, i) => (
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

        {/* ── Recent Trips ── */}
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 14 }}>Recent Trips Driven</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentTrips.length === 0 ? (
              <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "16px 0" }}>No recent trips found</div>
            ) : recentTrips.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{t.route}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.date} · {t.time} · {t.vehicle}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                  background: t.status === "Completed" ? "#F0FDF4" : t.status === "Ongoing" ? "#EFF6FF" : t.status === "Delayed" ? "#FFFBEB" : "#F3F4F6",
                  color:      t.status === "Completed" ? "#059669" : t.status === "Ongoing" ? "#2563EB" : t.status === "Delayed" ? "#D97706" : "#94A3B8",
                }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OverviewTab (cameras + driver list) ──────────────────────────────────────
function OverviewTab({ drivers, selectedBusId, onEdit, onDelete, onViewProfile, search, onSearch }) {
  const filtered = drivers.filter(
    d => d.name.toLowerCase().includes(search.toLowerCase()) ||
         d.license.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      key: "name", label: "Driver",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {v.split(" ").map(w => w[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.phone}</div>
          </div>
        </div>
      ),
    },
    { key: "license", label: "License" },
    { key: "trips",   label: "Trips today" },
    {
      key: "rating", label: "Rating",
      render: v => v
        ? <span style={{ color: "#f9a825", fontWeight: 600 }}>★ {v}</span>
        : <span style={{ color: "#ccc" }}>—</span>,
    },
    { key: "status", label: "Status", render: v => <StatusPill status={v} /> },
    {
      key: "actions", label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); onViewProfile(row); }} style={{ fontSize: 11, color: "#7C3AED", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Profile</button>
          <button onClick={e => { e.stopPropagation(); onEdit(row); }} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete(row.id); }} style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <PassengerCamPanel busId={selectedBusId} />
        <DriverCamPanel busId={selectedBusId} />
      </div>
      <LiveCountPanel busId={selectedBusId} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          placeholder="Search by name or license..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
        />
        <Panel title="Driver list">
          <DataTable columns={columns} rows={filtered} onRowClick={onViewProfile} />
          {filtered.length === 0 && (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No drivers match your search.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Performance score (0–100) ────────────────────────────────────────────────
function calcScore(d) {
  const onTime     = d.on_time_pct * 0.40;
  const rating     = (d.avg_rating / 5) * 100 * 0.35;
  const noComplaints = Math.max(0, 25 - d.complaints * 5);
  return Math.round(onTime + rating + noComplaints);
}

function ScoreBar({ score }) {
  const color = score >= 85 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ── Performance Tab ──────────────────────────────────────────────────────────
function PerformanceTab() {
  const [data, setData] = useState([]);

  useEffect(() => {
    getDriverPerformance()
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]));
  }, []);

  const rows = data.map(d => ({ ...d, score: calcScore(d) }));
  const avgOnTime      = rows.length ? Math.round(rows.reduce((s, d) => s + d.on_time_pct, 0) / rows.length) : 0;
  const totalComplaints = rows.reduce((s, d) => s + d.complaints, 0);
  const totalTrips     = rows.reduce((s, d) => s + d.trips_week, 0);
  const avgIdle        = rows.length ? (rows.reduce((s, d) => s + d.idle_hours, 0) / rows.length).toFixed(1) : "0.0";

  const columns = [
    {
      key: "name", label: "Driver",
      render: v => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {v.split(" ").map(w => w[0]).join("").slice(0, 2)}
          </div>
          <span style={{ fontWeight: 600, color: "#0F172A" }}>{v}</span>
        </div>
      ),
    },
    { key: "trips_week", label: "Trips (week)",
      render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      key: "on_time_pct", label: "On-Time Rate",
      render: v => {
        const c = v >= 90 ? "#10B981" : v >= 75 ? "#F59E0B" : "#EF4444";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 60, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${v}%`, height: "100%", background: c, borderRadius: 3 }} />
            </div>
            <span style={{ fontWeight: 700, color: c, fontSize: 12 }}>{v}%</span>
          </div>
        );
      },
    },
    {
      key: "complaints", label: "Complaints",
      render: v => v === 0
        ? <span style={{ color: "#10B981", fontWeight: 600, fontSize: 12 }}>None</span>
        : <span style={{ color: "#EF4444", fontWeight: 700, fontSize: 12 }}>{v} complaint{v > 1 ? "s" : ""}</span>,
    },
    {
      key: "avg_rating", label: "Avg Rating",
      render: v => v != null
        ? <span style={{ color: "#f9a825", fontWeight: 700 }}>★ {v}</span>
        : <span style={{ color: "#ccc" }}>—</span>,
    },
    {
      key: "idle_hours", label: "Idle Hours",
      render: v => {
        const c = v > 5 ? "#EF4444" : v > 3 ? "#F59E0B" : "#64748B";
        return <span style={{ color: c, fontWeight: 600 }}>{v}h</span>;
      },
    },
    {
      key: "score", label: "Performance Score",
      render: (v) => <ScoreBar score={v} />,
    },
  ];

  const iconStyle = { width: 18, height: 18 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard
          label="Avg On-Time Rate"
          value={`${avgOnTime}%`}
          delta={avgOnTime >= 85 ? "On target" : "Below target"}
          up={avgOnTime >= 85}
          accent="#10B981"
          icon={<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          label="Complaints This Week"
          value={totalComplaints}
          delta={totalComplaints === 0 ? "No complaints" : `${totalComplaints} total`}
          up={totalComplaints === 0}
          accent="#EF4444"
          icon={<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <StatCard
          label="Total Trips This Week"
          value={totalTrips}
          delta="All active drivers"
          accent="#2563EB"
          icon={<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7m6 10V7"/></svg>}
        />
        <StatCard
          label="Avg Idle Time"
          value={`${avgIdle}h`}
          delta={parseFloat(avgIdle) > 4 ? "High idle time" : "Acceptable"}
          up={parseFloat(avgIdle) <= 3}
          accent="#7C3AED"
          icon={<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>}
        />
      </div>

      {/* Performance table */}
      <Panel title="Driver Performance Breakdown">
        <DataTable columns={columns} rows={rows} />
        {rows.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No performance data available.</div>
        )}
      </Panel>
    </div>
  );
}

// ── Shift cell ───────────────────────────────────────────────────────────────
function ShiftCell({ shift, onClick }) {
  const cfg = SHIFT_CONFIG[shift] || SHIFT_CONFIG.off;
  return (
    <div
      onClick={onClick}
      title={cfg.time || cfg.label}
      style={{
        padding: "6px 8px", borderRadius: 7, background: cfg.bg,
        border: `1px solid ${cfg.color}22`, cursor: "pointer",
        textAlign: "center", transition: "all .15s", userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.95)"; e.currentTarget.style.transform = "scale(1.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: ".02em" }}>{cfg.label}</div>
      {cfg.time && <div style={{ fontSize: 9, color: cfg.color + "99", marginTop: 1 }}>{cfg.time}</div>}
    </div>
  );
}

// ── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab() {
  const [schedules,    setSchedules]    = useState([]);
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [assignModal,  setAssignModal]  = useState(null);
  const [selectedShift, setSelectedShift] = useState("morning");
  const [saveError,    setSaveError]    = useState(null);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    getDriverSchedules()
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(() => setSchedules([]));
  }, []);

  // Compute dates for the displayed week
  function getWeekDates() {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    return DAYS.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { day, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    });
  }

  const weekDates = getWeekDates();
  const weekLabel = `${weekDates[0].label} – ${weekDates[6].label}`;

  function openAssign(schedule, day) {
    // DB columns are lowercase (mon/tue/…) — always use lowercase to read
    setSelectedShift(schedule[day.toLowerCase()] || "off");
    setAssignModal({ driverId: schedule.driver_id, driverName: schedule.driver_name, day });
    setSaveError(null);
  }

  async function handleAssign() {
    setSaving(true);
    setSaveError(null);
    // Update the local copy using lowercase keys so reads stay consistent
    const dayKey  = assignModal.day.toLowerCase();
    const updated = schedules.map(s =>
      s.driver_id === assignModal.driverId ? { ...s, [dayKey]: selectedShift } : s
    );
    const row = updated.find(s => s.driver_id === assignModal.driverId);
    // Build the payload the backend expects (Mon/Tue/… keys)
    const payload = Object.fromEntries(
      DAYS.map(d => [d, row?.[d.toLowerCase()] || "off"])
    );
    try {
      await updateDriverSchedule(assignModal.driverId, payload);
      setSchedules(updated);
      setAssignModal(null);
    } catch (err) {
      setSaveError(err?.message ?? "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  const shiftSummary = Object.fromEntries(
    Object.keys(SHIFT_CONFIG).map(k => [k, 0])
  );
  schedules.forEach(s => DAYS.forEach(d => { const v = s[d.toLowerCase()]; if (shiftSummary[v] !== undefined) shiftSummary[v]++; }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Legend + week nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {Object.entries(SHIFT_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.color}44` }} />
            <span style={{ fontSize: 11, color: "#64748B" }}>{v.label}</span>
            {v.time && <span style={{ fontSize: 10, color: "#94A3B8" }}>({v.time})</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" }}
          >‹ Prev</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
            Week of {weekLabel}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" }}
          >Next ›</button>
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: weekOffset === 0 ? "#F8FAFC" : "#fff", cursor: weekOffset === 0 ? "default" : "pointer", fontSize: 12, color: weekOffset === 0 ? "#94A3B8" : "#2563EB" }}
          >Today</button>
        </div>
      </div>

      {/* Schedule grid */}
      <Panel title="Weekly Shift Schedule" noPad>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                <th style={{ padding: "12px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", width: 180, background: "#FAFAFA" }}>
                  Driver
                </th>
                {weekDates.map(({ day, label }) => (
                  <th key={day} style={{ padding: "12px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", background: "#FAFAFA" }}>
                    <div>{day}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: "#CBD5E1", marginTop: 2 }}>{label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule, ri) => (
                <tr key={schedule.driver_id} style={{ borderBottom: "1px solid #F8FAFC", background: ri % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "10px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {schedule.driver_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{schedule.driver_name}</span>
                    </div>
                  </td>
                  {DAYS.map(day => (
                    <td key={day} style={{ padding: "6px 4px", textAlign: "center" }}>
                      <ShiftCell shift={schedule[day.toLowerCase()] || "off"} onClick={() => openAssign(schedule, day)} />
                    </td>
                  ))}
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No schedule data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Assign shift modal */}
      {assignModal && (
        <Modal title={`Assign Shift — ${assignModal.driverName}`} onClose={() => { setAssignModal(null); setSaveError(null); }} onSave={handleAssign} saving={saving}>
          {saveError && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
              {saveError}
            </div>
          )}
          <p style={{ fontSize: 13, color: "#475569", marginBottom: 16, marginTop: 0 }}>
            Select shift for <strong>{assignModal.day}</strong>:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => (
              <label
                key={key}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${selectedShift === key ? cfg.color : "#E2E8F0"}`,
                  background: selectedShift === key ? cfg.bg : "#fff",
                  transition: "all .15s",
                }}
              >
                <input
                  type="radio"
                  name="shift"
                  value={key}
                  checked={selectedShift === key}
                  onChange={() => setSelectedShift(key)}
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
    </div>
  );
}

// ── Main DriversPage ─────────────────────────────────────────────────────────
function LicenseAlertsTab({ drivers, onEdit }) {
  const rows = drivers
    .map((driver) => ({ ...driver, alert: licenseAlert(driver.license_expiry) }))
    .filter((driver) => driver.license_expiry);
  const hot = rows.filter((driver) => driver.alert?.tier !== "ok");
  const counts = {
    expired: rows.filter((d) => d.alert?.tier === "expired").length,
    seven: rows.filter((d) => d.alert?.tier === "7-day").length,
    fourteen: rows.filter((d) => d.alert?.tier === "14-day").length,
    thirty: rows.filter((d) => d.alert?.tier === "30-day").length,
  };

  const columns = [
    {
      key: "name",
      label: "Driver",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{v}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{row.license}</div>
        </div>
      ),
    },
    { key: "license_expiry", label: "Expiry Date", render: (v) => <span style={{ fontSize: 12, color: "#475569" }}>{fmtDate(v)}</span> },
    {
      key: "alert",
      label: "Alert Window",
      render: (v) => (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: v.bg, color: v.color, border: `1px solid ${v.border}` }}>
          {v.tier === "ok" ? "OK" : v.tier} · {v.label}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_, row) => (
        <button onClick={() => onEdit(row)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
          Edit
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="Expired" value={counts.expired} delta="already overdue" up={counts.expired === 0} accent="#DC2626" />
        <StatCard label="7-Day" value={counts.seven} delta="renew immediately" up={counts.seven === 0} accent="#EF4444" />
        <StatCard label="14-Day" value={counts.fourteen} delta="critical window" up={counts.fourteen === 0} accent="#F97316" />
        <StatCard label="30-Day" value={counts.thirty} delta="warning window" up={counts.thirty === 0} accent="#D97706" />
      </div>

      {hot.length > 0 && (
        <Panel title={`${hot.length} driver licenses need attention`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hot
              .sort((a, b) => daysUntil(a.license_expiry) - daysUntil(b.license_expiry))
              .map((driver) => (
                <div key={driver.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: driver.alert.bg, border: `1px solid ${driver.alert.border}`, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{driver.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B" }}>{driver.license} · expires {fmtDate(driver.license_expiry)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: driver.alert.color }}>{driver.alert.label}</span>
                </div>
              ))}
          </div>
        </Panel>
      )}

      <Panel title="All Driver License Expiry Status">
        <DataTable columns={columns} rows={rows.sort((a, b) => daysUntil(a.license_expiry) - daysUntil(b.license_expiry))} />
      </Panel>
    </div>
  );
}

// ── Checklist audit tab ───────────────────────────────────────────────────────

function CheckMark({ ok }) {
  return ok
    ? <span style={{ color: "#059669", fontWeight: 700, fontSize: 15 }}>✓</span>
    : <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 15 }}>✗</span>;
}

function ChecklistsTab() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("All"); // All | Pass | Fail

  useEffect(() => {
    getTripChecklists()
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading message="Loading checklists…" />;

  const allPass = r => r.fuel_ok && r.lights_ok && r.tires_ok;

  const visible = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.driver ?? "").toLowerCase().includes(q)
      || (r.trip_ref ?? "").toLowerCase().includes(q)
      || (r.vehicle  ?? "").toLowerCase().includes(q);
    const matchFilter = filter === "All" || (filter === "Pass" ? allPass(r) : !allPass(r));
    return matchSearch && matchFilter;
  });

  // Per-driver compliance summary
  const driverMap = {};
  rows.forEach(r => {
    if (!driverMap[r.driver]) driverMap[r.driver] = { total: 0, passed: 0 };
    driverMap[r.driver].total++;
    if (allPass(r)) driverMap[r.driver].passed++;
  });
  const summaryRows = Object.entries(driverMap)
    .map(([name, s]) => ({ name, total: s.total, passed: s.passed, pct: Math.round((s.passed / s.total) * 100) }))
    .sort((a, b) => a.pct - b.pct);

  const totalPass = rows.filter(allPass).length;
  const passRate  = rows.length ? Math.round((totalPass / rows.length) * 100) : 0;

  function fmtDt(dt) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        {[
          { label: "Total Submissions", value: rows.length,                  color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
          { label: "All-Clear Passes",  value: totalPass,                    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
          { label: "Failed Checks",     value: rows.length - totalPass,      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          { label: "Overall Pass Rate", value: `${passRate}%`,               color: passRate >= 80 ? "#059669" : "#D97706", bg: passRate >= 80 ? "#ECFDF5" : "#FFFBEB", border: passRate >= 80 ? "#A7F3D0" : "#FDE68A" },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: k.color, marginTop: 6, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Per-driver compliance summary */}
      <Panel title="Per-Driver Compliance">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summaryRows.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 130, fontSize: 12, fontWeight: 600, color: "#0F172A", flexShrink: 0 }}>{s.name}</div>
              <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 4, transition: "width .5s ease",
                  background: s.pct >= 80 ? "#10B981" : s.pct >= 60 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <div style={{ width: 80, fontSize: 11, fontWeight: 700, color: s.pct >= 80 ? "#059669" : s.pct >= 60 ? "#D97706" : "#DC2626", textAlign: "right", flexShrink: 0 }}>
                {s.passed}/{s.total} ({s.pct}%)
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search driver, trip, vehicle…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 260 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Pass", "Fail"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border:     filter === f ? "none" : "1px solid #E2E8F0",
              background: filter === f ? (f === "Pass" ? "#059669" : f === "Fail" ? "#DC2626" : "#2563EB") : "#fff",
              color:      filter === f ? "#fff" : "#64748B",
              fontWeight: filter === f ? 600 : 400,
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <Panel title={`${visible.length} checklist submission${visible.length !== 1 ? "s" : ""}`} noPad>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
              {["Trip", "Driver", "Vehicle", "Route", "Fuel", "Lights", "Tires", "Status", "Submitted At"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const pass = allPass(r);
              return (
                <tr key={r.checklist_id} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563EB", fontSize: 12 }}>{r.trip_ref}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{r.driver}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontFamily: "monospace", color: "#2563EB", fontWeight: 600 }}>{r.vehicle}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{r.route}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}><CheckMark ok={r.fuel_ok} /></td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}><CheckMark ok={r.lights_ok} /></td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}><CheckMark ok={r.tires_ok} /></td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                      background: pass ? "#ECFDF5" : "#FEF2F2",
                      color:      pass ? "#059669"  : "#DC2626",
                      border:     `1px solid ${pass ? "#A7F3D0" : "#FECACA"}`,
                    }}>
                      {pass ? "ALL CLEAR" : "ISSUES"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>{fmtDt(r.submitted_at)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={9} style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No checklists match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export default function DriversPage() {
  const [tab, setTab] = useState("Overview");
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError,   setDriversError]   = useState(null);
  const [search, setSearch] = useState("");
  const [selectedBusId, setSelectedBusId] = useState(DEFAULT_BUS_ID);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [editTarget,       setEditTarget]       = useState(null);
  const [form,             setForm]             = useState(EMPTY_FORM);
  const [saveError,        setSaveError]        = useState(null);
  const [isSaving,         setIsSaving]         = useState(false);
  const [formSchedEditDay, setFormSchedEditDay] = useState(null); // which day pill is open in add modal
  const [deleteId,         setDeleteId]         = useState(null);
  const [profile,          setProfile]          = useState(null);

  const loadDrivers = useCallback(() => {
    setDriversLoading(true);
    setDriversError(null);
    getDrivers()
      .then(data => {
        const rows = data?.data ?? data;
        setDrivers((rows || []).map(normalizeDriver));
      })
      .catch(err => {
        setDrivers([]);
        setDriversError(err?.message ?? "Could not reach server — showing demo data");
      })
      .finally(() => setDriversLoading(false));
  }, []);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  function openProfile(d) { setProfile(d); }

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setFormSchedEditDay(null);
    setModalOpen(true);
  }

  function openEdit(d) {
    setEditTarget(d.id);
    setSaveError(null);
    setForm({ name: d.name, email: "", password: "", phone: d.phone ?? "", birthDate: "", license: d.license, license_expiry: d.license_expiry ?? "", status: d.status, schedule: { ...DEFAULT_SCHEDULE } });
    setModalOpen(true);
  }

  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!form.license) { setSaveError("License number is required."); return; }
    if (!editTarget) {
      if (!form.name)     { setSaveError("Full name is required."); return; }
      if (!form.email)    { setSaveError("Email is required."); return; }
      if (!form.password) { setSaveError("Password is required."); return; }
      if (form.birthDate && form.birthDate > today) { setSaveError("Date of birth cannot be in the future."); return; }
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      if (editTarget) {
        await updateDriver(editTarget, {
          license_number:      form.license,
          license_expiry_date: form.license_expiry || null,
        });
        setDrivers(prev => prev.map(d => d.id === editTarget ? { ...d, license: form.license, license_expiry: form.license_expiry, status: form.status } : d));
      } else {
        // 1. Create the user with role=driver
        const newUser = await createUser({
          full_name:  form.name,
          email:      form.email,
          password:   form.password,
          phone:      form.phone || null,
          birth_date: form.birthDate || null,
          role:       "driver",
        });
        // 2. Create the driver record
        const newDriver = await createDriver({
          user_id:             newUser.user_id,
          license_number:      form.license,
          license_expiry_date: form.license_expiry || null,
          hire_date:           today,
        });
        // 3. Seed the schedule
        if (newDriver?.driver_id) {
          await updateDriverSchedule(newDriver.driver_id, form.schedule).catch(() => {});
        }
        await loadDrivers();
      }
      setModalOpen(false);
    } catch (err) {
      setSaveError(err?.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() { setDrivers(prev => prev.filter(d => d.id !== deleteId)); setDeleteId(null); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Drivers</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {drivers.length} total drivers · {drivers.filter((d) => {
              const alert = licenseAlert(d.license_expiry);
              return alert && alert.tier !== "ok";
            }).length} license alerts · passenger &amp; driver cameras live
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {tab === "Overview" && (
          <>
            <BusSelector selectedBusId={selectedBusId} onSelect={setSelectedBusId} />
            <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "-.1px" }}>
              + Add driver
            </button>
          </>
        )}
        <TabNav tabs={["Overview", "Performance", "Schedules", "License Alerts", "Checklists"]} active={tab} onChange={setTab} />
      </div>

      {/* Tab content */}
      {tab === "Overview" && (
        driversLoading
          ? <PageLoading message="Loading drivers…" />
          : driversError
          ? <PageError message={driversError} onRetry={loadDrivers} />
          : drivers.length === 0
          ? <PageEmpty message="No drivers found" hint="Add your first driver with the + Add Driver button" icon="🚌" />
          : <OverviewTab
              drivers={drivers}
              selectedBusId={selectedBusId}
              onEdit={openEdit}
              onDelete={setDeleteId}
              onViewProfile={openProfile}
              search={search}
              onSearch={setSearch}
            />
      )}

      {/* Driver profile drawer */}
      {profile && (
        <DriverProfile
          driver={profile}
          onClose={() => setProfile(null)}
          onEdit={d => { setProfile(null); openEdit(d); }}
        />
      )}
      {tab === "Performance"    && <PerformanceTab />}
      {tab === "Schedules"      && <ScheduleTab />}
      {tab === "License Alerts" && <LicenseAlertsTab drivers={drivers} onEdit={openEdit} />}
      {tab === "Checklists"     && <ChecklistsTab />}

      {/* Add / Edit modal */}
      {modalOpen && (
        <Modal title={editTarget ? "Edit driver" : "Add new driver"} onClose={() => { setModalOpen(false); setSaveError(null); setFormSchedEditDay(null); }} onSave={handleSave} saving={isSaving}>
          {saveError && (
            <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
              {saveError}
            </div>
          )}

          {/* ── New user fields (add only) ── */}
          {!editTarget && (<>
            {[
              { label: "Full name *",  key: "name",     type: "text",     placeholder: "e.g. Karim Moussa" },
              { label: "Email *",      key: "email",    type: "email",    placeholder: "driver@example.com" },
              { label: "Password *",   key: "password", type: "password", placeholder: "Min 8 chars, 1 upper, 1 digit, 1 symbol" },
              { label: "Phone",        key: "phone",    type: "text",     placeholder: "+968 9..." },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 5, fontWeight: 600 }}>{label}</label>
                <input
                  type={type} placeholder={placeholder} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 5, fontWeight: 600 }}>
                Date of birth <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
              </label>
              <input type="date" value={form.birthDate} max={today}
                onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0 16px" }} />
          </>)}

          {/* ── Driver fields ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 5, fontWeight: 600 }}>License number *</label>
            <input
              placeholder="e.g. LB-20341" value={form.license}
              onChange={e => setForm(f => ({ ...f, license: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 5, fontWeight: 600 }}>License expiry</label>
            <input type="date" value={form.license_expiry}
              onChange={e => setForm(f => ({ ...f, license_expiry: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {editTarget && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 5, fontWeight: 600 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
          )}

          {/* ── Schedule (add only) — same pill UI as profile ── */}
          {!editTarget && (
            <div>
              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0 16px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  Weekly schedule <span style={{ fontWeight: 400, color: "#94A3B8" }}>(click a day to set)</span>
                </label>
              </div>

              {/* Day pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: formSchedEditDay ? 12 : 0 }}>
                {DAYS.map(day => {
                  const val = form.schedule[day] || "off";
                  const cfg = SHIFT_CONFIG[val] || SHIFT_CONFIG.off;
                  const active = formSchedEditDay === day;
                  return (
                    <div key={day} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>{day}</div>
                      <button
                        onClick={() => setFormSchedEditDay(active ? null : day)}
                        style={{
                          padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                          background: cfg.bg,
                          border: `${active ? 2 : 1}px solid ${active ? cfg.color : cfg.color + "44"}`,
                          fontSize: 10, fontWeight: 700, color: cfg.color, whiteSpace: "nowrap",
                          boxShadow: active ? `0 0 0 2px ${cfg.color}33` : "none",
                        }}
                      >
                        {cfg.label}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Inline shift picker — appears below pills when a day is active */}
              {formSchedEditDay && (
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 10 }}>
                    {formSchedEditDay} — select shift:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.entries(SHIFT_CONFIG).map(([key, cfg]) => {
                      const selected = (form.schedule[formSchedEditDay] || "off") === key;
                      return (
                        <label
                          key={key}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                            border: `2px solid ${selected ? cfg.color : "#E2E8F0"}`,
                            background: selected ? cfg.bg : "#fff",
                            transition: "all .12s",
                          }}
                        >
                          <input
                            type="radio" name="formShift" value={key} checked={selected}
                            onChange={() => {
                              setForm(f => ({ ...f, schedule: { ...f.schedule, [formSchedEditDay]: key } }));
                              setFormSchedEditDay(null);
                            }}
                            style={{ accentColor: cfg.color }}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                            {cfg.time && <div style={{ fontSize: 10, color: cfg.color + "99", marginTop: 1 }}>{cfg.time}</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Delete driver" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>Are you sure you want to delete this driver? This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#ef5350", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
