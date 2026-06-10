import { useState, useEffect, useCallback } from "react";
import { Download, Printer, Calendar, BarChart3, Bus, Trophy } from "lucide-react";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import {
  getRevenueReport, getPassengerUsageReport,
  getDriverPerfReport, getVehicleUtilReport, getTopRoutesReport,
} from "../api/endpoints";
import { getPassengerHeatmap } from "../api/endpoints";

// ══════════════════════════════════════════════════════════════════════════════
//  Export utilities — CSV & PDF, zero external dependencies
// ══════════════════════════════════════════════════════════════════════════════

function exportCSV(rows, columns, filename) {
  const header = columns.map(c => `"${c.label}"`).join(",");
  const body   = rows.map(row =>
    columns.map(c => {
      const v = typeof c.get === "function" ? c.get(row) : (row[c.key] ?? "");
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF(title, subtitle, columns, rows) {
  const thead = columns.map(c => `<th>${c.label}</th>`).join("");
  const tbody = rows.map(row =>
    "<tr>" + columns.map(c => {
      const v = typeof c.get === "function" ? c.get(row) : (row[c.key] ?? "");
      return `<td>${v}</td>`;
    }).join("") + "</tr>"
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:24px;font-size:12px;color:#111}
      h1{font-size:18px;font-weight:700;margin:0 0 4px}
      p{color:#555;margin:0 0 18px;font-size:11px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f4f4f4;border:1px solid #ddd;padding:8px 10px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
      td{border:1px solid #e5e5e5;padding:8px 10px}
      tr:nth-child(even) td{background:#fafafa}
      @media print{body{margin:0}button{display:none}}
    </style>
  </head><body>
    <h1>${title}</h1>
    <p>${subtitle} · Generated ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</p>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

// ── Export dropdown button ────────────────────────────────────────────────────

function ExportMenu({ onCSV, onPDF }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8,
          border: "1.5px solid #E2E8F0", background: "#fff",
          fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
        }}
      >
        ⬇ Export
        <span style={{ fontSize: 10, color: "#94A3B8" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.10)", minWidth: 140, zIndex: 100,
          overflow: "hidden",
        }}>
          {[
            { Icon: Download, label: "Export as CSV", onClick: () => { onCSV(); setOpen(false); } },
            { Icon: Printer,  label: "Export as PDF", onClick: () => { onPDF(); setOpen(false); } },
          ].map(({ Icon, label, onClick }) => (
            <div key={label} onClick={onClick} style={{
              padding: "10px 14px", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "background .1s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <Icon size={14} />{label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Chart helpers
// ══════════════════════════════════════════════════════════════════════════════

function BarChart({ data, color = "#3B82F6", height = 100, labelKey = "label", valueKey = "value", maxValue }) {
  const max = maxValue ?? Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, color: "#64748B" }}>{d[valueKey]}</span>
          <div style={{
            width: "100%",
            height: Math.round((d[valueKey] / max) * (height - 20)),
            borderRadius: "4px 4px 0 0",
            background: d.highlight ? "#1D4ED8" : color,
            transition: "height .3s",
          }} />
          <span style={{ fontSize: 9, color: d.highlight ? "#1D4ED8" : "#94A3B8", fontWeight: d.highlight ? 700 : 400 }}>
            {d[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color = "#3B82F6", height = 100 }) {
  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 400, H = height - 20;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / range) * H;
    return `${x},${y}`;
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.value - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
        {data.map((d, i) => (
          <text key={i} x={(i / (data.length - 1)) * W} y={height - 2} textAnchor="middle" fontSize="9" fill="#aaa">
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Dual-bar for utilization ──────────────────────────────────────────────────

function UtilBar({ active, idle }) {
  const total = active + idle || 1;
  const pct   = Math.round((active / total) * 100);
  const color = pct >= 70 ? "#10B981" : pct >= 45 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${pct}%`, background: color, transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34 }}>{pct}%</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Mock data
// ══════════════════════════════════════════════════════════════════════════════

const WEEKLY_REVENUE  = [
  { label: "Mon", value: 1100 }, { label: "Tue", value: 1320 },
  { label: "Wed", value: 980  }, { label: "Thu", value: 1540 },
  { label: "Fri", value: 1280 }, { label: "Sat", value: 870  }, { label: "Sun", value: 760 },
];
const HOURLY_LOAD = [
  { label: "6am", value: 38 }, { label: "7am", value: 62 }, { label: "8am", value: 91 },
  { label: "9am", value: 85 }, { label: "10am", value: 55 }, { label: "11am", value: 48 },
  { label: "12pm", value: 70 }, { label: "1pm", value: 78 }, { label: "2pm", value: 60, highlight: true },
  { label: "3pm", value: 30 }, { label: "4pm", value: 45 }, { label: "5pm", value: 55 },
];
const TOP_ROUTES = [
  { route: "Route 12A", name: "City Center → Airport",        trips: 42, revenue: 3360, load: 88 },
  { route: "Route 7B",  name: "University → Downtown",        trips: 38, revenue: 2660, load: 75 },
  { route: "Route 3C",  name: "North Terminal → Mall",        trips: 31, revenue: 2170, load: 94 },
  { route: "Route 5D",  name: "Hospital → Station",           trips: 25, revenue: 1750, load: 57 },
  { route: "Route 9E",  name: "Harbor → Old City",            trips: 18, revenue: 1260, load: 63 },
];
const MONTHLY_REVENUE = [
  { label: "Oct", value: 28400 }, { label: "Nov", value: 31200 },
  { label: "Dec", value: 27800 }, { label: "Jan", value: 33100 },
  { label: "Feb", value: 35600 }, { label: "Mar", value: 41200 },
];

// Driver performance — composite score = on_time*0.4 + (no_complaint)*0.3 + rating/5*100*0.3
const DRIVER_PERF = [
  { id: 1,  name: "Karim Moussa",   trips: 45, on_time_pct: 94, complaints: 0, avg_rating: 4.9, idle_hours: 2.1 },
  { id: 4,  name: "Maya Salameh",   trips: 28, on_time_pct: 96, complaints: 0, avg_rating: 4.7, idle_hours: 1.8 },
  { id: 7,  name: "Fadi Gemayel",   trips: 42, on_time_pct: 91, complaints: 1, avg_rating: 4.8, idle_hours: 2.3 },
  { id: 2,  name: "Lara Abi Nader", trips: 38, on_time_pct: 88, complaints: 1, avg_rating: 4.5, idle_hours: 3.4 },
  { id: 10, name: "Ziad Mansour",   trips: 40, on_time_pct: 90, complaints: 0, avg_rating: 4.6, idle_hours: 2.5 },
  { id: 5,  name: "Rami Khoury",    trips: 35, on_time_pct: 85, complaints: 1, avg_rating: 4.6, idle_hours: 2.9 },
  { id: 3,  name: "Joe Pharaon",    trips: 32, on_time_pct: 79, complaints: 2, avg_rating: 4.3, idle_hours: 4.2 },
  { id: 8,  name: "Hassan Nasser",  trips: 30, on_time_pct: 82, complaints: 2, avg_rating: 4.4, idle_hours: 3.7 },
  { id: 9,  name: "Nadia Haddad",   trips: 18, on_time_pct: 75, complaints: 1, avg_rating: 4.1, idle_hours: 6.0 },
  { id: 6,  name: "Sara Khoury",    trips: 20, on_time_pct: 70, complaints: 3, avg_rating: 4.2, idle_hours: 5.6 },
].map(d => ({
  ...d,
  score: Math.round(d.on_time_pct * 0.4 + Math.max(0, (10 - d.complaints * 5)) * 0.3 + (d.avg_rating / 5) * 100 * 0.3),
})).sort((a, b) => b.score - a.score).map((d, i) => ({ ...d, rank: i + 1 }));

// Vehicle utilization
const VEHICLE_UTIL = [
  { plate: "BUS-01", type: "Standard",    active_hours: 9.5,  idle_hours: 2.5,  trips: 14, distance_km: 320 },
  { plate: "BUS-02", type: "Standard",    active_hours: 8.0,  idle_hours: 4.0,  trips: 11, distance_km: 270 },
  { plate: "BUS-03", type: "Articulated", active_hours: 10.5, idle_hours: 1.5,  trips: 16, distance_km: 410 },
  { plate: "BUS-04", type: "Mini",        active_hours: 6.5,  idle_hours: 5.5,  trips: 8,  distance_km: 195 },
  { plate: "BUS-05", type: "Standard",    active_hours: 7.0,  idle_hours: 5.0,  trips: 10, distance_km: 230 },
  { plate: "BUS-06", type: "Articulated", active_hours: 11.0, idle_hours: 1.0,  trips: 18, distance_km: 460 },
  { plate: "BUS-07", type: "Mini",        active_hours: 3.5,  idle_hours: 8.5,  trips: 4,  distance_km: 95  },
  { plate: "BUS-08", type: "Standard",    active_hours: 8.5,  idle_hours: 3.5,  trips: 12, distance_km: 290 },
].map(d => ({
  ...d,
  utilization_pct: Math.round((d.active_hours / (d.active_hours + d.idle_hours)) * 100),
})).sort((a, b) => b.utilization_pct - a.utilization_pct);

const RANGE_OPTIONS = ["This week", "Last 30 days", "Last 3 months"];

// ── shared table styles ───────────────────────────────────────────────────────

const TH = {
  padding: "8px 12px", textAlign: "left", fontSize: 10,
  fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
  letterSpacing: ".04em", borderBottom: "1px solid #F1F5F9",
  background: "#F8FAFC", whiteSpace: "nowrap",
};
const TD = { padding: "10px 12px", fontSize: 13, color: "#374151" };

// ══════════════════════════════════════════════════════════════════════════════
//  Tab: Overview
// ══════════════════════════════════════════════════════════════════════════════

const OVERVIEW_COLS = [
  { label: "Route",       key: "route"   },
  { label: "Description", key: "name"    },
  { label: "Trips",       key: "trips"   },
  { label: "Revenue ($)", key: "revenue" },
  { label: "Avg Load %",  key: "load"    },
];

function OverviewTab({ range, weekRevenue, monthlyRevenue, hourlyLoad, topRoutes, kpi }) {
  const routes = topRoutes.length ? topRoutes : TOP_ROUTES;
  const doCSV  = () => exportCSV(routes, OVERVIEW_COLS, `top-routes-${Date.now()}.csv`);
  const doPDF  = () => exportPDF("Top Routes by Revenue", `Range: ${range}`, OVERVIEW_COLS, routes);

  const totalRevenue = weekRevenue.reduce((s, d) => s + d.value, 0);
  const peakHour     = hourlyLoad.reduce((p, c) => c.value > p.value ? c : p, { label:"—", value:0 });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total revenue"     value={`$${kpi.revenue.toLocaleString(undefined, {maximumFractionDigits:0})}`}  delta="this period" up={true}  />
        <StatCard label="Total passengers"  value={kpi.passengers.toLocaleString()}  delta="tickets sold"  up={true}  />
        <StatCard label="Trips completed"   value={String(kpi.trips)}                delta="this period"   up={true}  />
        <StatCard label="Peak load hour"    value={peakHour.label}                   delta={`${peakHour.value}% capacity`} up={null} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="Daily revenue — this week">
          <BarChart data={weekRevenue.length ? weekRevenue : WEEKLY_REVENUE} color="#3B82F6" height={120} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9", fontSize: 12 }}>
            <span style={{ color: "#64748B" }}>Total</span>
            <span style={{ fontWeight: 700, color: "#0F172A" }}>${totalRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
          </div>
        </Panel>
        <Panel title="Passenger load by hour">
          <BarChart data={hourlyLoad.length ? hourlyLoad : HOURLY_LOAD} color="#10B981" height={120} maxValue={100} />
          <div style={{ marginTop: 8, fontSize: 11, color: "#64748B", textAlign: "right" }}>
            Peak hour: {peakHour.label} ({peakHour.value}% capacity)
          </div>
        </Panel>
      </div>

      <Panel title="Monthly revenue trend">
        <LineChart data={monthlyRevenue.length ? monthlyRevenue : MONTHLY_REVENUE} color="#2563EB" height={110} />
      </Panel>

      <Panel title="Top routes by revenue" extra={<ExportMenu onCSV={doCSV} onPDF={doPDF} />}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Route", "Description", "Trips", "Revenue", "Avg Load"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {routes.map(r => (
              <tr key={r.route} className="table-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
                <td style={{ ...TD, fontWeight: 700, color: "#2563EB" }}>{r.route}</td>
                <td style={{ ...TD, color: "#475569" }}>{r.name}</td>
                <td style={TD}>{r.trips}</td>
                <td style={{ ...TD, fontWeight: 600 }}>${Number(r.revenue).toLocaleString()}</td>
                <td style={TD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 3 }}>
                      <div style={{ width: `${r.load}%`, height: "100%", background: r.load > 85 ? "#EF4444" : r.load > 65 ? "#10B981" : "#F59E0B", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#475569", minWidth: 30 }}>{r.load}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tab: Driver Performance
// ══════════════════════════════════════════════════════════════════════════════

const PERF_COLS = [
  { label: "Rank",          key: "rank"         },
  { label: "Driver",        key: "name"         },
  { label: "Trips",         key: "trips"        },
  { label: "On-Time %",     get: r => r.on_time_pct + "%" },
  { label: "Complaints",    key: "complaints"   },
  { label: "Avg Rating",    get: r => r.avg_rating.toFixed(1) },
  { label: "Idle Hrs/Day",  get: r => r.idle_hours.toFixed(1) },
  { label: "Score",         key: "score"        },
];

function ScoreBadge({ score }) {
  const color = score >= 90 ? "#059669" : score >= 75 ? "#D97706" : "#DC2626";
  const bg    = score >= 90 ? "#ECFDF5" : score >= 75 ? "#FFFBEB" : "#FEF2F2";
  return (
    <span style={{ background: bg, color, fontWeight: 800, fontSize: 12, padding: "2px 10px", borderRadius: 20, border: `1px solid ${color}33` }}>
      {score}
    </span>
  );
}

function RankBadge({ rank }) {
  const colors = { 1: { bg: "#FEF9C3", color: "#92400E", border: "#FDE68A" }, 2: { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" }, 3: { bg: "#FEF3EC", color: "#9A3412", border: "#FDBA74" } };
  const c = colors[rank];
  return c
    ? <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>#{rank}</span>
    : <span style={{ fontWeight: 700, color: "#94A3B8", fontSize: 13 }}>#{rank}</span>;
}

function DriverPerformanceTab({ range, driverPerf }) {
  const data = driverPerf.length ? driverPerf : DRIVER_PERF;
  const doCSV = () => exportCSV(data, PERF_COLS, `driver-performance-${Date.now()}.csv`);
  const doPDF = () => exportPDF("Driver Performance Report", `Range: ${range} · Ranked by composite score`, PERF_COLS, data);

  const topScore = data[0]?.score ?? 100;

  return (
    <>
      {/* KPI summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Avg On-Time Rate"   value={data.length ? Math.round(data.reduce((s, d) => s + (d.on_time_pct ?? 0), 0) / data.length) + "%" : "—"} delta="across all drivers" up={null} />
        <StatCard label="Zero-Complaint Drivers" value={data.filter(d => (d.complaints ?? d.complaint_count ?? 0) === 0).length} delta={`of ${data.length} total`} up={true} />
        <StatCard label="Avg Rating"         value={data.length ? (data.reduce((s, d) => s + (d.avg_rating ?? d.average_rating ?? 0), 0) / data.length).toFixed(1) + " ★" : "—"} delta="passenger score" up={null} />
        <StatCard label="Top Performer"      value={data[0]?.name?.split(" ")[0] ?? data[0]?.driver_name?.split(" ")[0] ?? "—"} delta={`Score: ${topScore}`} up={true} />
      </div>

      {/* Score distribution bar chart */}
      <Panel title="Driver score distribution">
        <BarChart
          data={data.map((d, i) => ({ label: (d.name ?? d.driver_name ?? "").split(" ")[0], value: d.score ?? Math.round((d.on_time_pct ?? 50) * 0.4 + Math.max(0, 10 - (d.complaints ?? d.complaint_count ?? 0) * 5) * 0.3 + ((d.avg_rating ?? d.average_rating ?? 0) / 5) * 100 * 0.3), highlight: i === 0 }))}
          color="#2563EB" height={130}
        />
        <div style={{ marginTop: 8, fontSize: 11, color: "#64748B" }}>
          Score = On-Time (40%) + No Complaints (30%) + Rating (30%)
        </div>
      </Panel>

      {/* League table */}
      <Panel title="Driver performance league table" extra={<ExportMenu onCSV={doCSV} onPDF={doPDF} />}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Rank", "Driver", "Trips", "On-Time %", "Complaints", "Avg Rating", "Idle Hrs/Day", "Score"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const name    = d.name ?? d.driver_name ?? "—";
              const trips   = d.trips ?? d.trips_handled ?? 0;
              const onTime  = d.on_time_pct ?? 0;
              const comps   = d.complaints ?? d.complaint_count ?? 0;
              const rating  = parseFloat(d.avg_rating ?? d.average_rating ?? 0);
              const idle    = d.idle_hours ?? 0;
              const score   = d.score ?? Math.round(onTime * 0.4 + Math.max(0, 10 - comps * 5) * 0.3 + (rating / 5) * 100 * 0.3);
              const rank    = i + 1;
              return (
              <tr key={d.driver_id ?? d.id ?? i} className="table-row" style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <td style={{ ...TD, textAlign: "center" }}><RankBadge rank={rank} /></td>
                <td style={{ ...TD, fontWeight: 600, color: "#0F172A" }}>{name}</td>
                <td style={TD}>{trips}</td>
                <td style={TD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 50, height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                      <div style={{ width: `${onTime}%`, height: "100%", background: onTime >= 90 ? "#10B981" : onTime >= 80 ? "#F59E0B" : "#EF4444", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontWeight: 600, color: onTime >= 90 ? "#059669" : onTime >= 80 ? "#D97706" : "#DC2626" }}>
                      {onTime}%
                    </span>
                  </div>
                </td>
                <td style={TD}>
                  <span style={{ fontWeight: 700, color: comps === 0 ? "#059669" : comps <= 1 ? "#D97706" : "#DC2626" }}>
                    {comps === 0 ? "✓ 0" : comps}
                  </span>
                </td>
                <td style={TD}>{"★".repeat(Math.round(rating))} {rating.toFixed(1)}</td>
                <td style={{ ...TD, color: idle >= 5 ? "#DC2626" : "#374151" }}>{idle.toFixed(1)}h</td>
                <td style={TD}><ScoreBadge score={score} /></td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
          {[["#059669", "Score ≥ 90 — Excellent"], ["#D97706", "Score 75–89 — Good"], ["#DC2626", "Score < 75 — Needs improvement"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>{l}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tab: Vehicle Utilization
// ══════════════════════════════════════════════════════════════════════════════

const UTIL_COLS = [
  { label: "Vehicle",          key: "plate"             },
  { label: "Type",             key: "type"              },
  { label: "Active Hours",     get: r => r.active_hours.toFixed(1) + "h" },
  { label: "Idle Hours",       get: r => r.idle_hours.toFixed(1) + "h"   },
  { label: "Trips",            key: "trips"             },
  { label: "Distance (km)",    key: "distance_km"       },
  { label: "Utilization %",    get: r => r.utilization_pct + "%"          },
];

function VehicleUtilizationTab({ range, vehicleUtil }) {
  const data = vehicleUtil.length ? vehicleUtil : VEHICLE_UTIL;
  const doCSV = () => exportCSV(data, UTIL_COLS, `vehicle-utilization-${Date.now()}.csv`);
  const doPDF = () => exportPDF("Vehicle Utilization Report", `Range: ${range} · Sorted by utilization`, UTIL_COLS, data);

  const avgUtil     = data.length ? Math.round(data.reduce((s, v) => s + (v.utilization_pct ?? 0), 0) / data.length) : 0;
  const totalActive = data.reduce((s, v) => s + (v.active_hours ?? 0), 0).toFixed(1);
  const totalIdle   = data.reduce((s, v) => s + (v.idle_hours   ?? 0), 0).toFixed(1);

  return (
    <>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Avg Utilization"  value={avgUtil + "%"}       delta="fleet average"   up={avgUtil >= 65} />
        <StatCard label="Total Active Hrs" value={totalActive + "h"}   delta="combined today"  up={null} />
        <StatCard label="Total Idle Hrs"   value={totalIdle + "h"}     delta="opportunity lost" up={false} />
        <StatCard label="High Utilization" value={data.filter(v => (v.utilization_pct ?? 0) >= 70).length + " buses"} delta="≥ 70% utilized" up={true} />
      </div>

      {/* Active vs Idle bar chart */}
      <Panel title="Active vs Idle hours per vehicle">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map(v => (
            <div key={v.plate} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", minWidth: 60 }}>{v.plate}</span>
              <div style={{ flex: 1, height: 18, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${v.utilization_pct}%`, background: v.utilization_pct >= 70 ? "#10B981" : v.utilization_pct >= 45 ? "#F59E0B" : "#EF4444", display: "flex", alignItems: "center", paddingLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                  {v.utilization_pct >= 20 ? `${v.active_hours.toFixed(1)}h active` : ""}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", paddingLeft: 6, fontSize: 10, color: "#94A3B8" }}>
                  {v.idle_hours.toFixed(1)}h idle
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, minWidth: 36, color: v.utilization_pct >= 70 ? "#059669" : v.utilization_pct >= 45 ? "#D97706" : "#DC2626" }}>
                {v.utilization_pct}%
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
          {[["#10B981", "≥ 70% — Well utilised"], ["#F59E0B", "45–69% — Moderate"], ["#EF4444", "< 45% — Underused"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 11, color: "#64748B" }}>{l}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Table */}
      <Panel title="Vehicle utilization details" extra={<ExportMenu onCSV={doCSV} onPDF={doPDF} />}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Vehicle", "Type", "Active Hrs", "Idle Hrs", "Trips", "Distance", "Utilization"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((v, i) => (
              <tr key={v.plate} className="table-row" style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <td style={{ ...TD, fontWeight: 700, color: "#0F172A" }}>{v.plate}</td>
                <td style={TD}>
                  <span style={{ background: "#F1F5F9", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#475569" }}>
                    {v.type}
                  </span>
                </td>
                <td style={{ ...TD, color: "#059669", fontWeight: 600 }}>{v.active_hours.toFixed(1)}h</td>
                <td style={{ ...TD, color: v.idle_hours >= 5 ? "#DC2626" : "#64748B" }}>{v.idle_hours.toFixed(1)}h</td>
                <td style={TD}>{v.trips}</td>
                <td style={TD}>{v.distance_km} km</td>
                <td style={TD}><UtilBar active={v.active_hours} idle={v.idle_hours} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main AnalyticsPage
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
//  Tab: Scheduled Reports
// ══════════════════════════════════════════════════════════════════════════════

const REPORT_TYPES = [
  { value: "driver-performance",   label: "Driver Performance" },
  { value: "vehicle-utilization",  label: "Vehicle Utilization" },
  { value: "revenue",              label: "Revenue Summary" },
];
const FREQUENCIES = [
  { value: "daily",   label: "Daily"   },
  { value: "weekly",  label: "Weekly"  },
  { value: "monthly", label: "Monthly" },
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const EMPTY_SCHED = { report_name: "", report_type: "driver-performance", frequency: "weekly", day_of_week: 1, hour_of_day: 8, recipients: "", enabled: true };


import apiClient from "../api/apiClient";

function ScheduledReportsTab() {
  const [schedules, setSchedules] = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY_SCHED);
  const [busy,      setBusy]      = useState(false);
  const [toast,     setToast]     = useState(null);

  const load = () => {
    apiClient.get("/reports/scheduled")
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(() => setSchedules([]));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const openAdd  = () => { setEditing(null); setForm(EMPTY_SCHED); setShowForm(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...s, recipients: Array.isArray(s.recipients) ? s.recipients.join(", ") : s.recipients });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.report_name || !form.recipients) return;
    setBusy(true);
    const body = { ...form, recipients: form.recipients.split(",").map(e => e.trim()).filter(Boolean) };
    try {
      if (editing) {
        await apiClient.put(`/reports/scheduled/${editing.schedule_id}`, body);
        setSchedules(prev => prev.map(s => s.schedule_id === editing.schedule_id ? { ...s, ...body } : s));
        showToast("Schedule updated");
      } else {
        const res = await apiClient.post("/reports/scheduled", body);
        setSchedules(prev => [...prev, { ...body, schedule_id: res.schedule_id ?? Date.now(), last_sent_at: null }]);
        showToast("Schedule created");
      }
      setShowForm(false);
    } catch (e) { showToast("Error: " + e.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    if (!confirm("Delete this schedule?")) return;
    await apiClient.delete(`/reports/scheduled/${id}`).catch(() => {});
    setSchedules(prev => prev.filter(s => s.schedule_id !== id));
    showToast("Deleted");
  };

  const sendNow = async (s) => {
    setBusy(true);
    try {
      await apiClient.post(`/reports/scheduled/${s.schedule_id}/send-now`, {});
      setSchedules(prev => prev.map(x => x.schedule_id === s.schedule_id ? { ...x, last_sent_at: new Date().toISOString() } : x));
      showToast(`Sent "${s.report_name}" to ${Array.isArray(s.recipients) ? s.recipients.join(", ") : s.recipients}`);
    } catch (e) { showToast("Send failed: " + e.message); }
    setBusy(false);
  };

  const toggleEnabled = async (s) => {
    await apiClient.put(`/reports/scheduled/${s.schedule_id}`, { ...s, enabled: !s.enabled, recipients: Array.isArray(s.recipients) ? s.recipients : [s.recipients] }).catch(() => {});
    setSchedules(prev => prev.map(x => x.schedule_id === s.schedule_id ? { ...x, enabled: !x.enabled } : x));
  };

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const freqLabel = (s) => {
    if (s.frequency === "daily")   return `Daily at ${s.hour_of_day}:00`;
    if (s.frequency === "weekly")  return `Every ${DAYS[s.day_of_week ?? 1]} at ${s.hour_of_day}:00`;
    if (s.frequency === "monthly") return `1st of month at ${s.hour_of_day}:00`;
    return s.frequency;
  };

  const IS = { display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 };
  const II = { width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9000, background: "#1E293B", color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Scheduled Report Delivery</h2>
          <p style={{ fontSize: 12, color: "#64748B", margin: "3px 0 0" }}>Reports emailed automatically on your configured schedule</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openAdd} style={{ padding: "8px 18px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Schedule
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>{editing ? "Edit Schedule" : "New Schedule"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={IS}>Schedule Name</label>
              <input value={form.report_name} onChange={e => setForm(p => ({ ...p, report_name: e.target.value }))} placeholder="e.g. Weekly Driver Report" style={II} />
            </div>
            <div>
              <label style={IS}>Report Type</label>
              <select value={form.report_type} onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))} style={II}>
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={IS}>Frequency</label>
              <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} style={II}>
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {form.frequency === "weekly" && (
              <div>
                <label style={IS}>Day of Week</label>
                <select value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: Number(e.target.value) }))} style={II}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={IS}>Hour (0–23)</label>
              <input type="number" min={0} max={23} value={form.hour_of_day} onChange={e => setForm(p => ({ ...p, hour_of_day: Number(e.target.value) }))} style={II} />
            </div>
            <div style={{ gridColumn: form.frequency === "weekly" ? "2/4" : "1/3" }}>
              <label style={IS}>Recipients (comma-separated emails)</label>
              <input value={form.recipients} onChange={e => setForm(p => ({ ...p, recipients: e.target.value }))} placeholder="admin@example.com, ceo@example.com" style={II} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
              Enabled
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowForm(false)} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={busy || !form.report_name || !form.recipients} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {busy ? "Saving…" : editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Schedule cards */}
      {schedules === null ? (
        <p style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</p>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
          <div style={{ marginBottom: 10, color: "#CBD5E1" }}><Calendar size={36} /></div>
          <p style={{ fontSize: 14 }}>No scheduled reports yet. Click "+ New Schedule" to set one up.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {schedules.map(s => {
            const recipStr = Array.isArray(s.recipients) ? s.recipients.join(", ") : s.recipients;
            return (
              <div key={s.schedule_id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {/* Enabled toggle */}
                <div onClick={() => toggleEnabled(s)} style={{ cursor: "pointer", width: 40, height: 22, borderRadius: 11, background: s.enabled ? "#2563EB" : "#E2E8F0", position: "relative", flexShrink: 0, transition: "background .2s" }}>
                  <div style={{ position: "absolute", top: 3, left: s.enabled ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A", marginBottom: 2 }}>{s.report_name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    {REPORT_TYPES.find(t => t.value === s.report_type)?.label} · {freqLabel(s)} · {recipStr}
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: 11, color: "#94A3B8", minWidth: 120 }}>
                  <div>Last sent: {fmtDate(s.last_sent_at)}</div>
                  <div>Next: {fmtDate(s.next_send_at)}</div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => sendNow(s)} disabled={busy} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ▶ Send Now
                  </button>
                  <button onClick={() => openEdit(s)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#374151", fontSize: 12, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => remove(s.schedule_id)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview",  label: "Overview",           Icon: BarChart3  },
  { id: "drivers",   label: "Driver Performance", Icon: Trophy     },
  { id: "vehicles",  label: "Vehicle Utilization",Icon: Bus        },
  { id: "schedule",  label: "Schedule Reports",   Icon: Calendar   },
];

// Date helpers for range selection
function rangeToFromTo(range) {
  const to   = new Date().toISOString().slice(0, 10);
  const days = range === "This week" ? 7 : range === "Last 30 days" ? 30 : 90;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function groupByDay(rows, dateKey, valueKey) {
  const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return rows.map(r => ({
    label: DAY[new Date(r[dateKey]).getDay()],
    value: parseFloat(r[valueKey]) || 0,
  }));
}

function groupByMonth(rows, dateKey, valueKey) {
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const map = {};
  for (const r of rows) {
    const d = new Date(r[dateKey]);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    map[k] = (map[k] ?? 0) + (parseFloat(r[valueKey]) || 0);
  }
  return Object.entries(map).sort().map(([k, v]) => ({
    label: MON[parseInt(k.split("-")[1])],
    value: Math.round(v),
  }));
}

export default function AnalyticsPage() {
  const [tab,   setTab]   = useState("overview");
  const [range, setRange] = useState("This week");

  // Loaded analytics data — fall back to empty arrays (tabs use mocks when empty)
  const [weekRevenue,   setWeekRevenue]   = useState([]);
  const [monthlyRevenue,setMonthlyRevenue]= useState([]);
  const [hourlyLoad,    setHourlyLoad]    = useState([]);
  const [topRoutes,     setTopRoutes]     = useState([]);
  const [kpi,           setKpi]           = useState({ revenue: 0, passengers: 0, trips: 0 });
  const [driverPerf,    setDriverPerf]    = useState([]);
  const [vehicleUtil,   setVehicleUtil]   = useState([]);

  const loadData = useCallback(() => {
    const { from, to } = rangeToFromTo(range);

    // Revenue → weekly bar + monthly line + KPI
    getRevenueReport(from, to)
      .then(res => {
        const rows = res?.data ?? res ?? [];
        if (!rows.length) return;
        setWeekRevenue(groupByDay(rows, "report_date", "total_revenue"));
        setMonthlyRevenue(groupByMonth(rows, "report_date", "total_revenue"));
        setKpi(prev => ({
          ...prev,
          revenue:    rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0),
          passengers: rows.reduce((s, r) => s + parseInt(r.tickets_sold || 0), 0),
        }));
      })
      .catch(() => {});

    // Passenger load by hour (from heatmap endpoint)
    getPassengerHeatmap(from, to)
      .then(res => {
        const peaks = res?.peak_hours ?? [];
        if (!peaks.length) return;
        const LABELS = {6:"6am",7:"7am",8:"8am",9:"9am",10:"10am",11:"11am",12:"12pm",13:"1pm",14:"2pm",15:"3pm",16:"4pm",17:"5pm"};
        const max = Math.max(...peaks.map(p => p.count), 1);
        setHourlyLoad(
          peaks
            .filter(p => p.hour >= 6 && p.hour <= 17)
            .sort((a, b) => a.hour - b.hour)
            .map(p => ({ label: LABELS[p.hour] ?? `${p.hour}h`, value: Math.round((p.count / max) * 100), highlight: p.hour === 14 }))
        );
      })
      .catch(() => {});

    // Top routes
    getTopRoutesReport(from, to)
      .then(res => {
        const rows = res?.data ?? res ?? [];
        if (rows.length) setTopRoutes(rows);
      })
      .catch(() => {});

    // Driver performance
    getDriverPerfReport(from, to)
      .then(res => {
        const rows = res?.data ?? res ?? [];
        if (rows.length) setDriverPerf(rows);
      })
      .catch(() => {});

    // Vehicle utilization
    getVehicleUtilReport(from, to)
      .then(res => {
        const rows = res?.data ?? res ?? [];
        if (rows.length) setVehicleUtil(rows);
      })
      .catch(() => {});
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>
            Analytics & Reports
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            System performance insights with CSV / PDF export
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {RANGE_OPTIONS.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              border: range === r ? "none" : "1px solid #E2E8F0",
              background: range === r ? "#2563EB" : "#fff",
              color: range === r ? "#fff" : "#64748B",
              fontWeight: range === r ? 600 : 400,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 12, padding: 4, border: "1px solid #E2E8F0", alignSelf: "flex-start" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none",
            background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? "#0F172A" : "#64748B",
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer",
            boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.08)" : "none",
            transition: "all .15s",
            display: "flex", alignItems: "center", gap: 6,
          }}><t.Icon size={14} />{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview"  && <OverviewTab range={range} weekRevenue={weekRevenue} monthlyRevenue={monthlyRevenue} hourlyLoad={hourlyLoad} topRoutes={topRoutes} kpi={kpi} />}
      {tab === "drivers"   && <DriverPerformanceTab  range={range} driverPerf={driverPerf} />}
      {tab === "vehicles"  && <VehicleUtilizationTab range={range} vehicleUtil={vehicleUtil} />}
      {tab === "schedule"  && <ScheduledReportsTab />}
    </div>
  );
}
