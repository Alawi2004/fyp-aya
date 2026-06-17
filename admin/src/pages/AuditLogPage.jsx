import { useState, useEffect, useCallback } from "react";
import { Download, Search as SearchIcon } from "lucide-react";
import apiClient from "../api/apiClient";

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows) {
  const cols = [
    { h: "Timestamp",    v: r => new Date(r.created_at).toISOString() },
    { h: "Actor",        v: r => r.actor_name ?? "System"             },
    { h: "Role",         v: r => r.actor_role ?? ""                   },
    { h: "Action",       v: r => r.action_name                        },
    { h: "Entity Type",  v: r => r.entity_type                        },
    { h: "Entity ID",    v: r => r.entity_id ?? ""                    },
    { h: "IP Address",   v: r => r.ip_address ?? ""                   },
  ];
  const header = cols.map(c => `"${c.h}"`).join(",");
  const body   = rows.map(r => cols.map(c => `"${String(c.v(r)).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob   = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `audit-log-${Date.now()}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const ACTION_COLORS = {
  created:   { bg: "#ECFDF5", color: "#059669" },
  updated:   { bg: "#F5F3FF", color: "#6D28D9" },
  deleted:   { bg: "#FEF2F2", color: "#DC2626" },
  suspended: { bg: "#FFFBEB", color: "#D97706" },
  restored:  { bg: "#ECFDF5", color: "#059669" },
  login:     { bg: "#F5F3FF", color: "#7C3AED" },
  logout:    { bg: "#F1F5F9", color: "#64748B" },
  credited:  { bg: "#ECFDF5", color: "#059669" },
  debited:   { bg: "#FEF2F2", color: "#DC2626" },
  exported:  { bg: "#F5F3FF", color: "#6D28D9" },
  sent:      { bg: "#F5F3FF", color: "#0891B2" },
};

function actionStyle(action = "") {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return ACTION_COLORS[key] || { bg: "#F1F5F9", color: "#475569" };
}

function mk(id, actor, role, action, entityType, entityId, ip, hoursAgo, oldV, newV) {
  return { audit_log_id: id, actor_name: actor, actor_role: role, action_name: action, entity_type: entityType, entity_id: String(entityId), ip_address: ip, created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(), old_values_json: oldV ? JSON.stringify(oldV) : null, new_values_json: newV ? JSON.stringify(newV) : null };
}


const PAGE_SIZE = 10;

// ══════════════════════════════════════════════════════════════════════════════
//  AuditLogPage
// ══════════════════════════════════════════════════════════════════════════════

export default function AuditLogPage() {
  const [all,      setAll]      = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [expanded, setExpanded] = useState(null);

  // Filters
  const [search,     setSearch]     = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterFrom,   setFilterFrom]   = useState("");
  const [filterTo,     setFilterTo]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 200 });
    if (filterAction) params.set("action",      filterAction);
    if (filterEntity) params.set("entity_type", filterEntity);
    if (filterFrom)   params.set("from",        filterFrom);
    if (filterTo)     params.set("to",          filterTo);
    if (search)       params.set("search",      search);

    apiClient.get(`/audit-logs?${params}`)
      .then(d => setAll(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, [filterAction, filterEntity, filterFrom, filterTo, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterAction, filterEntity, filterFrom, filterTo]);

  // Client-side filter for mock mode
  const filtered = all.filter(r => {
    if (search && !(`${r.actor_name} ${r.action_name} ${r.entity_type}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterAction && !r.action_name.includes(filterAction)) return false;
    if (filterEntity && r.entity_type !== filterEntity) return false;
    if (filterFrom && new Date(r.created_at) < new Date(filterFrom)) return false;
    if (filterTo   && new Date(r.created_at) > new Date(filterTo + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmtDate = (iso) => new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const clearFilters = () => { setSearch(""); setFilterAction(""); setFilterEntity(""); setFilterFrom(""); setFilterTo(""); };
  const hasFilters   = search || filterAction || filterEntity || filterFrom || filterTo;

  const INP = { padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#F8FAFC", color: "#1E293B" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.4px" }}>Audit Log</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
            Paginated, filterable record of all admin actions · {filtered.length} events
          </p>
        </div>
        <button onClick={() => exportCSV(filtered)} style={{ padding: "8px 16px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", display: "flex" }}><SearchIcon size={13} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Actor, action, entity…"
            style={{ ...INP, width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
        </div>

        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ ...INP, flex: "1 1 140px" }}>
          <option value="">All Actions</option>
          {[...new Set(all.map(l => l.action_name))].sort().map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={{ ...INP, flex: "1 1 120px" }}>
          <option value="">All Entities</option>
          {[...new Set(all.map(l => l.entity_type).filter(Boolean))].sort().map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...INP, flex: "1 1 130px" }} title="From date" />
        <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   style={{ ...INP, flex: "1 1 130px" }} title="To date" />

        {hasFilters && (
          <button onClick={clearFilters} style={{ padding: "8px 12px", border: "1px solid #E2E8F0", background: "#fff", borderRadius: 8, fontSize: 12, color: "#64748B", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
        {/* Table head */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr 90px", padding: "10px 18px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", gap: 8 }}>
          {["Timestamp", "Actor", "Action", "Entity", "IP"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading…</div>
        ) : pageRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>No audit events match your filters.</div>
        ) : pageRows.map((row, i) => {
          const isOpen = expanded === row.audit_log_id;
          const aStyle = actionStyle(row.action_name);
          return (
            <div key={row.audit_log_id} style={{ borderBottom: "1px solid #F8FAFC" }}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isOpen ? null : row.audit_log_id)}
                className="table-row"
                style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 1fr 90px", padding: "11px 18px", gap: 8, alignItems: "center", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}
              >
                <span style={{ fontSize: 11, color: "#64748B" }}>{fmtDate(row.created_at)}</span>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{row.actor_name ?? "System"}</div>
                  {row.actor_role && <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "capitalize" }}>{row.actor_role}</div>}
                </div>

                <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: aStyle.bg, color: aStyle.color, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                  {row.action_name}
                </span>

                <div>
                  <span style={{ fontSize: 12, color: "#475569" }}>{row.entity_type}</span>
                  {row.entity_id && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 6 }}>#{row.entity_id}</span>}
                </div>

                <span style={{ fontSize: 11, color: "#94A3B8" }}>{row.ip_address ?? "—"}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ background: "#F8FAFC", borderTop: "1px solid #F1F5F9", padding: "12px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {row.old_values_json && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Before</div>
                      <pre style={{ margin: 0, fontSize: 11, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "8px 10px", color: "#7F1D1D", overflow: "auto", maxHeight: 120 }}>
                        {JSON.stringify(JSON.parse(row.old_values_json), null, 2)}
                      </pre>
                    </div>
                  )}
                  {row.new_values_json && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>After</div>
                      <pre style={{ margin: 0, fontSize: 11, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 7, padding: "8px 10px", color: "#14532D", overflow: "auto", maxHeight: 120 }}>
                        {JSON.stringify(JSON.parse(row.new_values_json), null, 2)}
                      </pre>
                    </div>
                  )}
                  {!row.old_values_json && !row.new_values_json && (
                    <div style={{ fontSize: 12, color: "#94A3B8", gridColumn: "1/3" }}>No value diff recorded for this event.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#CBD5E1" : "#374151" }}>← Prev</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = page <= 4 ? i + 1 : page + i - 3;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${p === page ? "#6D28D9" : "#E2E8F0"}`, background: p === page ? "#F5F3FF" : "#fff", fontSize: 12, fontWeight: p === page ? 700 : 400, color: p === page ? "#6D28D9" : "#374151", cursor: "pointer" }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, cursor: page === totalPages ? "not-allowed" : "pointer", color: page === totalPages ? "#CBD5E1" : "#374151" }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

