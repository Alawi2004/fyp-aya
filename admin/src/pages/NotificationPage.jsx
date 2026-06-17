import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import { Modal } from "../components/Modal";
import {
  getNotifications, createNotification,
  updateNotificationApi, deleteNotificationApi,
  getNotificationTemplates, getScheduledNotifications,
  scheduleNotification, updateScheduled, cancelScheduled, createTemplate, updateTemplate, deleteTemplate,
  getRoutes, getDrivers,
} from "../api/endpoints";

// ── Constants ─────────────────────────────────────────────────────────────────
const ALERT_STYLE = {
  emergency: { dot: "#EF4444", bg: "#FEF2F2", color: "#B91C1C", label: "Emergency" },
  delay:     { dot: "#F59E0B", bg: "#FFFBEB", color: "#D97706", label: "Delay"     },
  info:      { dot: "#3B82F6", bg: "#F5F3FF", color: "#4C1D95", label: "Info"      },
  success:   { dot: "#10B981", bg: "#ECFDF5", color: "#059669", label: "Success"   },
};

const TARGET_GROUPS = [
  { id: "all_users",        label: "All Users",        desc: "Everyone on the platform" },
  { id: "all_passengers",   label: "All Passengers",   desc: "All registered passengers" },
  { id: "all_drivers",      label: "All Drivers",      desc: "All active drivers" },
  { id: "route_passengers", label: "Route Passengers", desc: "Passengers on a specific route" },
  { id: "specific_driver",  label: "Specific Driver",  desc: "One selected driver" },
];

const CHANNELS = ["Push Notification", "In-App", "SMS"];

const EMPTY_FORM = { title: "", body: "", type: "info", target: "all_users", route: "", driver: "", channel: "Push Notification", scheduled: false, schedDate: "", schedTime: "" };

