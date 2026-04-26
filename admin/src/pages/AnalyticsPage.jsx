// pages/AnalyticsPage.jsx
// ─────────────────────────────────────────────────────────────
//  Analytics: revenue, passenger load, top routes, peak hours
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";

// ── tiny chart helpers (no external lib needed) ───────────────

function BarChart({
  data,
  color = "#3B82F6",
  height = 100,
  labelKey = "label",
  valueKey = "value",
  maxValue,
}) {
  const max = maxValue ?? Math.max(...data.map((d) => d[valueKey]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span style={{ fontSize: 9, color: "#64748B" }}>{d[valueKey]}</span>
          <div
            style={{
              width: "100%",
              height: Math.round((d[valueKey] / max) * (height - 20)),
              borderRadius: "4px 4px 0 0",
              background: d.highlight ? "#1D4ED8" : color,
              transition: "height .3s",
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: d.highlight ? "#1D4ED8" : "#94A3B8",
              fontWeight: d.highlight ? 700 : 400,
            }}
          >
            {d[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color = "#3B82F6", height = 100 }) {
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 400,
    H = height - 20;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / range) * H;
    return `${x},${y}`;
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height }}>
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.value - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          return (
            <text
              key={i}
              x={x}
              y={height - 2}
              textAnchor="middle"
              fontSize="9"
              fill="#aaa"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────

const WEEKLY_REVENUE = [
  { label: "Mon", value: 1100 },
  { label: "Tue", value: 1320 },
  { label: "Wed", value: 980 },
  { label: "Thu", value: 1540 },
  { label: "Fri", value: 1280 },
  { label: "Sat", value: 870 },
  { label: "Sun", value: 760 },
];

const HOURLY_LOAD = [
  { label: "6am", value: 38 },
  { label: "7am", value: 62 },
  { label: "8am", value: 91 },
  { label: "9am", value: 85 },
  { label: "10am", value: 55 },
  { label: "11am", value: 48 },
  { label: "12pm", value: 70 },
  { label: "1pm", value: 78 },
  { label: "2pm", value: 60, highlight: true },
  { label: "3pm", value: 30 },
  { label: "4pm", value: 45 },
  { label: "5pm", value: 55 },
];

const TOP_ROUTES = [
  {
    route: "Route 12A",
    name: "City Center → Airport",
    trips: 42,
    revenue: 3360,
    load: 88,
  },
  {
    route: "Route 7B",
    name: "University → Downtown",
    trips: 38,
    revenue: 2660,
    load: 75,
  },
  {
    route: "Route 3C",
    name: "North Terminal → Mall",
    trips: 31,
    revenue: 2170,
    load: 94,
  },
  {
    route: "Route 5D",
    name: "Hospital → Station",
    trips: 25,
    revenue: 1750,
    load: 57,
  },
  {
    route: "Route 9E",
    name: "Harbor → Old City",
    trips: 18,
    revenue: 1260,
    load: 63,
  },
];

const MONTHLY_REVENUE = [
  { label: "Oct", value: 28400 },
  { label: "Nov", value: 31200 },
  { label: "Dec", value: 27800 },
  { label: "Jan", value: 33100 },
  { label: "Feb", value: 35600 },
  { label: "Mar", value: 41200 },
];

const RANGE_OPTIONS = ["This week", "Last 30 days", "Last 3 months"];

// ── Page ─────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState("This week");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Heading */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}
          >
            Analytics
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            System performance and insights
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                border: range === r ? "none" : "1px solid #E2E8F0",
                background: range === r ? "#2563EB" : "#fff",
                color: range === r ? "#fff" : "#64748B",
                fontWeight: range === r ? 600 : 400,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total revenue"
          value="$8,420"
          delta="+14% vs last week"
          up={true}
        />
        <StatCard
          label="Total passengers"
          value="1,204"
          delta="+8% vs last week"
          up={true}
        />
        <StatCard
          label="Trips completed"
          value="148"
          delta="+5 vs last week"
          up={true}
        />
        <StatCard
          label="Avg load rate"
          value="72%"
          delta="-2% vs last week"
          up={false}
        />
      </div>

      {/* Revenue + Load row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel title="Daily revenue — this week">
          <BarChart data={WEEKLY_REVENUE} color="#3B82F6" height={120} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid #F1F5F9",
              fontSize: 12,
            }}
          >
            <span style={{ color: "#64748B" }}>Total</span>
            <span style={{ fontWeight: 700, color: "#0F172A" }}>$7,850</span>
          </div>
        </Panel>

        <Panel title="Passenger load by hour">
          <BarChart
            data={HOURLY_LOAD}
            color="#10B981"
            height={120}
            maxValue={100}
          />
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "#64748B",
              textAlign: "right",
            }}
          >
            Peak hour: 8am (91% capacity)
          </div>
        </Panel>
      </div>

      {/* Monthly trend */}
      <Panel title="Monthly revenue trend">
        <LineChart data={MONTHLY_REVENUE} color="#2563EB" height={110} />
      </Panel>

      {/* Top routes */}
      <Panel title="Top routes by revenue">
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {["Route", "Description", "Trips", "Revenue", "Avg load"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#999",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                      borderBottom: "1px solid #F1F5F9",
                      background: "#F8FAFC",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {TOP_ROUTES.map((r, i) => (
              <tr key={r.route} style={{ borderBottom: "1px solid #f7f7f7" }}>
                <td
                  style={{
                    padding: "10px 10px",
                    fontWeight: 700,
                    color: "#2563EB",
                  }}
                >
                  {r.route}
                </td>
                <td style={{ padding: "10px 10px", color: "#475569" }}>
                  {r.name}
                </td>
                <td style={{ padding: "10px 10px" }}>{r.trips}</td>
                <td
                  style={{
                    padding: "10px 10px",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  ${r.revenue.toLocaleString()}
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#F1F5F9",
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${r.load}%`,
                          height: "100%",
                          background:
                            r.load > 85
                              ? "#EF4444"
                              : r.load > 65
                                ? "#10B981"
                                : "#F59E0B",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "#475569", minWidth: 30 }}>
                      {r.load}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
