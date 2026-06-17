import { useState, useEffect, useCallback } from "react";
import { Download, Printer, Calendar, BarChart3, Bus, Trophy } from "lucide-react";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import apiClient from "../api/apiClient";
import { useSettings } from "../context/SettingsContext";
import { fmtMoney, fmtMoneyRound } from "../utils/fmt";
import {
  getRevenueReport,
  getPassengerHeatmap,
  getDriverPerfReport,
  getVehicleUtilReport,
  getTopRoutesReport,
} from "../api/endpoints";

// ── Export helpers ─────────────────────────────────────────────────────────────

function exportCSV(rows, columns, filename) {
  const header = columns.map(c => `"${c.label}"`).join(",");
  const body = rows.map(row =>
    columns.map(c => {
      const v = typeof c.get === "function" ? c.get(row) : (row[c.key] ?? "");
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
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
      table{width:100%;border-collapse:collapse}
      th{background:#f4f4f4;border:1px solid #ddd;padding:8px 10px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
      td{border:1px solid #e5e5e5;padding:8px 10px}
      tr:nth-child(even) td{background:#fafafa}
      @media print{button{display:none}}
    </style>
  </head><body>
    <h1>${title}</h1>
    <p>${subtitle} · Generated ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</p>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html); win.document.close();
}

function ExportMenu({ onCSV, onPDF }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 8,
        border: "1.5px solid #E2E8F0", background: "#fff",
        fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
      }}>
        ⬇ Export <span style={{ fontSize: 10, color: "#94A3B8" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.10)", minWidth: 150, zIndex: 100, overflow: "hidden",
        }}>
          {[
            { Icon: Download, label: "Export as CSV", action: () => { onCSV(); setOpen(false); } },
            { Icon: Printer,  label: "Export as PDF", action: () => { onPDF(); setOpen(false); } },
          ].map(({ Icon, label, action }) => (
            <div key={label} onClick={action} style={{
              padding: "10px 14px", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
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

// ── Chart primitives ───────────────────────────────────────────────────────────

function BarChart({ data, color = "#3B82F6", height = 110 }) {
  if (!data.length) return <EmptyChart height={height} />;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, color: "#64748B" }}>{d.value}</span>
          <div style={{
            width: "100%",
            height: Math.max(4, Math.round((d.value / max) * (height - 24))),
            borderRadius: "4px 4px 0 0",
            background: d.highlight ? "#1D4ED8" : color,
            transition: "height .3s",
          }} />
          <span style={{ fontSize: 9, color: d.highlight ? "#1D4ED8" : "#94A3B8", fontWeight: d.highlight ? 700 : 400, whiteSpace: "nowrap" }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color = "#2563EB", height = 110 }) {
  if (!data.length) return <EmptyChart height={height} />;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 400, H = height - 20;
  const pts = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - ((d.value - min) / range) * H;
    return `${x},${y}`;
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
          const y = H - ((d.value - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
        {data.map((d, i) => (
          <text key={i} x={data.length > 1 ? (i / (data.length - 1)) * W : W / 2}
            y={height - 2} textAnchor="middle" fontSize="9" fill="#aaa">{d.label}</text>
        ))}
      </svg>
    </div>
  );
}

function EmptyChart({ height = 110 }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 12 }}>
      No data for this period
    </div>
  );
}

function UtilBar({ pct }) {
  const color = pct >= 70 ? "#10B981" : pct >= 45 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34 }}>{pct}%</span>
    </div>
  );
}

function Skeleton({ height = 16, width = "100%", style = {} }) {
  return (
    <div style={{
      height, width, borderRadius: 6,
      background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

// ── Data helpers ───────────────────────────────────────────────────────────────

const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function groupRevenue(rows, range) {
  if (!rows.length) return [];
  if (range === "This week") {
    return rows.slice(-7).map(r => ({
      label: DAY[new Date(r.report_date).getDay()],
      value: Math.round(parseFloat(r.total_revenue) || 0),
    }));
  }
  if (range === "Last 30 days") {
    const weeks = {};
    for (const r of rows) {
      const d = new Date(r.report_date);
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
      const k = ws.toISOString().slice(0, 10);
      weeks[k] = (weeks[k] ?? 0) + (parseFloat(r.total_revenue) || 0);
    }
    return Object.entries(weeks).sort().map(([k, v]) => ({
      label: new Date(k).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }),
      value: Math.round(v),
    }));
  }
  const map = {};
  for (const r of rows) {
    const d = new Date(r.report_date);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    map[k] = (map[k] ?? 0) + (parseFloat(r.total_revenue) || 0);
  }
  return Object.entries(map).sort().map(([k, v]) => ({
    label: MON[parseInt(k.split("-")[1])],
    value: Math.round(v),
  }));
}

function groupMonthly(rows) {
  const map = {};
  for (const r of rows) {
    const d = new Date(r.report_date);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    map[k] = (map[k] ?? 0) + (parseFloat(r.total_revenue) || 0);
  }
  return Object.entries(map).sort().map(([k, v]) => ({
    label: MON[parseInt(k.split("-")[1])],
    value: Math.round(v),
  }));
}

function normalizeDrivers(rows) {
  return rows
    .map(d => {
      const handled   = parseInt(d.trips_handled ?? d.trips ?? 0);
      const completed = parseInt(d.trips_completed ?? handled);
      const onTime    = d.on_time_pct ?? (handled > 0 ? Math.round((completed / handled) * 100) : 0);
      const rating    = parseFloat(d.average_rating ?? d.avg_rating ?? 0);
      const comps     = parseInt(d.complaint_count ?? d.complaints ?? 0);
      const score     = Math.round(onTime * 0.4 + Math.max(0, 10 - comps * 5) * 0.3 + (rating / 5) * 100 * 0.3);
      return {
        ...d,
        name:        d.driver_name ?? d.name ?? "—",
        trips:       handled,
        on_time_pct: onTime,
        avg_rating:  rating,
        complaints:  comps,
        idle_hours:  parseFloat(d.idle_hours ?? 0),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

// ── Shared table styles ────────────────────────────────────────────────────────

const TH = {
  padding: "8px 12px", textAlign: "left", fontSize: 10,
  fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
  letterSpacing: ".04em", borderBottom: "1px solid #F1F5F9",
  background: "#F8FAFC", whiteSpace: "nowrap",
};
const TD = { padding: "10px 12px", fontSize: 13, color: "#374151" };

// ── Overview tab ───────────────────────────────────────────────────────────────

function makeOverviewCols(currency) {
  return [
    { label: "Route",       key: "route"   },
    { label: "Description", key: "name"    },
    { label: "Trips",       key: "trips"   },
    { label: `Revenue (${currency})`, get: r => Number(r.revenue).toLocaleString() },
    { label: "Avg Load %",  get: r => (r.load ?? r.load_pct ?? 0) + "%" },
  ];
}

function OverviewTab({ range, revenueRows, revenueTrendRows, topRoutes, hourlyLoad, kpi, loading, currency }) {
  const barData     = groupRevenue(revenueRows, range);
  const monthlyData = groupMonthly(revenueTrendRows.length ? revenueTrendRows : revenueRows);
  const peakHour    = hourlyLoad.length ? hourlyLoad.reduce((p, c) => c.value > p.value ? c : p, { label:"—", value:0 }) : null;
  const OVERVIEW_COLS = makeOverviewCols(currency);

  const doCSV = () => exportCSV(topRoutes, OVERVIEW_COLS, `top-routes-${Date.now()}.csv`);
  const doPDF = () => exportPDF("Top Routes by Revenue", `Range: ${range}`, OVERVIEW_COLS, topRoutes);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        {loading ? (
          [0,1,2,3].map(i => <div key={i} style={{ background: "#F8FAFC", borderRadius: 14, padding: 18 }}><Skeleton height={20} style={{ marginBottom: 10 }} /><Skeleton height={32} width="60%" /></div>)
        ) : (
          <>
            <StatCard label="Total Revenue"    value={fmtMoneyRound(kpi.revenue, currency)} delta="this period" up accent="#2563EB" />
            <StatCard label="Tickets Sold"     value={kpi.passengers.toLocaleString()} delta="passengers" up accent="#10B981" />
            <StatCard label="Trips Completed"  value={kpi.trips.toLocaleString()}       delta="this period" up accent="#7C3AED" />
            <StatCard label="Peak Load Hour"   value={peakHour?.label ?? "—"}           delta={peakHour ? `${peakHour.value}% capacity` : "no data"} accent="#F59E0B" />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title={range === "This week" ? "Daily Revenue — This Week" : range === "Last 30 days" ? "Weekly Revenue — Last 30 Days" : "Monthly Revenue — Last 3 Months"}>
          {loading ? <Skeleton height={110} /> : <BarChart data={barData} color="#3B82F6" height={110} />}
          {!loading && barData.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid #F1F5F9", fontSize: 12 }}>
              <span style={{ color: "#64748B" }}>Total</span>
              <span style={{ fontWeight: 700, color: "#0F172A" }}>{fmtMoneyRound(barData.reduce((s, d) => s + d.value, 0), currency)}</span>
            </div>
          )}
        </Panel>
        <Panel title="Passenger Load by Hour">
          {loading ? <Skeleton height={110} /> : <BarChart data={hourlyLoad} color="#10B981" height={110} />}
          {!loading && peakHour && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748B", textAlign: "right" }}>
              Peak: {peakHour.label} ({peakHour.value}% capacity)
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Revenue Trend">
        {loading ? <Skeleton height={110} /> : <LineChart data={monthlyData} color="#2563EB" height={110} />}
      </Panel>

      <Panel title="Top Routes by Revenue" extra={topRoutes.length ? <ExportMenu onCSV={doCSV} onPDF={doPDF} /> : null}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {[0,1,2,3,4].map(i => <Skeleton key={i} height={14} />)}
          </div>
        ) : topRoutes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No route data for this period</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Route","Description","Trips","Revenue","Avg Load"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {topRoutes.map((r, i) => {
                const load = r.load ?? r.load_pct ?? 0;
                return (
                  <tr key={r.route ?? i} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    <td style={{ ...TD, fontWeight: 700, color: "#2563EB" }}>{r.route}</td>
                    <td style={{ ...TD, color: "#475569" }}>{r.name}</td>
                    <td style={TD}>{r.trips}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{fmtMoneyRound(r.revenue, currency)}</td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 3 }}>
                          <div style={{ width: `${load}%`, height: "100%", borderRadius: 3, background: load > 85 ? "#EF4444" : load > 65 ? "#10B981" : "#F59E0B" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#475569", minWidth: 30 }}>{load}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ── Driver performance tab ─────────────────────────────────────────────────────

const PERF_COLS = [
  { label: "Rank",         key: "rank"        },
  { label: "Driver",       key: "name"        },
  { label: "Trips",        key: "trips"       },
  { label: "Completion %", get: r => r.on_time_pct + "%" },
  { label: "Complaints",   key: "complaints"  },
  { label: "Avg Rating",   get: r => Number(r.avg_rating).toFixed(1) },
  { label: "Score",        key: "score"       },
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
  const styles = {
    1: { bg: "#FEF9C3", color: "#92400E", border: "#FDE68A" },
    2: { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
    3: { bg: "#FEF3EC", color: "#9A3412", border: "#FDBA74" },
  };
  const s = styles[rank];
  return s
    ? <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>#{rank}</span>
    : <span style={{ fontWeight: 700, color: "#94A3B8", fontSize: 13 }}>#{rank}</span>;
}

function DriverPerformanceTab({ range, driverPerf, loading }) {
  const data = driverPerf;
  const doCSV = () => exportCSV(data, PERF_COLS, `driver-performance-${Date.now()}.csv`);
  const doPDF = () => exportPDF("Driver Performance Report", `Range: ${range}`, PERF_COLS, data);

  const avgOnTime = data.length ? Math.round(data.reduce((s, d) => s + d.on_time_pct, 0) / data.length) : 0;
  const avgRating = data.length ? (data.reduce((s, d) => s + d.avg_rating, 0) / data.length).toFixed(1) : "—";
  const zeroComp  = data.filter(d => d.complaints === 0).length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        {loading ? (
          [0,1,2,3].map(i => <div key={i} style={{ background: "#F8FAFC", borderRadius: 14, padding: 18 }}><Skeleton height={20} style={{ marginBottom: 10 }} /><Skeleton height={32} width="60%" /></div>)
        ) : (
          <>
            <StatCard label="Avg Completion Rate"     value={data.length ? avgOnTime + "%" : "—"}   delta="trip completion" up={avgOnTime >= 80} accent="#2563EB" />
            <StatCard label="Zero-Complaint Drivers"  value={zeroComp}                               delta={`of ${data.length} total`} up accent="#10B981" />
            <StatCard label="Avg Rating"              value={data.length ? avgRating + " ★" : "—"}  delta="passenger score" accent="#F59E0B" />
            <StatCard label="Top Performer"           value={data[0]?.name?.split(" ")[0] ?? "—"}   delta={data[0] ? `Score: ${data[0].score}` : "no data"} up accent="#7C3AED" />
          </>
        )}
      </div>

      {!loading && data.length > 0 && (
        <Panel title="Driver Score Distribution">
          <BarChart
            data={data.map((d, i) => ({ label: d.name.split(" ")[0], value: d.score, highlight: i === 0 }))}
            color="#2563EB" height={130}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: "#64748B" }}>
            Score = Completion (40%) + No Complaints (30%) + Rating (30%)
          </div>
        </Panel>
      )}

      <Panel title="Driver Performance League Table" extra={data.length ? <ExportMenu onCSV={doCSV} onPDF={doPDF} /> : null}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {[0,1,2,3,4].map(i => <Skeleton key={i} height={14} />)}
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No driver data for this period</div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Rank","Driver","Trips","Completion %","Complaints","Avg Rating","Score"].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.driver_id ?? i} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ ...TD, textAlign: "center" }}><RankBadge rank={d.rank} /></td>
                    <td style={{ ...TD, fontWeight: 600, color: "#0F172A" }}>{d.name}</td>
                    <td style={TD}>{d.trips}</td>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 50, height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                          <div style={{ width: `${d.on_time_pct}%`, height: "100%", borderRadius: 3, background: d.on_time_pct >= 90 ? "#10B981" : d.on_time_pct >= 75 ? "#F59E0B" : "#EF4444" }} />
                        </div>
                        <span style={{ fontWeight: 600, color: d.on_time_pct >= 90 ? "#059669" : d.on_time_pct >= 75 ? "#D97706" : "#DC2626" }}>
                          {d.on_time_pct}%
                        </span>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontWeight: 700, color: d.complaints === 0 ? "#059669" : d.complaints <= 1 ? "#D97706" : "#DC2626" }}>
                        {d.complaints === 0 ? "✓ 0" : d.complaints}
                      </span>
                    </td>
                    <td style={TD}>{"★".repeat(Math.round(d.avg_rating))} {d.avg_rating.toFixed(1)}</td>
                    <td style={TD}><ScoreBadge score={d.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
              {[["#059669","Score ≥ 90 — Excellent"],["#D97706","Score 75–89 — Good"],["#DC2626","Score < 75 — Needs improvement"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: 11, color: "#64748B" }}>{l}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

// ── Vehicle utilization tab ────────────────────────────────────────────────────

const UTIL_COLS = [
  { label: "Vehicle",       key: "plate"  },
  { label: "Type",          key: "type"   },
  { label: "Active Hours",  get: r => Number(r.active_hours).toFixed(1) + "h" },
  { label: "Trips",         key: "trips"  },
  { label: "Utilization %", get: r => r.utilization_pct + "%" },
];

function VehicleUtilizationTab({ range, vehicleUtil, loading }) {
  const data = vehicleUtil;
  const doCSV = () => exportCSV(data, UTIL_COLS, `vehicle-utilization-${Date.now()}.csv`);
  const doPDF = () => exportPDF("Vehicle Utilization Report", `Range: ${range}`, UTIL_COLS, data);

  const avgUtil     = data.length ? Math.round(data.reduce((s, v) => s + (v.utilization_pct ?? 0), 0) / data.length) : 0;
  const totalActive = data.reduce((s, v) => s + (v.active_hours ?? 0), 0).toFixed(1);
  const highUtil    = data.filter(v => (v.utilization_pct ?? 0) >= 70).length;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        {loading ? (
          [0,1,2,3].map(i => <div key={i} style={{ background: "#F8FAFC", borderRadius: 14, padding: 18 }}><Skeleton height={20} style={{ marginBottom: 10 }} /><Skeleton height={32} width="60%" /></div>)
        ) : (
          <>
            <StatCard label="Avg Utilization"   value={data.length ? avgUtil + "%" : "—"} delta="fleet average"   up={avgUtil >= 65} accent="#2563EB" />
            <StatCard label="Total Active Hrs"  value={totalActive + "h"}                  delta="combined"        accent="#10B981" />
            <StatCard label="Vehicles in Fleet" value={data.length}                        delta="tracked"         accent="#7C3AED" />
            <StatCard label="Well Utilised"     value={highUtil + " buses"}                delta="≥ 70% utilized"  up accent="#F59E0B" />
          </>
        )}
      </div>

      {!loading && data.length > 0 && (
        <Panel title="Active Hours per Vehicle">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.map(v => {
              const pct = v.utilization_pct ?? 0;
              const color = pct >= 70 ? "#10B981" : pct >= 45 ? "#F59E0B" : "#EF4444";
              return (
                <div key={v.plate} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", minWidth: 70 }}>{v.plate}</span>
                  <div style={{ flex: 1, height: 18, background: "#F1F5F9", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${pct}%`, background: color, display: "flex", alignItems: "center", paddingLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                      {pct >= 20 ? `${Number(v.active_hours).toFixed(1)}h` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 36, color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
            {[["#10B981","≥ 70% — Well utilised"],["#F59E0B","45–69% — Moderate"],["#EF4444","< 45% — Underused"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>{l}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Vehicle Utilization Details" extra={data.length ? <ExportMenu onCSV={doCSV} onPDF={doPDF} /> : null}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            {[0,1,2,3,4].map(i => <Skeleton key={i} height={14} />)}
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No vehicle data for this period</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Vehicle","Type","Active Hrs","Trips","Utilization"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((v, i) => (
                <tr key={v.plate} style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                  <td style={{ ...TD, fontWeight: 700, color: "#0F172A" }}>{v.plate}</td>
                  <td style={TD}>
                    <span style={{ background: "#F1F5F9", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#475569" }}>{v.type}</span>
                  </td>
                  <td style={{ ...TD, color: "#059669", fontWeight: 600 }}>{Number(v.active_hours).toFixed(1)}h</td>
                  <td style={TD}>{v.trips}</td>
                  <td style={TD}><UtilBar pct={v.utilization_pct ?? 0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

// ── Scheduled Reports tab ──────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: "driver-performance",  label: "Driver Performance"  },
  { value: "vehicle-utilization", label: "Vehicle Utilization" },
  { value: "revenue",             label: "Revenue Summary"     },
];
const FREQUENCIES = [
  { value: "daily",   label: "Daily"   },
  { value: "weekly",  label: "Weekly"  },
  { value: "monthly", label: "Monthly" },
];
const WEEK_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EMPTY_SCHED = { report_name: "", report_type: "driver-performance", frequency: "weekly", day_of_week: 1, hour_of_day: 8, recipients: "", enabled: true };

function ScheduledReportsTab() {
  const [schedules, setSchedules] = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY_SCHED);
  const [busy,      setBusy]      = useState(false);
  const [toast,     setToast]     = useState(null);

  const load = useCallback(() => {
    apiClient.get("/reports/scheduled")
      .then(d => setSchedules(Array.isArray(d) ? d : []))
      .catch(() => setSchedules([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const openAdd   = () => { setEditing(null); setForm(EMPTY_SCHED); setShowForm(true); };
  const openEdit  = s  => { setEditing(s); setForm({ ...s, recipients: Array.isArray(s.recipients) ? s.recipients.join(", ") : s.recipients }); setShowForm(true); };

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

  const remove = async id => {
    if (!confirm("Delete this schedule?")) return;
    await apiClient.delete(`/reports/scheduled/${id}`).catch(() => {});
    setSchedules(prev => prev.filter(s => s.schedule_id !== id));
    showToast("Deleted");
  };

  const sendNow = async s => {
    setBusy(true);
    try {
      await apiClient.post(`/reports/scheduled/${s.schedule_id}/send-now`, {});
      setSchedules(prev => prev.map(x => x.schedule_id === s.schedule_id ? { ...x, last_sent_at: new Date().toISOString() } : x));
      showToast(`Sent "${s.report_name}"`);
    } catch (e) { showToast("Send failed: " + e.message); }
    setBusy(false);
  };

  const toggleEnabled = async s => {
    const recs = Array.isArray(s.recipients) ? s.recipients : [s.recipients];
    await apiClient.put(`/reports/scheduled/${s.schedule_id}`, { ...s, enabled: !s.enabled, recipients: recs }).catch(() => {});
    setSchedules(prev => prev.map(x => x.schedule_id === s.schedule_id ? { ...x, enabled: !x.enabled } : x));
  };

  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const freqLabel = s => {
    if (s.frequency === "daily")   return `Daily at ${s.hour_of_day}:00`;
    if (s.frequency === "weekly")  return `Every ${WEEK_DAYS[s.day_of_week ?? 1]} at ${s.hour_of_day}:00`;
    if (s.frequency === "monthly") return `1st of month at ${s.hour_of_day}:00`;
    return s.frequency;
  };

  const IS = { display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 };
  const II = { width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9000, background: "#1E293B", color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

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
                  {WEEK_DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={IS}>Hour (0–23)</label>
              <input type="number" min={0} max={23} value={form.hour_of_day} onChange={e => setForm(p => ({ ...p, hour_of_day: Number(e.target.value) }))} style={II} />
            </div>
            <div style={{ gridColumn: form.frequency === "weekly" ? "2/4" : "1/3" }}>
              <label style={IS}>Recipients (comma-separated emails)</label>
              <input value={form.recipients} onChange={e => setForm(p => ({ ...p, recipients: e.target.value }))} placeholder="admin@example.com, manager@example.com" style={II} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} />
              Enabled
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowForm(false)} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={busy || !form.report_name || !form.recipients} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "Saving…" : editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {schedules === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0,1,2].map(i => <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px" }}><Skeleton height={14} style={{ marginBottom: 8 }} /><Skeleton height={10} width="60%" /></div>)}
        </div>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
          <div style={{ marginBottom: 10, color: "#CBD5E1" }}><Calendar size={36} /></div>
          <p style={{ fontSize: 14 }}>No scheduled reports yet. Click "+ New Schedule" to set one up.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {schedules.map(s => {
            const recipStr = Array.isArray(s.recipients) ? s.recipients.join(", ") : s.recipients;
            return (
              <div key={s.schedule_id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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
                  <button onClick={() => sendNow(s)} disabled={busy} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>▶ Send Now</button>
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

// ── Range helper ───────────────────────────────────────────────────────────────

function rangeToFromTo(range) {
  const to   = new Date().toISOString().slice(0, 10);
  const days = range === "This week" ? 7 : range === "Last 30 days" ? 30 : 90;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

// ── Tabs config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",            Icon: BarChart3 },
  { id: "drivers",   label: "Driver Performance",  Icon: Trophy    },
  { id: "vehicles",  label: "Vehicle Utilization", Icon: Bus       },
  { id: "schedule",  label: "Schedule Reports",    Icon: Calendar  },
];

const RANGE_OPTIONS = ["This week", "Last 30 days", "Last 3 months"];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { currency } = useSettings();
  const [tab,   setTab]   = useState("overview");
  const [range, setRange] = useState("This week");
  const [loading, setLoading] = useState(true);

  const [revenueRows,      setRevenueRows]      = useState([]);
  const [revenueTrendRows, setRevenueTrendRows] = useState([]);
  const [topRoutes,        setTopRoutes]        = useState([]);
  const [hourlyLoad,       setHourlyLoad]       = useState([]);
  const [kpi,              setKpi]              = useState({ revenue: 0, passengers: 0, trips: 0 });
  const [driverPerf,       setDriverPerf]       = useState([]);
  const [vehicleUtil,      setVehicleUtil]      = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeToFromTo(range);

    const HOUR_LABELS = { 6:"6am",7:"7am",8:"8am",9:"9am",10:"10am",11:"11am",12:"12pm",13:"1pm",14:"2pm",15:"3pm",16:"4pm",17:"5pm",18:"6pm" };

    const from3m = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    // Always fetch 3 months of revenue for the trend chart, independent of the selected range
    getRevenueReport(from3m, to)
      .then(res => setRevenueTrendRows(res?.data ?? res ?? []))
      .catch(() => {});

    await Promise.allSettled([
      getRevenueReport(from, to).then(res => {
        const rows = res?.data ?? res ?? [];
        setRevenueRows(rows);
        setKpi(prev => ({
          ...prev,
          revenue:    rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0),
          passengers: rows.reduce((s, r) => s + parseInt(r.tickets_sold || 0), 0),
        }));
      }).catch(() => {}),

      getPassengerHeatmap(from, to).then(res => {
        const peaks = res?.peak_hours ?? [];
        if (!peaks.length) return;
        const max = Math.max(...peaks.map(p => p.count), 1);
        setHourlyLoad(
          peaks
            .filter(p => p.hour >= 6 && p.hour <= 18)
            .sort((a, b) => a.hour - b.hour)
            .map(p => ({ label: HOUR_LABELS[p.hour] ?? `${p.hour}h`, value: Math.round((p.count / max) * 100) }))
        );
      }).catch(() => {}),

      getTopRoutesReport(from, to).then(res => {
        const rows = res?.data ?? res ?? [];
        setTopRoutes(rows);
      }).catch(() => {}),

      getDriverPerfReport(from, to).then(res => {
        const rows = res?.data ?? res ?? [];
        const normalized = normalizeDrivers(rows);
        setDriverPerf(normalized);
        setKpi(prev => ({ ...prev, trips: normalized.reduce((s, d) => s + d.trips, 0) }));
      }).catch(() => {}),

      getVehicleUtilReport(from, to).then(res => {
        const rows = res?.data ?? res ?? [];
        setVehicleUtil(rows);
      }).catch(() => {}),
    ]);

    setLoading(false);
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Analytics & Reports</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            System performance insights · CSV / PDF export available
          </p>
        </div>
        <div style={{ flex: 1 }} />
        {tab !== "schedule" && (
          <div style={{ display: "flex", gap: 6 }}>
            {RANGE_OPTIONS.map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                border: range === r ? "none" : "1px solid #E2E8F0",
                background: range === r ? "#2563EB" : "#fff",
                color:  range === r ? "#fff" : "#64748B",
                fontWeight: range === r ? 600 : 400,
              }}>{r}</button>
            ))}
          </div>
        )}
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
      {tab === "overview"  && <OverviewTab        range={range} revenueRows={revenueRows} revenueTrendRows={revenueTrendRows} topRoutes={topRoutes} hourlyLoad={hourlyLoad} kpi={kpi} loading={loading} currency={currency} />}
      {tab === "drivers"   && <DriverPerformanceTab range={range} driverPerf={driverPerf} loading={loading} />}
      {tab === "vehicles"  && <VehicleUtilizationTab range={range} vehicleUtil={vehicleUtil} loading={loading} />}
      {tab === "schedule"  && <ScheduledReportsTab />}
    </div>
  );
}
