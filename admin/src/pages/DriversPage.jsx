import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { useBusCounter } from "../hooks/useBusCounter";
import { useCameraStream } from "../hooks/useCameraStream";
import { getDrivers, createDriver, updateDriver } from "../api/endpoints";
import { MOCK_DRIVERS } from "../data/mockData";

function normalizeDriver(d) {
  return {
    id: d.driver_id ?? d.id,
    name: d.full_name ?? d.name ?? "",
    license: d.license_number ?? d.license ?? "",
    phone: d.phone ?? d.email ?? "",
    trips: d.trips ?? 0,
    rating: d.rating ?? null,
    status: d.status ?? "Active",
  };
}

const EMPTY_FORM = { name: "", license: "", phone: "", status: "Active" };

// ── Camera feed panel ─────────────────────────────────────────
function CameraPanel() {
  const { imgSrc, videoRef, connected, usingWebcam, error } = useCameraStream();

  const sourceLabel = usingWebcam ? "Webcam" : "Streaming";

  return (
    <Panel
      title="Door camera — live"
      action={
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "#10B981" : "#ef5350",
              display: "inline-block",
              animation: connected ? "pulse 1.5s infinite" : "none",
            }}
          />
          <span
            style={{
              color: connected ? "#059669" : "#B91C1C",
              fontWeight: 600,
            }}
          >
            {connected ? sourceLabel : "Offline"}
          </span>
        </span>
      }
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          aspectRatio: "4/3",
          background: "#0a0a0a",
          borderRadius: 8,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* WebSocket JPEG stream */}
        {!usingWebcam && imgSrc && (
          <img
            src={imgSrc}
            alt="Camera feed"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        )}

        {/* Local webcam stream — always rendered so ref is available */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: usingWebcam ? "block" : "none",
          }}
        />

        {/* Overlay when not connected */}
        {!connected && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0a0a0a",
              gap: 10,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              stroke="#333"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="3" y="10" width="34" height="24" rx="4" />
              <circle cx="20" cy="22" r="6" />
              <path d="M14 10l3-4h6l3 4" />
              <circle cx="32" cy="15" r="1.5" fill="#333" stroke="none" />
            </svg>
            <div style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>
              {error || "Connecting..."}
            </div>
            {!error && (
              <div
                style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}
              >
                Trying webcam fallback…
              </div>
            )}
          </div>
        )}

        {/* Live badge */}
        {connected && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: usingWebcam ? "#2563EB" : "#ef5350",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 4,
              letterSpacing: ".08em",
            }}
          >
            ● {usingWebcam ? "WEBCAM" : "LIVE"}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Live count panel ──────────────────────────────────────────
