import { useState, useEffect } from "react";
import { PageLoading } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { StatusPill } from "../components/StatusPill";
import { getAdminIssues } from "../api/endpoints";

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ["Mechanical", "Passenger Incident", "Road Obstruction", "Security", "General"];

const CATEGORY_CFG = {
  "Mechanical":         { bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  "Passenger Incident": { bg: "#FFF7ED", color: "#EA580C", border: "#FED7AA" },
  "Road Obstruction":   { bg: "#EDE9FE", color: "#7C3AED", border: "#C4B5FD" },
  "Security":           { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" },
  "General":            { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
};

const PRIORITY_CFG = {
  high:   { label: "High",   bg: "#FEE2E2", color: "#DC2626", border: "#FECACA" },
  medium: { label: "Medium", bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  low:    { label: "Low",    bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

const STATUS_CFG = {
  open:        { label: "Open",        bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  in_progress: { label: "In Progress", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  resolved:    { label: "Resolved",    bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

const MOCK_ISSUES_FALLBACK = [
  { issue_id: 1, driver_name: "Sara Khoury",    vehicle: "BUS-07", trip_ref: "TRP-038", description: "Brake pedal feels soft, needs inspection",      category: "Mechanical",         priority: "high",   status: "open",        created_at: "2026-05-16T09:15:00" },
  { issue_id: 2, driver_name: "Joe Pharaon",    vehicle: "BUS-09", trip_ref: "TRP-029", description: "AC not working, passengers complaining",         category: "Mechanical",         priority: "medium", status: "in_progress", created_at: "2026-05-16T10:30:00" },
  { issue_id: 3, driver_name: "Karim Moussa",   vehicle: "BUS-01", trip_ref: "TRP-041", description: "Passenger argument — intervention required",     category: "Passenger Incident", priority: "high",   status: "open",        created_at: "2026-05-15T14:00:00" },
  { issue_id: 4, driver_name: "Maya Salameh",   vehicle: "BUS-02", trip_ref: "TRP-033", description: "Road blockage — had to reroute via Highway 1",  category: "Road Obstruction",   priority: "low",    status: "resolved",    created_at: "2026-05-15T11:20:00" },
  { issue_id: 5, driver_name: "Lara Abi Nader", vehicle: "BUS-05", trip_ref: null,      description: "Windscreen wiper broken, cannot drive in rain",  category: "Mechanical",         priority: "high",   status: "open",        created_at: "2026-05-14T08:45:00" },
  { issue_id: 6, driver_name: "Joe Pharaon",    vehicle: "BUS-09", trip_ref: "TRP-029", description: "Suspicious package found under rear seat",      category: "Security",           priority: "high",   status: "resolved",    created_at: "2026-05-13T16:30:00" },
];

// ── Shared badge ──────────────────────────────────────────────────────────────
function Badge({ label, bg, color, border }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: bg, color, border: `1px solid ${border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ── Issue detail drawer ───────────────────────────────────────────────────────
function IssueDrawer({ issue, onClose, onStatusChange }) {
  if (!issue) return null;

  const cat  = CATEGORY_CFG[issue.category]  ?? CATEGORY_CFG["General"];
  const prio = PRIORITY_CFG[issue.priority]  ?? PRIORITY_CFG.low;
  const stat = STATUS_CFG[issue.status]      ?? STATUS_CFG.open;

  function fmtDate(dt) {
    if (!dt) return "—";
    return new Date(dt).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px); opacity:0 } to { transform:none; opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />

      <div style={{ width: "min(92vw, 520px)", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,.14)", overflowY: "auto", animation: "slideInRight .25s ease" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Issue #{issue.issue_id}</span>
            <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge {...cat}  label={issue.category} />
            <Badge {...prio} label={prio.label + " priority"} />
            <Badge {...stat} label={stat.label} />
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 10 }}>Description</div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{issue.description}</div>
        </div>

        {/* Context */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 12 }}>Context</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Driver",    value: issue.driver_name },
              { label: "Vehicle",   value: issue.vehicle     },
              { label: "Trip",      value: issue.trip_ref ?? "—" },
              { label: "Reported",  value: fmtDate(issue.created_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{value || "—"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status actions */}
        <div style={{ padding: "18px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 12 }}>Update Status</div>
          <div style={{ display: "flex", gap: 8 }}>
            {issue.status !== "in_progress" && issue.status !== "resolved" && (
              <button onClick={() => onStatusChange(issue.issue_id, "in_progress")} style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", background: "#EFF6FF", color: "#2563EB", cursor: "pointer" }}>
                Set In Progress
              </button>
            )}
            {issue.status !== "resolved" && (
              <button onClick={() => onStatusChange(issue.issue_id, "resolved")} style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", background: "#ECFDF5", color: "#059669", cursor: "pointer" }}>
                Mark Resolved
              </button>
            )}
            {issue.status === "resolved" && (
              <button onClick={() => onStatusChange(issue.issue_id, "open")} style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", background: "#F1F5F9", color: "#64748B", cursor: "pointer" }}>
                Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IssuesPage() {
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("All");
  const [search,   setSearch]   = useState("");
  const [catFilter,setCatFilter]= useState("All");
  const [prioFilter,setPrioFilter]=useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getAdminIssues()
      .then(d => setIssues(Array.isArray(d) && d.length ? d : MOCK_ISSUES_FALLBACK))
      .catch(() => setIssues(MOCK_ISSUES_FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  function updateStatus(id, newStatus) {
    setIssues(prev => prev.map(i => i.issue_id === id ? { ...i, status: newStatus } : i));
    setSelected(prev => prev?.issue_id === id ? { ...prev, status: newStatus } : prev);
  }

  // Tab filter
  const tabFiltered = issues.filter(i => {
    if (tab === "All")         return true;
    if (tab === "Open")        return i.status === "open";
    if (tab === "In Progress") return i.status === "in_progress";
    if (tab === "Resolved")    return i.status === "resolved";
    return true;
  });

  // Search + category + priority filter
  const visible = tabFiltered.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (i.driver_name  ?? "").toLowerCase().includes(q)
      || (i.description  ?? "").toLowerCase().includes(q)
      || (i.vehicle      ?? "").toLowerCase().includes(q)
      || (i.trip_ref     ?? "").toLowerCase().includes(q);
    const matchCat  = catFilter  === "All" || i.category === catFilter;
    const matchPrio = prioFilter === "All" || i.priority === prioFilter;
    return matchSearch && matchCat && matchPrio;
  });

  // Summary counts
  const openCount       = issues.filter(i => i.status === "open").length;
  const inProgressCount = issues.filter(i => i.status === "in_progress").length;
  const resolvedCount   = issues.filter(i => i.status === "resolved").length;
  const highCount       = issues.filter(i => i.priority === "high" && i.status !== "resolved").length;

  function fmtAgo(dt) {
    if (!dt) return "—";
    const min = Math.floor((Date.now() - new Date(dt)) / 60000);
    if (min < 1)  return "just now";
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24)   return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const TABS = [
    { id: "All",         label: "All Issues",   count: issues.length      },
    { id: "Open",        label: "Open",          count: openCount          },
    { id: "In Progress", label: "In Progress",   count: inProgressCount    },
    { id: "Resolved",    label: "Resolved",      count: resolvedCount      },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Issues Inbox</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {openCount} open · {inProgressCount} in progress · {resolvedCount} resolved
            {highCount > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}> · {highCount} high priority</span>}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        {[
          { label: "Open",        value: openCount,        color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          { label: "In Progress", value: inProgressCount,  color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
          { label: "Resolved",    value: resolvedCount,    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
          { label: "High Priority (unresolved)", value: highCount, color: highCount > 0 ? "#DC2626" : "#059669", bg: highCount > 0 ? "#FEF2F2" : "#ECFDF5", border: highCount > 0 ? "#FECACA" : "#A7F3D0" },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.color, marginTop: 6, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0", alignSelf: "flex-start" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 16px", borderRadius: 7, border: "none",
            fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer",
            background: tab === t.id ? "#fff" : "transparent",
            color:      tab === t.id ? "#2563EB" : "#64748B",
            boxShadow:  tab === t.id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
            display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: tab === t.id ? "#2563EB" : "#E2E8F0", color: tab === t.id ? "#fff" : "#64748B", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 10 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search driver, description, vehicle, trip…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 300 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: "5px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border:     catFilter === c ? "none" : "1px solid #E2E8F0",
              background: catFilter === c ? "#2563EB" : "#fff",
              color:      catFilter === c ? "#fff" : "#64748B",
              fontWeight: catFilter === c ? 600 : 400,
            }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "high", "medium", "low"].map(p => (
            <button key={p} onClick={() => setPrioFilter(p)} style={{
              padding: "5px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border:     prioFilter === p ? "none" : "1px solid #E2E8F0",
              background: prioFilter === p ? (p === "high" ? "#DC2626" : p === "medium" ? "#D97706" : p === "low" ? "#059669" : "#2563EB") : "#fff",
              color:      prioFilter === p ? "#fff" : "#64748B",
              fontWeight: prioFilter === p ? 600 : 400,
            }}>{p === "All" ? "All Priority" : p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Issues table */}
      {loading ? <PageLoading message="Loading issues…" /> : (
        <Panel title={`${visible.length} issue${visible.length !== 1 ? "s" : ""}`} noPad>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                {["ID", "Driver", "Vehicle", "Trip", "Category", "Priority", "Description", "Reported", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((issue, i) => {
                const cat  = CATEGORY_CFG[issue.category]  ?? CATEGORY_CFG["General"];
                const prio = PRIORITY_CFG[issue.priority]  ?? PRIORITY_CFG.low;
                const stat = STATUS_CFG[issue.status]      ?? STATUS_CFG.open;
                return (
                  <tr key={issue.issue_id} className="table-row" style={{ borderBottom: "1px solid #F8FAFC", background: i % 2 === 0 ? "#fff" : "#FAFAFA", cursor: "pointer" }}
                    onClick={() => setSelected(issue)}>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#64748B", fontSize: 11 }}>#{issue.issue_id}</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600 }}>{issue.driver_name ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, fontFamily: "monospace", color: "#2563EB", fontWeight: 600 }}>{issue.vehicle ?? "—"}</td>
                    <td style={{ padding: "11px 14px", fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>{issue.trip_ref ?? "—"}</td>
                    <td style={{ padding: "11px 14px" }}><Badge {...cat} label={issue.category} /></td>
                    <td style={{ padding: "11px 14px" }}><Badge {...prio} label={prio.label} /></td>
                    <td style={{ padding: "11px 14px", maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: "#334155", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {issue.description}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>{fmtAgo(issue.created_at)}</td>
                    <td style={{ padding: "11px 14px" }}><Badge {...stat} label={stat.label} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                        {issue.status === "open" && (
                          <button onClick={() => updateStatus(issue.issue_id, "in_progress")} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "none", background: "#EFF6FF", color: "#2563EB", cursor: "pointer" }}>
                            Start
                          </button>
                        )}
                        {issue.status !== "resolved" && (
                          <button onClick={() => updateStatus(issue.issue_id, "resolved")} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "none", background: "#ECFDF5", color: "#059669", cursor: "pointer" }}>
                            Resolve
                          </button>
                        )}
                        {issue.status === "resolved" && (
                          <button onClick={() => updateStatus(issue.issue_id, "open")} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, border: "none", background: "#F1F5F9", color: "#64748B", cursor: "pointer" }}>
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: "48px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>No issues match your filter</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      )}

      {/* Detail drawer */}
      {selected && (
        <IssueDrawer
          issue={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(id, status) => updateStatus(id, status)}
        />
      )}
    </div>
  );
}
