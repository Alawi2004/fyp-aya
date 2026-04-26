// pages/NotificationsPage.jsx
import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import { getNotifications, markNotificationAsRead, createNotification } from "../api/endpoints";

function normalizeNotif(n) {
  const dt = n.created_at ? new Date(n.created_at) : null;
  return {
    id: n.notification_id ?? n.id,
    type: n.type ?? "info",
    title: n.title ?? n.message ?? "",
    body: n.body ?? n.message ?? "",
    target: n.target ?? "All users",
    time: dt ? dt.toTimeString().slice(0, 5) : (n.time ?? ""),
    read: n.is_read ?? n.read ?? false,
  };
}

const TYPES = ["All users", "Passengers", "Drivers"];
const CHANNELS = ["Push notification", "In-app", "SMS"];

const ALERT_STYLE = {
  emergency: {
    dot: "#EF4444",
    bg: "#FEF2F2",
    color: "#B91C1C",
    label: "Emergency",
  },
  delay: { dot: "#F59E0B", bg: "#FFFBEB", color: "#D97706", label: "Delay" },
  info: { dot: "#3B82F6", bg: "#EFF6FF", color: "#1E40AF", label: "Info" },
  success: {
    dot: "#10B981",
    bg: "#ECFDF5",
    color: "#059669",
    label: "Success",
  },
};


export default function NotificationsPage() {
  const [log, setLog] = useState([]);
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    getNotifications()
      .then((data) => setLog((data || []).map(normalizeNotif)))
      .catch(() => {});
  }, []);
  const [form, setForm] = useState({
    title: "",
    body: "",
    target: TYPES[0],
    channel: CHANNELS[0],
    type: "info",
  });
  const [sent, setSent] = useState(false);

  const filtered =
    filterType === "All"
      ? log
      : log.filter((n) => n.type === filterType.toLowerCase());
  const unread = log.filter((n) => !n.read).length;

  async function markAllRead() {
    await Promise.all(
      log.filter((n) => !n.read).map((n) => markNotificationAsRead(n.id).catch(() => {}))
    );
    setLog((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  async function markRead(id) {
    await markNotificationAsRead(id).catch(() => {});
    setLog((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function handleSend() {
    if (!form.title || !form.body) return;
    await createNotification({ message: `${form.title}: ${form.body}` }).catch(() => {});
    const newNote = {
      id: Date.now(),
      type: form.type,
      title: form.title,
      body: form.body,
      target: form.target,
      time: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: false,
    };
    setLog((prev) => [newNote, ...prev]);
    setForm({
      title: "",
      body: "",
      target: TYPES[0],
      channel: CHANNELS[0],
      type: "info",
    });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>
          Notifications
        </h1>
        <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
          Send alerts and view notification history
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total sent"
          value={log.length}
          delta="all time"
          up={null}
        />
        <StatCard
          label="Unread"
          value={unread}
          delta="pending read"
          up={unread === 0}
        />
        <StatCard
          label="Today"
          value={log.filter((n) => !n.read).length + 2}
          delta="sent today"
          up={null}
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}
      >
        {/* Send notification form */}
        <Panel title="Send notification">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="e.g. Bus delay alert"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Message body
              </label>
              <textarea
                value={form.body}
                onChange={(e) =>
                  setForm((p) => ({ ...p, body: e.target.value }))
                }
                placeholder="Write your notification message here..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Send to
                </label>
                <select
                  value={form.target}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, target: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Channel
                </label>
                <select
                  value={form.channel}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, channel: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {CHANNELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Type
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(ALERT_STYLE).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setForm((p) => ({ ...p, type: k }))}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: form.type === k ? v.bg : "#F1F5F9",
                      color: form.type === k ? v.color : "#64748B",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSend}
              className="btn-primary"
              style={{
                background: sent ? "#10B981" : "#2563EB",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 0",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background .2s",
              }}
            >
              {sent ? "✓ Sent!" : "Send notification"}
            </button>
          </div>
        </Panel>

        {/* Notification log */}
        <Panel
          title={`Notification log (${log.length})`}
          action={unread > 0 ? `Mark all read (${unread})` : null}
          onAction={markAllRead}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["All", "Emergency", "Delay", "Info", "Success"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  cursor: "pointer",
                  border: filterType === f ? "none" : "1px solid #e0e0e0",
                  background: filterType === f ? "#2563EB" : "#fff",
                  color: filterType === f ? "#fff" : "#555",
                  fontWeight: filterType === f ? 600 : 400,
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filtered.map((n, i) => {
              const s = ALERT_STYLE[n.type] || ALERT_STYLE.info;
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom:
                      i < filtered.length - 1 ? "1px solid #F1F5F9" : "none",
                    cursor: "pointer",
                    opacity: n.read ? 0.7 : 1,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: s.dot,
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: n.read ? 400 : 700,
                          color: "#0F172A",
                        }}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#2563EB",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#666",
                        lineHeight: 1.4,
                        marginBottom: 4,
                      }}
                    >
                      {n.body}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          background: s.bg,
                          color: s.color,
                          padding: "1px 7px",
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      >
                        {s.label}
                      </span>
                      <span style={{ fontSize: 10, color: "#aaa" }}>
                        → {n.target}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#aaa",
                          marginLeft: "auto",
                        }}
                      >
                        {n.time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
