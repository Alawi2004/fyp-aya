import { useState, useEffect } from "react";
import { ExportBtn } from "../components/ExportBtn";
import { Panel } from "../components/Panel";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";
import { getComplaints, createComplaint, updateComplaintStatus, addComplaintComment, getDrivers, getRoutes } from "../api/endpoints";

// ── Status mapping (backend ↔ frontend display) ───────────────────────────────
const STATUS_FROM_API = {
  submitted:    "Open",
  under_review: "In Progress",
  assigned:     "In Progress",
  resolved:     "Resolved",
  closed:       "Closed",
};
const STATUS_TO_API = {
  "Open":        "submitted",
  "In Progress": "under_review",
  "Resolved":    "resolved",
  "Closed":      "closed",
};

// ── Config ────────────────────────────────────────────────────────────────────
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES   = ["Open", "In Progress", "Resolved", "Closed"];
const CATEGORIES = ["Driver Behavior", "Route Issue", "Payment", "App Issue", "Safety", "Vehicle", "Other"];

const PRIORITY_STYLE = {
  Critical: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  High:     { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  Medium:   { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  Low:      { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
};

const STATUS_STYLE = {
  "Open":        { bg: "#FEF2F2", color: "#DC2626" },
  "In Progress": { bg: "#EFF6FF", color: "#2563EB" },
  "Resolved":    { bg: "#ECFDF5", color: "#059669" },
  "Closed":      { bg: "#F8FAFC", color: "#94A3B8" },
};

const CAT_COLOR = {
  "Driver Behavior": "#2563EB", "Route Issue": "#7C3AED", "Payment": "#059669",
  "App Issue": "#D97706",      "Safety": "#DC2626",       "Vehicle": "#0891B2", "Other": "#64748B",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ADMINS = ["Admin User", "Transport Manager", "Finance Officer"];

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLE[priority] || PRIORITY_STYLE.Low;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {priority}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Open;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

// ── Complaint detail drawer ───────────────────────────────────────────────────
function ComplaintDetail({ complaint, onClose, onUpdate, onAddComment }) {
  const [newComment,  setNewComment]  = useState("");
  const [newStatus,   setNewStatus]   = useState(complaint.status);
  const [assignee,    setAssignee]    = useState(complaint.assigned_to ?? "");

  function handleStatusUpdate() {
    onUpdate(complaint.complaint_id, { status: newStatus, assigned_to: assignee || null });
  }

  function handleComment() {
    if (!newComment.trim()) return;
    const author  = user?.full_name ?? user?.email ?? "Admin";
    const comment = { author, text: newComment.trim(), time: new Date().toISOString() };
    onAddComment(complaint.complaint_id, comment);
    setNewComment("");
  }

  const ps = PRIORITY_STYLE[complaint.priority] || PRIORITY_STYLE.Low;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(40px);opacity:0 } to { transform:none;opacity:1 } }`}</style>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(15,23,42,.40)", backdropFilter: "blur(3px)" }} />

      <div style={{
        width: "min(92vw, 620px)", background: "#fff",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,.14)",
        overflowY: "auto", animation: "slideInRight .25s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>{complaint.id}</span>
              <PriorityBadge priority={complaint.priority} />
              <StatusBadge status={complaint.status} />
            </div>
            <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#64748B", fontSize: 15 }}>✕</button>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 8, lineHeight: 1.3 }}>{complaint.title}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "#64748B" }}>
            <span style={{ color: CAT_COLOR[complaint.category] ?? "#64748B", fontWeight: 600 }}>{complaint.category}</span>
            <span>·</span>
            <span>{fmtDate(complaint.created_at)}</span>
            {complaint.assigned_to && <><span>·</span><span>{complaint.assigned_to}</span></>}
          </div>
        </div>

        {/* Info tiles */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Passenger", value: complaint.passenger ?? "—" },
            { label: "Driver",    value: complaint.driver    ?? "—" },
            { label: "Route",     value: complaint.route     ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 9, padding: "10px 12px", border: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Description</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #F1F5F9" }}>
            {complaint.description}
          </div>
        </div>

        {/* Attached photo */}
        {complaint.photo_url && (
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Attached Photo</div>
            <a href={complaint.photo_url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
              <img
                src={complaint.photo_url}
                alt="Complaint attachment"
                style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, border: "1px solid #F1F5F9", cursor: "zoom-in" }}
              />
            </a>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>Click to open full-size</div>
          </div>
        )}

        {/* Manage section */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Manage</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none" }}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Assign To</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none" }}>
                <option value="">— Unassigned —</option>
                {ADMINS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleStatusUpdate} style={{ flex: 1, padding: "9px 0", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Save Changes
            </button>
            {complaint.status !== "Resolved" && (
              <button onClick={() => { onUpdate(complaint.complaint_id, { status: "Resolved" }); setNewStatus("Resolved"); }} style={{ padding: "9px 18px", background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ✓ Resolve
              </button>
            )}
            {complaint.status !== "Closed" && (
              <button onClick={() => { onUpdate(complaint.complaint_id, { status: "Closed" }); setNewStatus("Closed"); }} style={{ padding: "9px 18px", background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Close
              </button>
            )}
          </div>
        </div>

        {/* Activity / Comments */}
        <div style={{ padding: "18px 24px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
            Activity ({complaint.comments?.length ?? 0})
          </div>

          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {/* Opened event */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#64748B", flexShrink: 0 }}>!</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>Complaint opened</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{fmtDate(complaint.created_at)}</div>
              </div>
            </div>

            {/* Comments */}
            {(complaint.comments ?? []).map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {c.author.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px", border: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{c.author}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{timeAgo(c.time)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Add comment */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Add Comment</div>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Write an internal note or update..."
              rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
            />
            <button onClick={handleComment} disabled={!newComment.trim()}
              style={{ padding: "8px 18px", background: newComment.trim() ? "#2563EB" : "#F1F5F9", color: newComment.trim() ? "#fff" : "#94A3B8", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: newComment.trim() ? "pointer" : "default" }}>
              Post Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create complaint modal ─────────────────────────────────────────────────────
function CreateComplaintModal({ onClose, onSave, drivers = [], routes = [] }) {
  const EMPTY = { title: "", category: "Driver Behavior", priority: "Medium", description: "", passenger: "", driver: "", route: "" };
  const [form, setForm] = useState(EMPTY);
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title="New Complaint" onClose={onClose} onSave={() => { if (!form.title || !form.description) return; onSave(form); onClose(); }}>
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Title</label>
        <input value={form.title} onChange={e => set("title")(e.target.value)} placeholder="Brief description of the issue" style={inp} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 13 }}>
        <div>
          <label style={lbl}>Category</label>
          <select value={form.category} onChange={e => set("category")(e.target.value)} style={inp}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Priority</label>
          <select value={form.priority} onChange={e => set("priority")(e.target.value)} style={inp}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 13 }}>
        <label style={lbl}>Description</label>
        <textarea value={form.description} onChange={e => set("description")(e.target.value)} rows={4}
          placeholder="Full details of the complaint..."
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
        <div>
          <label style={lbl}>Passenger</label>
          <input value={form.passenger} onChange={e => set("passenger")(e.target.value)} placeholder="Name" style={inp} />
        </div>
        <div>
          <label style={lbl}>Driver (optional)</label>
          <select value={form.driver} onChange={e => set("driver")(e.target.value)} style={inp}>
            <option value="">— None —</option>
            {drivers.map(d => <option key={d.driver_id ?? d.id} value={d.full_name ?? d.name}>{d.full_name ?? d.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Route (optional)</label>
          <select value={form.route} onChange={e => set("route")(e.target.value)} style={inp}>
            <option value="">— None —</option>
            {routes.map(r => <option key={r.route_id ?? r.id} value={r.route_name ?? r.name}>{r.route_name ?? r.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ── Main ComplaintsPage ───────────────────────────────────────────────────────
export default function ComplaintsPage() {
  const { user } = useAuth();
  const [complaints,   setComplaints]   = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [prioFilter,   setPrioFilter]   = useState("All");
  const [catFilter,    setCatFilter]    = useState("All");
  const [search,       setSearch]       = useState("");
  const [detail,       setDetail]       = useState(null);
  const [createOpen,   setCreateOpen]   = useState(false);

  const [driversOpts, setDriversOpts] = useState([]);
  const [routesOpts,  setRoutesOpts]  = useState([]);

  useEffect(() => {
    getComplaints()
      .then(d => {
        const rows = Array.isArray(d) ? d : [];
        setComplaints(rows.map(c => ({
          ...c,
          id:          c.tracking_code ?? String(c.complaint_id),
          passenger:   c.passenger   ?? c.submitted_by_name ?? "—",
          assigned_to: c.assigned_to ?? c.assigned_to_name  ?? null,
          created_at:  c.created_at  ?? c.submitted_at      ?? null,
          comments:    c.comments    ?? [],
          photo_url:   c.photo_url   ?? null,
          status:      STATUS_FROM_API[c.status] ?? c.status,
        })));
      })
      .catch(() => setComplaints([]));
    getDrivers()
      .then(d => setDriversOpts(Array.isArray(d) ? d : []))
      .catch(() => {});
    getRoutes()
      .then(d => setRoutesOpts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const visible = complaints.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.title.toLowerCase().includes(q) || c.passenger?.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    return matchSearch
      && (statusFilter === "All" || c.status === statusFilter)
      && (prioFilter   === "All" || c.priority === prioFilter)
      && (catFilter    === "All" || c.category === catFilter);
  });

  const counts = {
    open:       complaints.filter(c => c.status === "Open").length,
    inProgress: complaints.filter(c => c.status === "In Progress").length,
    resolved:   complaints.filter(c => c.status === "Resolved").length,
    closed:     complaints.filter(c => c.status === "Closed").length,
  };

  function handleCreate(form) {
    const newC = {
      id: `CMP-${String(complaints.length + 1).padStart(3, "0")}`,
      ...form, status: "Open", assigned_to: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      comments: [],
    };
    createComplaint(form).catch(() => {});
    setComplaints(prev => [newC, ...prev]);
  }

  function handleUpdate(cid, patch) {
    if (patch.status) {
      const apiStatus = STATUS_TO_API[patch.status] ?? patch.status;
      updateComplaintStatus(cid, { status: apiStatus }).catch(() => {});
    }
    setComplaints(prev => prev.map(c => c.complaint_id === cid ? { ...c, ...patch, updated_at: new Date().toISOString() } : c));
    setDetail(prev => prev ? { ...prev, ...patch } : prev);
  }

  function handleAddComment(cid, comment) {
    addComplaintComment(cid, comment).catch(() => {});
    setComplaints(prev => prev.map(c => c.complaint_id === cid ? { ...c, comments: [...(c.comments ?? []), comment] } : c));
    setDetail(prev => prev ? { ...prev, comments: [...(prev.comments ?? []), comment] } : prev);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Complaints</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {complaints.length} total · {counts.open} open · {counts.inProgress} in progress
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <ExportBtn
          rows={visible}
          columns={[
            { key: "id",          label: "ID"          },
            { key: "title",       label: "Title"       },
            { key: "category",    label: "Category"    },
            { key: "priority",    label: "Priority"    },
            { key: "status",      label: "Status"      },
            { key: "passenger",   label: "Passenger",  value: r => r.passenger ?? "—" },
            { key: "created_at",  label: "Submitted",  value: r => r.created_at ? new Date(r.created_at).toLocaleString() : "—" },
            { key: "assigned_to", label: "Assigned To", value: r => r.assigned_to ?? "—" },
          ]}
          filename={`complaints-${new Date().toISOString().slice(0,10)}.csv`}
          title="Complaints Report"
        />
        <button onClick={() => setCreateOpen(true)} style={{
          background: "#2563EB", color: "#fff", border: "none",
          borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          + New Complaint
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Open"        value={counts.open}       delta="awaiting action"  up={counts.open === 0}  accent="#DC2626" />
        <StatCard label="In Progress" value={counts.inProgress} delta="being handled"    accent="#2563EB" />
        <StatCard label="Resolved"    value={counts.resolved}   delta="completed"        up accent="#10B981" />
        <StatCard label="Closed"      value={counts.closed}     delta="archived"         accent="#94A3B8" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search complaints..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 240 }} />

        {/* Status filter */}
        <div style={{ display: "flex", gap: 5 }}>
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: statusFilter === s ? "none" : "1px solid #E2E8F0",
              background: statusFilter === s ? (STATUS_STYLE[s]?.bg ?? "#2563EB") : "#fff",
              color:      statusFilter === s ? (STATUS_STYLE[s]?.color ?? "#fff") : "#64748B",
              fontWeight: statusFilter === s ? 700 : 400,
            }}>{s}</button>
          ))}
        </div>

        {/* Priority filter */}
        <div style={{ display: "flex", gap: 5 }}>
          {["All", ...PRIORITIES].map(p => (
            <button key={p} onClick={() => setPrioFilter(p)} style={{
              padding: "5px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: prioFilter === p ? "none" : "1px solid #E2E8F0",
              background: prioFilter === p ? (PRIORITY_STYLE[p]?.bg ?? "#F1F5F9") : "#fff",
              color:      prioFilter === p ? (PRIORITY_STYLE[p]?.color ?? "#64748B") : "#64748B",
              fontWeight: prioFilter === p ? 700 : 400,
            }}>{p}</button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: "#94A3B8" }}>{visible.length} showing</span>
      </div>

      {/* Complaints list */}
      <Panel title={`${visible.length} complaint${visible.length !== 1 ? "s" : ""}`} noPad>
        {visible.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>
            No complaints match your filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visible.map((c, i) => (
              <div
                key={c.id}
                onClick={() => setDetail(c)}
                style={{
                  display: "flex", gap: 14, padding: "16px 18px", cursor: "pointer",
                  borderBottom: i < visible.length - 1 ? "1px solid #F8FAFC" : "none",
                  background: "#fff", transition: "background .12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                {/* Priority stripe */}
                <div style={{ width: 4, borderRadius: 4, background: PRIORITY_STYLE[c.priority]?.color ?? "#94A3B8", flexShrink: 0 }} />

                {/* Category colour dot */}
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: CAT_COLOR[c.category] ?? "#94A3B8", flexShrink: 0, marginTop: 5 }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>{c.id}</span>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    <span style={{ fontSize: 10, background: "#F1F5F9", color: "#64748B", padding: "2px 7px", borderRadius: 6 }}>{c.category}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>{c.description}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94A3B8", flexWrap: "wrap" }}>
                    <span>{c.passenger}</span>
                    {c.driver && <span>Driver: {c.driver}</span>}
                    {c.route  && <span>Route: {c.route}</span>}
                    {c.assigned_to && <span>Assigned: {c.assigned_to}</span>}
                    {c.comments?.length > 0 && <span>{c.comments.length} comment{c.comments.length !== 1 ? "s" : ""}</span>}
                  </div>
                </div>

                {/* Date */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{timeAgo(c.created_at)}</div>
                  <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 2 }}>
                    {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Detail drawer */}
      {detail && (
        <ComplaintDetail
          complaint={detail}
          onClose={() => setDetail(null)}
          onUpdate={handleUpdate}
          onAddComment={handleAddComment}
        />
      )}

      {/* Create modal */}
      {createOpen && (
        <CreateComplaintModal onClose={() => setCreateOpen(false)} onSave={handleCreate} drivers={driversOpts} routes={routesOpts} />
      )}
    </div>
  );
}