function LiveCountPanel({ counts, events, status, loading, error, onReset }) {
  if (error) {
    return (
      <Panel title="Live passenger count">
        <div style={{ padding: "16px 0", textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              color: "#ef5350",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Cannot connect to counter
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              background: "#F8FAFC",
              padding: "8px 12px",
              borderRadius: 8,
              color: "#333",
              textAlign: "left",
            }}
          >
            python api_server.py --no-show
          </div>
        </div>
      </Panel>
    );
  }

  if (loading || !counts) {
    return (
      <Panel title="Live passenger count">
        <div
          style={{
            padding: "16px 0",
            textAlign: "center",
            fontSize: 12,
            color: "#aaa",
          }}
        >
          Connecting...
        </div>
      </Panel>
    );
  }

  const BUS_CAPACITY = 30;
  const pct = Math.min(Math.round((counts.on_bus / BUS_CAPACITY) * 100), 100);
  const barColor = pct > 90 ? "#ef5350" : pct > 70 ? "#F59E0B" : "#10B981";

  return (
    <Panel
      title="Live passenger count"
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: status?.running ? "#10B981" : "#ef5350",
                display: "inline-block",
              }}
            />
            <span
              style={{
                color: status?.running ? "#059669" : "#B91C1C",
                fontWeight: 600,
              }}
            >
              {status?.running ? "Live" : "Offline"}
            </span>
          </span>
          <span style={{ fontSize: 10, color: "#bbb" }}>{status?.fps} fps</span>
          <button
            onClick={onReset}
            style={{
              fontSize: 10,
              color: "#B91C1C",
              background: "#FEF2F2",
              border: "none",
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      }
    >
      {/* Count boxes */}
      <div
        style={{
          display: "flex",
          marginBottom: 14,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {[
          {
            label: "On bus now",
            value: counts.on_bus,
            color: "#2563EB",
            bg: "#EFF6FF",
          },
          {
            label: "Entered",
            value: counts.entered,
            color: "#059669",
            bg: "#ECFDF5",
          },
          {
            label: "Exited",
            value: counts.exited,
            color: "#D97706",
            bg: "#FFFBEB",
          },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: "12px 8px",
              background: item.bg,
              textAlign: "center",
              borderRight: i < 2 ? "1px solid #fff" : "none",
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: item.color,
                lineHeight: 1,
              }}
            >
              {item.value}
            </div>
            <div
              style={{
                fontSize: 10,
                color: item.color,
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Capacity bar */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#475569",
            marginBottom: 5,
          }}
        >
          <span>Bus capacity</span>
          <span style={{ fontWeight: 600, color: barColor }}>{pct}% full</span>
        </div>
        <div
          style={{
            height: 10,
            background: "#f0f0f0",
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: barColor,
              borderRadius: 5,
              transition: "width .5s ease",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#bbb",
            marginTop: 3,
            textAlign: "right",
          }}
        >
          {counts.on_bus} / {BUS_CAPACITY} seats
        </div>
      </div>

      {/* Last event */}
      {counts.last_event && (
        <div
          style={{
            padding: "8px 10px",
            background:
              counts.last_event.event === "ENTER" ? "#ECFDF5" : "#FFFBEB",
            borderRadius: 8,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 10,
              background:
                counts.last_event.event === "ENTER" ? "#10B981" : "#F59E0B",
              color: "#fff",
            }}
          >
            {counts.last_event.event}
          </span>
          <span style={{ fontSize: 11, color: "#475569" }}>
            Passenger #{counts.last_event.tid} ·{" "}
            {counts.last_event.timestamp?.slice(11, 19)}
          </span>
        </div>
      )}

      {/* Event log */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#aaa",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            marginBottom: 6,
          }}
        >
          Recent events
        </div>
        <div style={{ maxHeight: 150, overflowY: "auto" }}>
          {events.length === 0 && (
            <div
              style={{
                fontSize: 11,
                color: "#bbb",
                textAlign: "center",
                padding: "8px 0",
              }}
            >
              No events yet
            </div>
          )}
          {events.slice(0, 12).map((evt, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 0",
                borderBottom:
                  i < Math.min(events.length, 12) - 1
                    ? "1px solid #f7f7f7"
                    : "none",
                fontSize: 11,
              }}
            >
              <span
                style={{
                  width: 44,
                  textAlign: "center",
                  padding: "1px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 9,
                  background: evt.event === "ENTER" ? "#ECFDF5" : "#FFFBEB",
                  color: evt.event === "ENTER" ? "#059669" : "#D97706",
                }}
              >
                {evt.event}
              </span>
              <span style={{ color: "#64748B" }}>tid #{evt.tid}</span>
              <span style={{ flex: 1, color: "#bbb", textAlign: "right" }}>
                {evt.timestamp?.slice(11, 19)}
              </span>
              <span
                style={{
                  minWidth: 40,
                  textAlign: "right",
                  color: "#2563EB",
                  fontWeight: 600,
                }}
              >
                {evt.on_bus} on bus
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Main DriversPage ──────────────────────────────────────────
export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getDrivers()
      .then((data) => setDrivers((data || []).map(normalizeDriver)))
      .catch(() => setDrivers(MOCK_DRIVERS));
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);

  const { counts, events, status, loading, error, resetCounts } =
    useBusCounter();

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.license.toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(d) {
    setEditTarget(d.id);
    setForm({
      name: d.name,
      license: d.license,
      phone: d.phone,
      status: d.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.license) return;
    if (editTarget) {
      await updateDriver(editTarget, { license_number: form.license }).catch(() => {});
      setDrivers((prev) =>
        prev.map((d) => (d.id === editTarget ? { ...d, ...form } : d)),
      );
    } else {
      await createDriver({ license_number: form.license }).catch(() => {});
      setDrivers((prev) => [
        ...prev,
        { id: Date.now(), ...form, trips: 0, rating: null },
      ]);
    }
    setModalOpen(false);
  }

  function handleDelete() {
    setDrivers((prev) => prev.filter((d) => d.id !== deleteId));
    setDeleteId(null);
  }

  const columns = [
    {
      key: "name",
      label: "Driver",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {v
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.phone}</div>
          </div>
        </div>
      ),
    },
    { key: "license", label: "License" },
    { key: "trips", label: "Trips today" },
    {
      key: "rating",
      label: "Rating",
      render: (v) =>
        v ? (
          <span style={{ color: "#f9a825", fontWeight: 600 }}>★ {v}</span>
        ) : (
          <span style={{ color: "#ccc" }}>—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusPill status={v} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            style={{
              fontSize: 11,
              color: "#2563EB",
              background: "#EFF6FF",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(row.id);
            }}
            style={{
              fontSize: 11,
              color: "#B91C1C",
              background: "#FEF2F2",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Heading */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}
          >
            Drivers
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            {drivers.length} total drivers · live door camera active
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={openAdd}
          className="btn-primary"
          style={{
            background: "#2563EB",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-.1px",
          }}
        >
          + Add driver
        </button>
      </div>

      {/* Top row: camera feed (left) + live count panel (right) */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}
      >
        <CameraPanel />
        <LiveCountPanel
          counts={counts}
          events={events}
          status={status}
          loading={loading}
          error={error}
          onReset={resetCounts}
        />
      </div>

      {/* Bottom: search + driver table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          placeholder="Search by name or license..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
            outline: "none",
            width: 280,
          }}
        />
        <Panel title="Driver list">
          <DataTable columns={columns} rows={filtered} onRowClick={openEdit} />
          {filtered.length === 0 && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                color: "#bbb",
                fontSize: 13,
              }}
            >
              No drivers match your search.
            </div>
          )}
        </Panel>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal
          title={editTarget ? "Edit driver" : "Add new driver"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        >
          {[
            {
              label: "Full name",
              key: "name",
              placeholder: "e.g. Karim Moussa",
            },
            {
              label: "License number",
              key: "license",
              placeholder: "e.g. LB-20341",
            },
            { label: "Phone number", key: "phone", placeholder: "+961 3 ..." },
          ].map((field) => (
            <div key={field.key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                  fontWeight: 600,
                }}
              >
                {field.label}
              </label>
              <input
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [field.key]: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 12,
                color: "#475569",
                display: "block",
                marginBottom: 5,
                fontWeight: 600,
              }}
            >
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Delete driver" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>
            Are you sure you want to delete this driver? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDeleteId(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#ef5350",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
