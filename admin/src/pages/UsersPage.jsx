import { useState, useEffect, useCallback } from "react";
import { PageLoading, PageError, PageEmpty } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { getUsers, getPassengerHeatmap } from "../api/endpoints";
import apiClient from "../api/apiClient";
import {
  MOCK_USERS, MOCK_DRIVERS, MOCK_PERFORMANCE, MOCK_TRIPS,
  MOCK_RATINGS, MOCK_SCHEDULES, MOCK_STAFF, MOCK_STAFF_TRANSACTIONS,
  MOCK_HEATMAP_DATA, MOCK_ROUTE_POPULARITY, MOCK_PEAK_HOURS,
} from "../data/mockData";

const ROLES = ["Passenger", "Driver", "Admin", "Staff"];

const ROLE_STYLE = {
  Admin:     { bg: "#FEF2F2", color: "#B91C1C" },
  Driver:    { bg: "#EFF6FF", color: "#1E40AF" },
  Passenger: { bg: "#F5F3FF", color: "#6D28D9" },
  Staff:     { bg: "#F0FDF4", color: "#059669" },
};

const CAT_STYLE = {
  Regular:          { bg: "#F0FDF4", color: "#059669" },
  Student:          { bg: "#EFF6FF", color: "#2563EB" },
  "Senior Citizen": { bg: "#FFFBEB", color: "#D97706" },
  Staff:            { bg: "#F5F3FF", color: "#7C3AED" },
};

const CATEGORIES = ["Regular", "Student", "Senior Citizen", "Staff"];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_CONFIG = {
  morning:   { label: "Morning",   color: "#2563EB", bg: "#EFF6FF" },
  afternoon: { label: "Afternoon", color: "#D97706", bg: "#FFFBEB" },
  night:     { label: "Night",     color: "#7C3AED", bg: "#F5F3FF" },
  off:       { label: "Off",       color: "#94A3B8", bg: "#F8FAFC" },
  vacation:  { label: "Vacation",  color: "#10B981", bg: "#ECFDF5" },
};

const ROUTES_LIST = [
  "Route 1 — Central ↔ Airport",
  "Route 2 — North Terminal ↔ Downtown",
  "Route 3 — East Gate ↔ Mall",
  "Route 4 — West Campus ↔ Hospital",
  "Route 5 — Industrial ↔ CBD",
];
const TRIP_STATUS = ["Completed", "Completed", "Completed", "Cancelled", "Completed"];

function seedTrips(userId) {
  const hash = String(userId).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date("2026-05-05");
    d.setDate(d.getDate() - (i * 4 + (hash % 3)));
    const fare = (1.5 + ((hash + i * 7) % 30) * 0.1).toFixed(2);
    return {
      id: `T-${1000 + hash % 100 + i}`,
      date: d.toISOString().slice(0, 10),
      route: ROUTES_LIST[(hash + i * 3) % ROUTES_LIST.length],
      fare: `OMR ${fare}`,
      status: TRIP_STATUS[(hash + i) % TRIP_STATUS.length],
    };
  });
}

function seedAdminActivity(userId) {
  const hash = String(userId).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const actions = [
    "Updated driver license for Karim Moussa",
    "Added new vehicle BUS-14 (Mercedes Sprinter)",
    "Created user account for new passenger",
    "Reviewed and resolved rating complaint #R-112",
    "Modified route 12A — added 2 stops",
    "Approved wallet top-up request (OMR 150)",
    "Generated monthly analytics report",
    "Updated RBAC permissions for Finance Officer role",
  ];
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date("2026-05-05");
    d.setDate(d.getDate() - i * 2);
    return {
      action: actions[(hash + i) % actions.length],
      date: d.toISOString().slice(0, 10),
      time: `${9 + ((hash + i * 3) % 9)}:${String((hash * i) % 60).padStart(2, "0")}`,
    };
  });
}

function calcScore(d) {
  const onTime = d.on_time_pct * 0.40;
  const rating = (d.avg_rating / 5) * 100 * 0.35;
  const noComplaints = Math.max(0, 25 - d.complaints * 5);
  return Math.round(onTime + rating + noComplaints);
}

const EMPTY_FORM = { name: "", email: "", role: "Passenger", status: "Active" };