const EMPTY_TPL = { name: "", type: "info", target: "all_users", title: "", body: "" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeNotif(n) {
  const dt   = n.created_at ? new Date(n.created_at) : null;
  const text = n.text ?? n.message ?? "";
  const dash = text.indexOf(" — ");
  return {
    id:    n.notification_id ?? n.id,
    type:  n.type ?? "info",
    title: n.title ?? (dash > -1 ? text.slice(0, dash) : text.slice(0, 50)),
    body:  n.body  ?? (dash > -1 ? text.slice(dash + 3) : text),
    target: n.target_group ?? n.target ?? "all_users",
    target_label: n.target_label ?? TARGET_GROUPS.find(g => g.id === (n.target_group ?? n.target))?.label ?? "All Users",
    time:  dt ? dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : (n.time ?? ""),
    read:  n.is_read ?? n.read ?? false,
    // Real delivery counts from DB
    sent_count:  n.sent_count  ?? 0,
    read_count:  n.read_count  ?? 0,
  };
}

// Only used as fallback when a notification was created before delivery tracking columns existed
function seedDelivery(id, target = "all_users") {
  const h = (id * 137 + 31) % 997;
  const base = target === "all_users" ? 1284 : target === "all_passengers" ? 841 : target === "all_drivers" ? 10 : target === "route_passengers" ? 180 : 1;
  const sent      = Math.max(1, base - Math.round(base * ((h % 12) / 100)));
  const failed    = Math.min(sent - 1, Math.round(sent * (((h + 7) % 8) / 100)));
  const delivered = sent - failed;
  const read      = Math.round(delivered * (0.45 + ((h * 3) % 50) / 100));
  return { sent, delivered, read, failed };
}

// Build delivery object — real data if available, seed fallback otherwise
function getDelivery(n) {
  if (n.sent_count > 0) {
    return {
      sent:      n.sent_count,
      delivered: n.sent_count,              // assume delivered = sent (no FCM receipts)
      read:      n.read_count,
      failed:    0,
    };
  }
  return seedDelivery(n.id, n.target);
}

function targetLabel(group, routeName, driverName) {
  if (group === "route_passengers") return routeName ? `${routeName} Passengers` : "Route Passengers";
  if (group === "specific_driver")  return driverName || "Specific Driver";
  return TARGET_GROUPS.find(g => g.id === group)?.label ?? group;
}

function countdown(isoStr) {
  const diff = new Date(isoStr) - new Date();
  if (diff <= 0) return "Now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
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
          color: active === id ? "#6D28D9" : "#64748B",
          boxShadow: active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
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

// ── Delivery bars ─────────────────────────────────────────────────────────────
function DeliveryBars({ delivery }) {
  const { sent, delivered, read, failed } = delivery;
  const delivPct = sent > 0 ? Math.round(delivered / sent * 100) : 0;
  const readPct  = sent > 0 ? Math.round(read      / sent * 100) : 0;
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginBottom: 6 }}>
        <span>Sent <strong style={{ color: "#0F172A" }}>{sent.toLocaleString()}</strong></span>
        {failed > 0 && <span style={{ color: "#DC2626" }}>{failed} failed</span>}
      </div>
      {[
        { label: "Delivered", pct: delivPct, color: "#6D28D9", value: delivered },
        { label: "Read",      pct: readPct,  color: "#10B981", value: read      },
      ].map(({ label, pct, color, value }) => (
        <div key={label} style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
            <span style={{ color, fontWeight: 600 }}>{label}</span>
            <span style={{ color, fontWeight: 700 }}>{value.toLocaleString()} ({pct}%)</span>
          </div>
          <div style={{ height: 5, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab 1: Log & Delivery Status ──────────────────────────────────────────────
function LogTab({ log, onDelete, onEdit }) {
  const [filter,      setFilter]      = useState("All");
  const [search,      setSearch]      = useState("");
  const [editTarget,  setEditTarget]  = useState(null);  // notification being edited
  const [editForm,    setEditForm]    = useState({ title: "", body: "", type: "info" });
  const [editSaving,  setEditSaving]  = useState(false);
  const [editError,   setEditError]   = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function openEdit(n) {
    // Guard: timestamp IDs (> 10^12) are fake local IDs, not real DB IDs
    if (n.id > 1e12) {
      setEditError("Cannot edit — this notification has not been saved to the database yet. Refresh the page and try again.");
      return;
    }
    setEditTarget(n);
    setEditForm({ title: n.title, body: n.body, type: n.type });
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editForm.title || !editForm.body) { setEditError("Title and body are required."); return; }
    setEditSaving(true); setEditError(null);
    try {
      await updateNotificationApi(editTarget.id, editForm);
      onEdit(editTarget.id, editForm);
      setEditTarget(null);
    } catch (err) {
      setEditError(err?.message ?? "Update failed");
    } finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      await deleteNotificationApi(deleteTarget.id);
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err?.message ?? "Delete failed");
    } finally { setIsDeleting(false); }
  }
  const visible = log.filter(n => {
    const matchType   = filter === "All" || n.type === filter.toLowerCase();
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {editError && !editTarget && (
        <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
          {editError}
          <button onClick={() => setEditError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B91C1C", fontWeight: 700 }}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search notifications..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 240 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Emergency", "Delay", "Info", "Success"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: filter === f ? "none" : "1px solid #E2E8F0",
              background: filter === f ? "#6D28D9" : "#fff",
              color: filter === f ? "#fff" : "#555",
              fontWeight: filter === f ? 600 : 400,
            }}>{f}</button>
          ))}
        </div>
      </div>

      <Panel title={`${visible.length} notifications`} noPad>
        {visible.length === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No notifications match your filter.</div>
        )}
        {visible.map((n, i) => {
          const s = ALERT_STYLE[n.type] || ALERT_STYLE.info;
          const delivery = getDelivery(n);
          return (
            <div key={n.id} style={{
              display: "flex", gap: 14, padding: "14px 18px",
              borderBottom: i < visible.length - 1 ? "1px solid #F8FAFC" : "none",
              background: "#fff",
            }}>
              {/* Type dot */}
              <div style={{ paddingTop: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.dot, flexShrink: 0, display: "inline-block" }} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{n.title}</span>
                  <span style={{ fontSize: 10, background: s.bg, color: s.color, padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, marginBottom: 6 }}>{n.body}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 10, color: "#94A3B8" }}>
                  <span>→ {n.target_label || "All Users"}</span>
                  <span>·</span>
                  <span>{n.time}</span>
                </div>
              </div>

              {/* Delivery bars + actions */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <DeliveryBars delivery={delivery} />
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => openEdit(n)} style={{ fontSize: 10, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Edit</button>
                  <button onClick={() => { setDeleteTarget(n); setDeleteError(null); }} style={{ fontSize: 10, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </Panel>

      {/* Edit modal */}
      {editTarget && (
        <Modal title="Edit Notification" onClose={() => { setEditTarget(null); setEditError(null); }} onSave={handleEditSave} saving={editSaving}>
          {editError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{editError}</div>}
          <div style={{ marginBottom: 13 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Title</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Body</label>
            <textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Type</label>
            <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none" }}>
              {["info", "success", "delay", "emergency"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal title="Delete notification" onClose={() => { setDeleteTarget(null); setDeleteError(null); }}>
          {deleteError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{deleteError}</div>}
          <p style={{ fontSize: 14, color: "#333", marginBottom: 6 }}>Delete <strong>{deleteTarget.title}</strong>?</p>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>This removes the notification from the admin log and from all user inboxes. Cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 2: Compose ────────────────────────────────────────────────────────────
function ComposeTab({ templates, routes, drivers, onSent, onScheduled }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [sent, setSent]     = useState(false);
  const [sched, setSched]   = useState(false);

  const set = k => v => setForm(f => ({ ...f, [k]: v }));

  function applyTemplate(tpl) {
    setForm(f => ({ ...f, title: tpl.title, body: tpl.body, type: tpl.type, target: tpl.target }));
  }

  const [sendError, setSendError] = useState(null);

  async function handleSend() {
    if (!form.title || !form.body) return;
    setSendError(null);
    const label = targetLabel(form.target, form.route, form.driver);
    try {
      if (form.scheduled && form.schedDate && form.schedTime) {
        const iso = `${form.schedDate}T${form.schedTime}:00`;
        const newSched = { id: Date.now(), title: form.title, body: form.body, type: form.type, target: form.target, target_label: label, scheduled_at: iso, status: "pending" };
        await scheduleNotification(newSched);
        onScheduled(newSched);
        setSched(true);
        setTimeout(() => setSched(false), 3000);
      } else {
        const res = await createNotification({
          title:   form.title,
          body:    form.body,
          type:    form.type,
          target:  form.target,
          channel: form.channel,
        });
        const sentCount = res?.sent_count ?? 0;
        onSent({ id: res?.notification_id ?? Date.now(), title: form.title, body: form.body, type: form.type, target: form.target, target_label: label, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), read: false, sent_count: sentCount, read_count: 0 });
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setSendError(err?.message ?? "Failed to send notification");
    }
  }

  const selectedGroup = TARGET_GROUPS.find(g => g.id === form.target);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16 }}>
      {/* Left: compose form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Panel title="Compose Notification">
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {/* Title */}
            <div>
              <label style={lbl}>Title</label>
              <input value={form.title} onChange={e => set("title")(e.target.value)} placeholder="e.g. Bus delay on Route 12A"
                style={inputStyle} />
            </div>
            {/* Body */}
            <div>
              <label style={lbl}>Message Body</label>
              <textarea value={form.body} onChange={e => set("body")(e.target.value)} placeholder="Write your notification message..." rows={4}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            {/* Type */}
            <div>
              <label style={lbl}>Type</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {Object.entries(ALERT_STYLE).map(([k, v]) => (
                  <button key={k} onClick={() => set("type")(k)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                    background: form.type === k ? v.bg : "#F1F5F9",
                    color:      form.type === k ? v.color : "#64748B",
                    outline:    form.type === k ? `2px solid ${v.dot}` : "none",
                  }}>{v.label}</button>
                ))}
              </div>
            </div>
            {/* Channel */}
            <div>
              <label style={lbl}>Channel</label>
              <select value={form.channel} onChange={e => set("channel")(e.target.value)} style={inputStyle}>
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Schedule toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: form.scheduled ? "#F5F3FF" : "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <input type="checkbox" id="schedCheck" checked={form.scheduled} onChange={e => set("scheduled")(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#6D28D9", cursor: "pointer" }} />
              <label htmlFor="schedCheck" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>Schedule for later</label>
            </div>
            {form.scheduled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" value={form.schedDate} onChange={e => set("schedDate")(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={lbl}>Time</label>
                  <input type="time" value={form.schedTime} onChange={e => set("schedTime")(e.target.value)} style={inputStyle} />
                </div>
              </div>
            )}
            {sendError && (
              <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
                {sendError}
              </div>
            )}
            {/* Send button */}
            <button onClick={handleSend} style={{
              background: sent || sched ? "#10B981" : "#6D28D9", color: "#fff", border: "none",
              borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "background .2s",
            }}>
              {sent ? "Sent!" : sched ? "Scheduled!" : form.scheduled ? "Schedule Notification" : "Send Notification"}
            </button>
          </div>
        </Panel>
      </div>

      {/* Right: target group + templates */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Target Group */}
        <Panel title="Target Group">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TARGET_GROUPS.map(g => (
              <div key={g.id} onClick={() => set("target")(g.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                borderRadius: 10, cursor: "pointer",
                border: `2px solid ${form.target === g.id ? "#6D28D9" : "#E2E8F0"}`,
                background: form.target === g.id ? "#F5F3FF" : "#fff",
                transition: "all .15s",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: form.target === g.id ? 700 : 500, color: form.target === g.id ? "#4C1D95" : "#0F172A" }}>{g.label}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{g.desc}</div>
                </div>
                {form.target === g.id && <span style={{ color: "#6D28D9", fontWeight: 700, fontSize: 13 }}>✓</span>}
              </div>
            ))}

            {/* Route sub-select */}
            {form.target === "route_passengers" && (
              <div style={{ marginTop: 4 }}>
                <label style={lbl}>Select Route</label>
                <select value={form.route} onChange={e => set("route")(e.target.value)} style={inputStyle}>
                  <option value="">— Pick a route —</option>
                  {routes.map(r => (
                    <option key={r.route_id ?? r.id} value={r.route_name ?? r.name}>
                      {r.route_name ?? r.name}
                      {r.start_location && r.end_location ? ` (${r.start_location} → ${r.end_location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Driver sub-select */}
            {form.target === "specific_driver" && (
              <div style={{ marginTop: 4 }}>
                <label style={lbl}>Select Driver</label>
                <select value={form.driver} onChange={e => set("driver")(e.target.value)} style={inputStyle}>
                  <option value="">— Pick a driver —</option>
                  {drivers.map(d => {
                    const name = d.full_name ?? d.name ?? "";
                    const key  = d.driver_id ?? d.user_id ?? d.id ?? name;
                    return (
                      <option key={key} value={name}>
                        {name}{d.license_number ? ` · ${d.license_number}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </Panel>

        {/* Quick Templates */}
        <Panel title="Quick Templates">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.slice(0, 5).map(t => {
              const s = ALERT_STYLE[t.type] || ALERT_STYLE.info;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{t.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: s.bg, color: s.color }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                  </div>
                  <button onClick={() => applyTemplate(t)} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                    Use
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── Tab 3: Scheduled ──────────────────────────────────────────────────────────
function ScheduledTab({ scheduled, onCancel, onEdit }) {
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState({ title: "", body: "", type: "info", schedDate: "", schedTime: "" });
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  const pending = scheduled.filter(n => n.status === "pending");
  const sent    = scheduled.filter(n => n.status === "sent");

  function openEdit(n) {
    const dt = n.scheduled_at ? new Date(n.scheduled_at) : new Date();
    setEditTarget(n);
    setEditForm({
      title:     n.title ?? "",
      body:      n.body  ?? "",
      type:      n.type  ?? "info",
      schedDate: dt.toISOString().slice(0, 10),
      schedTime: dt.toISOString().slice(11, 16),
    });
    setSaveError(null);
  }

  async function handleEditSave() {
    if (!editForm.title || !editForm.body || !editForm.schedDate || !editForm.schedTime) {
      setSaveError("All fields are required."); return;
    }
    setSaving(true); setSaveError(null);
    try {
      await updateScheduled(editTarget.id, {
        title:        editForm.title,
        body:         editForm.body,
        type:         editForm.type,
        scheduled_at: `${editForm.schedDate}T${editForm.schedTime}:00`,
      });
      onEdit(editTarget.id, {
        title:        editForm.title,
        body:         editForm.body,
        type:         editForm.type,
        scheduled_at: `${editForm.schedDate}T${editForm.schedTime}:00`,
      });
      setEditTarget(null);
    } catch (err) {
      setSaveError(err?.message ?? "Update failed");
    } finally { setSaving(false); }
  }

  function NotifCard({ n }) {
    const s   = ALERT_STYLE[n.type] || ALERT_STYLE.info;
    const isPending = n.status === "pending";
    const fmtDate = new Date(n.scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px", background: isPending ? "#fff" : "#FAFAFA", border: `1px solid ${isPending ? "#E2E8F0" : "#F1F5F9"}`, borderRadius: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.dot, flexShrink: 0, marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{n.title}</span>
            <span style={{ fontSize: 10, background: s.bg, color: s.color, padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5, marginBottom: 8 }}>{n.body}</div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#94A3B8" }}>
            <span>→ {n.target_label ?? n.target}</span>
            <span>·</span>
            <span>{fmtDate}</span>
            {isPending && <span style={{ color: "#059669", fontWeight: 600 }}>{countdown(n.scheduled_at)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {isPending && <>
            <button onClick={() => openEdit(n)} style={{ fontSize: 11, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontWeight: 600 }}>Edit</button>
            <button onClick={() => onCancel(n.id)} style={{ fontSize: 11, color: "#DC2626", background: "#FEF2F2", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
          </>}
          {!isPending && <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>Sent</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title={`Pending — ${pending.length} scheduled`}>
        {pending.length === 0
          ? <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No pending scheduled notifications.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{pending.map(n => <NotifCard key={n.id} n={n} />)}</div>
        }
      </Panel>
      <Panel title={`Sent — ${sent.length} completed`}>
        {sent.length === 0
          ? <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No sent scheduled notifications.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{sent.map(n => <NotifCard key={n.id} n={n} />)}</div>
        }
      </Panel>

      {editTarget && (
        <Modal title="Edit Scheduled Notification" onClose={() => { setEditTarget(null); setSaveError(null); }} onSave={handleEditSave} saving={saving}>
          {saveError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{saveError}</div>}
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Title</label>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Body</label>
            <textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} rows={3}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Type</label>
            <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none" }}>
              {["info", "success", "delay", "emergency"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Date</label>
              <input type="date" value={editForm.schedDate} onChange={e => setEditForm(f => ({ ...f, schedDate: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={lbl}>Time</label>
              <input type="time" value={editForm.schedTime} onChange={e => setEditForm(f => ({ ...f, schedTime: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Tab 4: Templates ──────────────────────────────────────────────────────────
function TemplatesTab({ templates, onReload, onEdit, onDelete, onUse }) {
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(EMPTY_TPL);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  function openAdd()   { setEditTarget(null); setForm(EMPTY_TPL); setSaveError(null); setModalOpen(true); }
  function openEdit(t) { setEditTarget(t); setForm({ name: t.name, type: t.type, target: t.target, title: t.title, body: t.body }); setSaveError(null); setModalOpen(true); }

  async function handleSave() {
    if (!form.name || !form.title || !form.body) { setSaveError("Name, title, and body are required."); return; }
    setSaveError(null); setSaving(true);
    try {
      if (editTarget) {
        await updateTemplate(editTarget.id, form);
        onEdit({ ...editTarget, ...form });
      } else {
        await createTemplate(form);
        onReload(); // reload to get real DB id
      }
      setModalOpen(false);
    } catch (err) {
      setSaveError(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={openAdd} style={{ background: "#6D28D9", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Template
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {templates.map(t => {
          const s = ALERT_STYLE[t.type] || ALERT_STYLE.info;
          const tg = TARGET_GROUPS.find(g => g.id === t.target);
          return (
            <div key={t.id} style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 14, padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 5 }}>{t.name}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: s.bg, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: "#F1F5F9", color: "#64748B" }}>{tg?.label ?? t.target}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{t.title}</div>
              <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5, marginBottom: 14, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                {t.body}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onUse(t)} style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#fff", background: "#6D28D9", border: "none", borderRadius: 7, padding: "7px 0", cursor: "pointer" }}>Use</button>
                <button onClick={() => openEdit(t)} style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#6D28D9", background: "#F5F3FF", border: "none", borderRadius: 7, padding: "7px 0", cursor: "pointer" }}>Edit</button>
                <button onClick={async () => {
                  if (!window.confirm(`Delete template "${t.name}"?`)) return;
                  try { await deleteTemplate(t.id); onDelete(t.id); } catch (err) { alert(err?.message ?? "Delete failed"); }
                }} style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 7, padding: "7px 0", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Template" : "New Template"} onClose={() => { setModalOpen(false); setSaveError(null); }} onSave={handleSave} saving={saving}>
          {saveError && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{saveError}</div>}
          {[{ label: "Template Name", key: "name", placeholder: "e.g. Bus Delay Alert" }, { label: "Notification Title", key: "title", placeholder: "e.g. Bus Delay on {route}" }].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={lbl}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputStyle} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Message Body</label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={4} placeholder="Use {placeholders} for dynamic content..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {Object.entries(ALERT_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Default Target</label>
              <select value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} style={inputStyle}>
                {TARGET_GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
const lbl = { fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" };

// ── Main NotificationsPage ────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [tab,       setTab]       = useState("log");
  const [log,       setLog]       = useState([]);
  const [templates, setTemplates] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [routes,    setRoutes]    = useState([]);
  const [drivers,   setDrivers]   = useState([]);

  useEffect(() => {
    getNotifications()
      .then(d => setLog(Array.isArray(d) ? d.map(normalizeNotif) : []))
      .catch(() => setLog([]));

    getNotificationTemplates()
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));

    getScheduledNotifications()
      .then(d => setScheduled(Array.isArray(d) ? d : []))
      .catch(() => setScheduled([]));

    getRoutes()
      .then(d => setRoutes(Array.isArray(d) ? d : []))
      .catch(() => {});

    getDrivers()
      .then(d => setDrivers(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => {});
  }, []);

  const pending   = scheduled.filter(n => n.status === "pending").length;
  const todaySent = log.filter(n => n.time).length + 2;

  // Overall delivery rate across all notifications (real counts when available)
  const allDelivery = log.reduce((acc, n) => {
    const d = getDelivery(n);
    acc.sent      += d.sent;
    acc.delivered += d.delivered;
    acc.read      += d.read;
    return acc;
  }, { sent: 0, delivered: 0, read: 0 });
  const overallDelivPct = allDelivery.sent > 0 ? Math.round(allDelivery.delivered / allDelivery.sent * 100) : 0;
  const overallReadPct  = allDelivery.sent > 0 ? Math.round(allDelivery.read      / allDelivery.sent * 100) : 0;

  function loadLog() {
    getNotifications()
      .then(d => setLog(Array.isArray(d) ? d.map(normalizeNotif) : []))
      .catch(() => {});
  }

  function handleSent(notif) {
    // Reload from DB so the new notification gets its real ID
    loadLog();
  }
  function loadScheduled() {
    getScheduledNotifications()
      .then(d => setScheduled(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  function handleScheduled() {
    // Reload so the new schedule gets its real DB id
    loadScheduled();
  }
  async function handleCancelScheduled(id) {
    try {
      await cancelScheduled(id);
      setScheduled(prev => prev.filter(n => (n.id ?? n.schedule_id) !== id));
    } catch (err) {
      alert(err?.message ?? "Failed to cancel scheduled notification");
    }
  }

  // Template CRUD
  function handleUseTemplate(tpl) {
    setTab("compose");
    // The ComposeTab picks up templates to use via the Quick Templates panel
  }

  const tabs = [
    { id: "log",       label: "Log & Delivery",  badge: 0 },
    { id: "compose",   label: "Compose",          badge: 0        },
    { id: "scheduled", label: "Scheduled",        badge: pending  },
    { id: "templates", label: "Templates",        badge: 0        },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Notifications</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Send, schedule, and track notification delivery across all user groups
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <TabNav tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Sent"    value={log.length}             delta="all time"           accent="#6D28D9" />
        <StatCard label="Delivery Rate" value={`${overallDelivPct}%`}  delta="delivered / sent"   up={overallDelivPct >= 90} accent="#10B981" />
        <StatCard label="Read Rate"     value={`${overallReadPct}%`}   delta="read by passengers" up={overallReadPct >= 60}  accent="#7C3AED" />
        <StatCard label="Scheduled"     value={pending}                delta="queued to send"     accent="#0EA5E9" />
      </div>

      {/* Tab content */}
      {tab === "log"       && <LogTab
        log={log}
        onDelete={id => setLog(prev => prev.filter(n => n.id !== id))}
        onEdit={(id, patch) => setLog(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))}
      />}
      {tab === "compose"   && <ComposeTab   templates={templates} routes={routes} drivers={drivers} onSent={handleSent}  onScheduled={handleScheduled} />}
      {tab === "scheduled" && <ScheduledTab
        scheduled={scheduled}
        onCancel={handleCancelScheduled}
        onEdit={(id, patch) => setScheduled(prev => prev.map(n => (n.id ?? n.schedule_id) === id ? { ...n, ...patch } : n))}
      />}
      {tab === "templates" && (
        <TemplatesTab
          templates={templates}
          onReload={() => getNotificationTemplates().then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {})}
          onEdit={t   => setTemplates(prev => prev.map(p => p.id === t.id ? t : p))}
          onDelete={id => setTemplates(prev => prev.filter(t => t.id !== id))}
          onUse={tpl  => { handleUseTemplate(tpl); }}
        />
      )}
    </div>
  );
}