function normalizeUser(u) {
  return {
    id:         u.user_id ?? u.id,
    name:       u.full_name ?? u.name ?? "",
    email:      u.email ?? "",
    phone:      u.phone ?? null,
    role:       u.role ?? "Passenger",
    joined:     u.created_at ? u.created_at.slice(0, 10) : (u.joined ?? ""),
    trips:      u.trips ?? 0,
    status:     u.status ?? "Active",
    nationalId: u.national_id ?? null,
    category:   u.category ?? "Regular",
    photo:      u.photo ?? null,
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

function DrawerHeader({ title, accent, onClose, onEdit, children }) {
  return (
    <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{title}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {onEdit && (
            <button onClick={onEdit} style={{ background: accent?.bg ?? "#EFF6FF", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: accent?.color ?? "#2563EB", fontSize: 12, fontWeight: 600 }}>
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

// ── Passenger Profile ────────────────────────────────────────────────────────
function PassengerProfile({ user, onClose, onEdit }) {
  const trips     = seedTrips(user.id);
  const completed = trips.filter(t => t.status === "Completed").length;
  const rs        = ROLE_STYLE.Passenger;
  const cs        = CAT_STYLE[user.category] ?? CAT_STYLE.Regular;
  const initials  = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const walletBal = `OMR ${(((String(user.id).charCodeAt(0) * 3) % 50) + 5).toFixed(2)}`;
  const phone     = user.phone || "+968 9" + String(user.id * 7 % 9000000 + 1000000);
  const nationalId = user.nationalId || "IC-" + String(user.id).padStart(6, "0") + "X";

  return (
    <ProfileDrawer onClose={onClose}>
      <DrawerHeader title="Passenger Profile" accent={rs} onClose={onClose} onEdit={onEdit}>
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
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: cs.bg, color: cs.color }}>{user.category ?? "Regular"}</span>
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
          <InfoTile label="Category"        value={user.category ?? "Regular"} />
          <InfoTile label="Wallet Balance"  value={walletBal} accent="#059669" />
          <InfoTile label="Phone"           value={phone} />
          <InfoTile label="Joined"          value={user.joined || "—"} />
          <InfoTile label="Total Trips"     value={user.trips ?? completed} />
        </div>
      </div>

      {/* Trip History */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SectionLabel>Trip History</SectionLabel>
          <span style={{ fontSize: 11, color: "#64748B", marginTop: -14 }}>{completed} completed · {trips.length - completed} cancelled</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {trips.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.route}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.date} · {t.id}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{t.fare}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: t.status === "Completed" ? "#F0FDF4" : "#FEF2F2", color: t.status === "Completed" ? "#059669" : "#DC2626" }}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProfileDrawer>
  );
}

// ── Driver Profile (from Users list) ────────────────────────────────────────
function DriverUserProfile({ user, onClose, onEdit }) {
  const rs       = ROLE_STYLE.Driver;
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Enrich with driver-specific mock data matched by name
  const driverData = MOCK_DRIVERS.find(d => d.name === user.name) ?? {};
  const perf       = MOCK_PERFORMANCE.find(p => p.name === user.name) ?? {
    trips_week: 0, on_time_pct: 85, complaints: 0, avg_rating: driverData.rating ?? null, idle_hours: 3.0,
  };
  const schedule    = MOCK_SCHEDULES.find(s => s.driver_name === user.name);
  const recentTrips = MOCK_TRIPS.filter(t => t.driver === user.name).slice(0, 5);
  const ratings     = MOCK_RATINGS.filter(r => r.driver === user.name);
  const score       = calcScore(perf);
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
              {driverData.rating && <span style={{ color: "#f9a825", fontWeight: 700, fontSize: 12 }}>★ {driverData.rating}</span>}
            </div>
          </div>
        </div>
      </DrawerHeader>

      {/* Identity & Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Identity &amp; Contact</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoTile label="License No."  value={driverData.license ?? "—"} />
          <InfoTile label="Phone"        value={driverData.phone ?? user.phone ?? "—"} />
          <InfoTile label="Joined"       value={user.joined || "—"} />
          <InfoTile label="Status"       value={user.status} />
          <InfoTile label="Total Trips"  value={user.trips ?? 0} />
          <InfoTile label="Perf. Score"  value={`${score} / 100`} accent={scoreColor} />
        </div>
      </div>

      {/* Performance */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>This Week&apos;s Performance</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Trips",      value: perf.trips_week,        color: "#2563EB" },
            { label: "On-Time",    value: `${perf.on_time_pct}%`, color: perf.on_time_pct >= 90 ? "#10B981" : perf.on_time_pct >= 75 ? "#F59E0B" : "#EF4444" },
            { label: "Complaints", value: perf.complaints,         color: perf.complaints === 0 ? "#10B981" : "#EF4444" },
            { label: "Idle",       value: `${perf.idle_hours}h`,  color: perf.idle_hours > 4 ? "#EF4444" : "#64748B" },
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

      {/* Weekly Schedule */}
      {schedule && (
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <SectionLabel>This Week&apos;s Schedule</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DAYS.map(day => {
              const shift = schedule[day] || "off";
              const cfg   = SHIFT_CONFIG[shift] || SHIFT_CONFIG.off;
              return (
                <div key={day} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4, fontWeight: 600 }}>{day}</div>
                  <div style={{ padding: "5px 8px", borderRadius: 7, background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: 10, fontWeight: 700, color: cfg.color, whiteSpace: "nowrap" }}>{cfg.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  background: t.status === "Completed" ? "#F0FDF4" : t.status === "Ongoing" ? "#EFF6FF" : t.status === "Delayed" ? "#FFFBEB" : "#F3F4F6",
                  color:      t.status === "Completed" ? "#059669" : t.status === "Ongoing" ? "#2563EB" : t.status === "Delayed" ? "#D97706" : "#94A3B8",
                }}>
                  {t.status}
                </span>
              </div>
            ))
          }
        </div>
      </div>
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
  const activity = seedAdminActivity(user.id);

  return (
    <ProfileDrawer onClose={onClose}>
      <DrawerHeader title="Admin Profile" accent={rs} onClose={onClose} onEdit={onEdit}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,.30)" }}>
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
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563EB", marginTop: 5, flexShrink: 0 }} />
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
  const rs       = ROLE_STYLE.Staff;
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const staffRec  = MOCK_STAFF.find(s => s.name === user.name) ?? {};
  const staffTxns = MOCK_STAFF_TRANSACTIONS.filter(t => t.staff === user.name);
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
          <InfoTile label="Daily Limit"    value={staffRec.daily_limit ? `OMR ${staffRec.daily_limit.toLocaleString()}` : "—"} />
          <InfoTile label="Per-TX Limit"   value={staffRec.tx_limit   ? `OMR ${staffRec.tx_limit}`                       : "—"} />
          <InfoTile label="Status"         value={user.status} />
          <InfoTile label="Flagged Txns"   value={suspicious.length} accent={suspicious.length > 0 ? "#DC2626" : "#059669"} />
        </div>
      </div>

      {/* Today's stats */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
        <SectionLabel>Today&apos;s Activity</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Top-Ups",     value: staffRec.today_count ?? 0,   color: "#2563EB" },
            { label: "Volume",      value: staffRec.today_total ? `OMR ${staffRec.today_total.toLocaleString()}` : "OMR 0", color: "#059669" },
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", marginBottom: 3 }}>OMR {t.amount.toFixed(2)}</div>
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
  const headers = ["Name", "Email", "Role", "Category", "National ID", "Joined", "Trips", "Status"];
  const body = rows.map(u => [
    u.name, u.email, u.role, u.category ?? "Regular",
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
    <td>${u.category ?? "Regular"}</td><td>${u.joined}</td>
    <td>${u.trips}</td><td>${u.status}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><title>${label}</title><style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}
    h2{font-size:16px;margin:0 0 4px}p{color:#64748b;font-size:11px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse}
    th{background:#2563EB;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:700}
    td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}
    tr:nth-child(even) td{background:#f8fafc}
    @media print{@page{margin:15mm}button{display:none}}
  </style></head><body>
    <h2>${label} — Yalla Transit Admin</h2>
    <p>Exported ${new Date().toLocaleString()} · ${rows.length} records</p>
    <table><thead><tr>
      <th>Name</th><th>Email</th><th>Role</th><th>Category</th>
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

// ── Heatmap colour helper ─────────────────────────────────────────────────────
function heatColor(val, max) {
  if (max === 0 || val === 0) return "#F1F5F9";
  const t = Math.min(val / max, 1);
  // white-ish → light blue → blue → dark blue
  const stops = [[241,245,249],[219,234,254],[147,197,253],[37,99,235],[30,64,175]];
  const seg  = t * (stops.length - 1);
  const lo   = Math.floor(seg);
  const hi   = Math.min(lo + 1, stops.length - 1);
  const f    = seg - lo;
  const c    = stops[lo].map((v, i) => Math.round(v + f * (stops[hi][i] - v)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ── Passenger Activity tab ────────────────────────────────────────────────────
const CAT_COLORS = {
  Regular:         "#2563EB",
  Student:         "#7C3AED",
  "Senior Citizen":"#D97706",
  Staff:           "#059669",
};
const HMAP_DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HMAP_HOURS = Array.from({ length: 24 }, (_, i) => i);

const HEATMAP_MIN_RECORDS = 100; // minimum ticket records needed to show the grid

function ActivityTab({ users }) {
  const [catFilter,      setCatFilter]      = useState("All");
  const [heatmapData,    setHeatmapData]    = useState(null);  // null = loading
  const [peakHours,      setPeakHours]      = useState([]);
  const [heatmapTotal,   setHeatmapTotal]   = useState(null);  // null=loading, 0=error, N=count
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  useEffect(() => {
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    setHeatmapLoading(true);
    getPassengerHeatmap(from, to)
      .then(d => {
        const total = d?.total ?? 0;
        setHeatmapTotal(total);
        if (total >= HEATMAP_MIN_RECORDS && d?.heatmap) {
          setHeatmapData(d.heatmap);
          if (d?.peak_hours) setPeakHours(d.peak_hours);
        } else {
          setHeatmapData(null); // not enough data
        }
      })
      .catch(() => {
        setHeatmapTotal(0); // API unreachable — treat as insufficient
        setHeatmapData(null);
      })
      .finally(() => setHeatmapLoading(false));
  }, []);

  // Category breakdown from actual passenger list
  const passengers = users.filter(u => u.role === "Passenger");
  const catCounts  = {
    Regular:          passengers.filter(u => (u.category ?? "Regular") === "Regular").length,
    Student:          passengers.filter(u => u.category === "Student").length,
    "Senior Citizen": passengers.filter(u => u.category === "Senior Citizen").length,
    Staff:            passengers.filter(u => u.category === "Staff").length,
  };
  const totalPass = passengers.length || 1;
  const scale     = catFilter === "All" ? 1 : Math.max(0.05, (catCounts[catFilter] ?? 0) / totalPass);

  const hasData  = !heatmapLoading && heatmapData !== null && heatmapTotal >= HEATMAP_MIN_RECORDS;

  // Scale heatmap + peak hours by selected category proportion (only used when hasData)
  const heatData = hasData ? heatmapData.map(row => row.map(v => Math.round(v * scale))) : [];
  const maxHeat  = hasData ? Math.max(...heatData.flat(), 1) : 1;

  const peakData = peakHours.map(h => ({ ...h, count: Math.round(h.count * scale) }));
  const maxPeak  = Math.max(...peakData.map(h => h.count), 1);
  const top3     = [...peakData].sort((a, b) => b.count - a.count).slice(0, 3).map(h => h.hour);

  const catMaxRoute = Math.max(...MOCK_ROUTE_POPULARITY.map(r =>
    catFilter === "All"
      ? Object.values(r).filter(v => typeof v === "number").reduce((s, v) => s + v, 0)
      : (r[catFilter] ?? 0)
  ), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Category filter + summary */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {["All", ...Object.keys(CAT_COLORS)].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: catFilter === c ? "none" : "1px solid #E2E8F0",
            background: catFilter === c ? (CAT_COLORS[c] ?? "#2563EB") : "#fff",
            color:      catFilter === c ? "#fff" : "#555",
            fontWeight: catFilter === c ? 700 : 400,
          }}>{c}</button>
        ))}
        <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>
          {catFilter === "All" ? `${passengers.length} total passengers` : `${catCounts[catFilter] ?? 0} ${catFilter} passengers`}
        </span>
      </div>

      {/* Heatmap */}
      <Panel title={`Activity Heatmap — Trips by Hour & Day${catFilter !== "All" ? ` (${catFilter})` : ""}${hasData ? ` · ${heatmapTotal.toLocaleString()} records` : ""}`}>
        {heatmapLoading ? (
          /* Loading state */
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", color: "#94A3B8" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #E2E8F0", borderTopColor: "#2563EB", animation: "spin 0.7s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading booking data…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !hasData ? (
          /* Insufficient data state */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 20px", color: "#94A3B8" }}>
            <div style={{ fontSize: 36 }}>📊</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                Insufficient data
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", maxWidth: 380 }}>
                {heatmapTotal === 0 && heatmapTotal !== null
                  ? "Could not reach the analytics endpoint. Check the backend connection."
                  : `Only ${heatmapTotal ?? 0} booking record${heatmapTotal !== 1 ? "s" : ""} found in the last 30 days. At least ${HEATMAP_MIN_RECORDS} are needed to generate a meaningful activity pattern.`}
              </div>
            </div>
          </div>
        ) : (
          /* Real heatmap grid */
          <div style={{ overflowX: "auto" }}>
            {/* Hour header */}
            <div style={{ display: "flex", marginLeft: 40, marginBottom: 4, gap: 0 }}>
              {HMAP_HOURS.map(h => (
                <div key={h} style={{ width: 26, textAlign: "center", fontSize: 9, color: h % 6 === 0 ? "#475569" : "transparent", fontWeight: 700, flexShrink: 0 }}>
                  {`${h}h`}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {HMAP_DAYS.map((day, d) => (
              <div key={day} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
                <div style={{ width: 36, fontSize: 10, fontWeight: 600, color: d >= 5 ? "#7C3AED" : "#64748B", textAlign: "right", paddingRight: 6, flexShrink: 0 }}>
                  {day}
                </div>
                {HMAP_HOURS.map(h => {
                  const val = heatData[d]?.[h] ?? 0;
                  return (
                    <div
                      key={h}
                      title={`${day} ${String(h).padStart(2, "0")}:00 — ${val} bookings`}
                      style={{
                        width: 24, height: 20, borderRadius: 3, margin: "0 1px",
                        background: heatColor(val, maxHeat),
                        border: "1px solid rgba(255,255,255,0.5)",
                        cursor: "default", flexShrink: 0, transition: "transform .1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.5)"; e.currentTarget.style.zIndex = "10"; e.currentTarget.style.position = "relative"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.zIndex = "0"; e.currentTarget.style.position = "static"; }}
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10, marginLeft: 40 }}>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>Low</span>
              {[0, 0.15, 0.35, 0.55, 0.75, 1].map(t => (
                <div key={t} style={{ width: 18, height: 14, borderRadius: 3, background: heatColor(Math.round(t * maxHeat), maxHeat), flexShrink: 0 }} />
              ))}
              <span style={{ fontSize: 10, color: "#94A3B8" }}>High</span>
              <span style={{ fontSize: 10, color: "#CBD5E1", marginLeft: 8 }}>Hover for exact count</span>
            </div>
          </div>
        )}
      </Panel>

      {/* Peak hours + Route popularity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Peak hours bar chart */}
        <Panel title="Peak Hours">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {peakData.map(h => {
              const isTop = top3.includes(h.hour);
              const pct   = Math.round((h.count / maxPeak) * 100);
              return (
                <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: isTop ? 700 : 400, color: isTop ? "#0F172A" : "#64748B", width: 36, flexShrink: 0, textAlign: "right" }}>
                    {h.label}
                  </span>
                  <div style={{ flex: 1, height: 18, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 4,
                      background: isTop ? (CAT_COLORS[catFilter] ?? "#2563EB") : "#BFDBFE",
                      transition: "width .4s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isTop ? 700 : 400, color: isTop ? "#0F172A" : "#94A3B8", width: 38, flexShrink: 0 }}>
                    {h.count}
                    {isTop && <span style={{ fontSize: 9, color: "#2563EB", marginLeft: 2 }}>▲</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Route popularity by category */}
        <Panel title={`Route Popularity${catFilter !== "All" ? ` — ${catFilter}` : " by Category"}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {MOCK_ROUTE_POPULARITY.map(route => {
              const total = catFilter === "All"
                ? Object.entries(route).filter(([k]) => k !== "route").reduce((s, [, v]) => s + v, 0)
                : (route[catFilter] ?? 0);

              return (
                <div key={route.route}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{route.route}</span>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{total} trips</span>
                  </div>

                  {catFilter === "All" ? (
                    /* Stacked bar */
                    <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#F1F5F9" }}>
                      {Object.entries(CAT_COLORS).map(([cat, color]) => {
                        const v = route[cat] ?? 0;
                        const w = catMaxRoute > 0 ? (v / catMaxRoute) * 100 : 0;
                        return w > 0 ? (
                          <div key={cat} title={`${cat}: ${v}`} style={{ width: `${w}%`, height: "100%", background: color, flexShrink: 0 }} />
                        ) : null;
                      })}
                    </div>
                  ) : (
                    /* Single category bar */
                    <div style={{ height: 12, background: "#F1F5F9", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{
                        width: `${catMaxRoute > 0 ? (total / catMaxRoute) * 100 : 0}%`,
                        height: "100%", borderRadius: 6,
                        background: CAT_COLORS[catFilter],
                        transition: "width .4s ease",
                      }} />
                    </div>
                  )}

                  {/* Category breakdown legend (All only) */}
                  {catFilter === "All" && (
                    <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                      {Object.entries(CAT_COLORS).map(([cat, color]) => (
                        <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          <span style={{ fontSize: 9, color: "#64748B" }}>{cat.replace("Senior Citizen", "Senior")}: {route[cat] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Category summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {Object.entries(CAT_COLORS).map(([cat, color]) => {
          const count = catCounts[cat] ?? 0;
          const pct   = totalPass > 0 ? Math.round((count / totalPass) * 100) : 0;
          const totalTrips = MOCK_ROUTE_POPULARITY.reduce((s, r) => s + (r[cat] ?? 0), 0);
          return (
            <div key={cat} style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{cat}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{count}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>{pct}% of passengers</div>
              <div style={{ height: 5, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>{totalTrips} trips recorded</div>
            </div>
          );
        })}
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
          color:      active === id ? "#2563EB" : "#64748B",
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
  const [deleteId,     setDeleteId]     = useState(null);
  const [profile,      setProfile]      = useState(null);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    getUsers()
      .then(data => {
        const rows = data?.data ?? data;
        setUsers((rows || []).map(normalizeUser));
      })
      .catch(err => {
        setUsers(MOCK_USERS.map(normalizeUser));
        setUsersError(err?.message ?? "Could not reach server — showing demo data");
      })
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
        && (roleFilter === "All" || u.role === roleFilter);
  });

  function openAdd() { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }
  function openEdit(u) {
    setEditTarget(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) return;
    if (editTarget) {
      await apiClient.put(`/users/${editTarget}`, { full_name: form.name, phone: "" }).catch(() => {});
      setUsers(prev => prev.map(u => u.id === editTarget ? { ...u, ...form } : u));
    } else {
      const created = await apiClient.post("/auth/register", {
        full_name: form.name, email: form.email, password: "changeme123", role: form.role,
      }).catch(() => null);
      setUsers(prev => [...prev, {
        id: created?.data?.user_id ?? Date.now(),
        ...form, joined: new Date().toISOString().split("T")[0],
        trips: 0, nationalId: null, category: "Regular", phone: null, photo: null,
      }]);
    }
    setModalOpen(false);
  }

  async function handleDelete() {
    await apiClient.delete(`/users/${deleteId}`).catch(() => {});
    setUsers(prev => prev.filter(u => u.id !== deleteId));
    setDeleteId(null);
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
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: ROLE_STYLE[row.role]?.bg ?? "#EFF6FF", color: ROLE_STYLE[row.role]?.color ?? "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
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
      key: "category", label: "Category",
      render: v => {
        const s = CAT_STYLE[v] || { bg: "#F1F5F9", color: "#64748B" };
        return <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20 }}>{v ?? "Regular"}</span>;
      },
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
          <button onClick={e => { e.stopPropagation(); openEdit(row); }} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); setDeleteId(row.id); }} style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Users</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Manage all registered users · click any row or Profile to view full profile</p>
        </div>
        <div style={{ flex: 1 }} />
        {tab === "users" && (
          <>
            <ExportMenu users={users} roleFilter={roleFilter} />
            <button onClick={openAdd} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              + Add user
            </button>
          </>
        )}
        <TabNav
          tabs={[{ id: "users", label: "Users" }, { id: "activity", label: "Passenger Activity" }]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {/* KPI cards — always visible */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total users"  value={counts.all}        delta="registered"   />
        <StatCard label="Passengers"   value={counts.passengers}  delta="active"       />
        <StatCard label="Drivers"      value={counts.drivers}     delta="on platform"  />
        <StatCard label="Admins"       value={counts.admins}      delta="system users" />
        <StatCard label="Staff"        value={counts.staff}       delta="top-up agents" accent="#059669" />
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
            background: roleFilter === r ? "#2563EB" : "#fff",
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
        <Modal title={editTarget ? "Edit user" : "Add new user"} onClose={() => setModalOpen(false)} onSave={handleSave}>
          {[
            { label: "Full name", key: "name",  type: "text",  placeholder: "e.g. Ali Hassan" },
            { label: "Email",     key: "email", type: "email", placeholder: "user@mail.com" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          {[
            { label: "Role",     key: "role",     options: ROLES },
            { label: "Category", key: "category", options: CATEGORIES },
            { label: "Status",   key: "status",   options: ["Active", "Inactive"] },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{f.label}</label>
              <select value={form[f.key] ?? f.options[0]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }}>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Delete user" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>Are you sure you want to delete this user? This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Delete</button>
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
