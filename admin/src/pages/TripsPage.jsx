import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { getTrips, createTrip, updateTripStatus } from "../api/endpoints";
import { MOCK_TRIPS } from "../data/mockData";

const STATUSES = ["Scheduled", "Ongoing", "Completed", "Delayed", "Cancelled"];

function normalizeTrip(t) {
  const dt = t.start_time ? new Date(t.start_time) : null;
  return {
    id: t.trip_id ?? t.id,
    route: t.route_name ?? t.route ?? "",
    driver: t.driver_name ?? t.driver ?? "",
    vehicle: t.plate_number ?? t.vehicle ?? "",
    seats: t.seats ?? `0/${t.capacity ?? 30}`,
    date: dt ? dt.toISOString().split("T")[0] : (t.date ?? ""),
    time: dt ? dt.toTimeString().slice(0, 5) : (t.time ?? ""),
    status: t.status
      ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
      : "Scheduled",
  };
}

const EMPTY_FORM = {
  route: "",
  driver: "",
  vehicle: "",
  date: "",
  time: "",
  status: "Scheduled",
};

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    getTrips()
      .then((data) => setTrips((data || []).map(normalizeTrip)))
      .catch(() => setTrips(MOCK_TRIPS));
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered =
    filter === "All" ? trips : trips.filter((t) => t.status === filter);

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split("T")[0] });
    setModalOpen(true);
  }

  function openEdit(trip) {
    setEditTarget(trip.id);
    setForm({
      route: trip.route,
      driver: trip.driver,
      vehicle: trip.vehicle,
      date: trip.date,
      time: trip.time,
      status: trip.status,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.date || !form.time) return;
    if (editTarget) {
      await updateTripStatus(editTarget, form.status.toLowerCase()).catch(() => {});
      setTrips((prev) =>
        prev.map((t) => (t.id === editTarget ? { ...t, ...form } : t)),
      );
    } else {
      await createTrip({
        start_time: `${form.date}T${form.time}:00`,
        status: form.status.toLowerCase(),
      }).catch(() => {});
      const newId = `TRP-${String(Date.now()).slice(-3)}`;
      setTrips((prev) => [{ id: newId, ...form, seats: "0/30" }, ...prev]);
    }
    setModalOpen(false);
  }

  const stats = {
    all: trips.length,
    ongoing: trips.filter((t) => t.status === "Ongoing").length,
    delayed: trips.filter((t) => t.status === "Delayed").length,
    completed: trips.filter((t) => t.status === "Completed").length,
  };

  const columns = [
    {
      key: "id",
      label: "Trip ID",
      render: (v) => (
        <span
          style={{
            fontFamily: "monospace",
            fontWeight: 600,
            color: "#2563EB",
            fontSize: 12,
          }}
        >
          {v}
        </span>
      ),
    },
    { key: "route", label: "Route" },
    { key: "driver", label: "Driver" },
    { key: "vehicle", label: "Vehicle" },
    { key: "time", label: "Time" },
    { key: "seats", label: "Seats" },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusPill status={v} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (_, row) => (
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
            Trips
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Manage and monitor all trips
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
          + Create trip
        </button>
      </div>

      {/* Mini stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total trips"
          value={stats.all}
          delta="today"
          up={null}
        />
        <StatCard
          label="Ongoing"
          value={stats.ongoing}
          delta="in progress"
          up={null}
        />
        <StatCard
          label="Delayed"
          value={stats.delayed}
          delta="need attention"
          up={stats.delayed === 0}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          delta="today"
          up={true}
        />
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8 }}>
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              cursor: "pointer",
              border: filter === s ? "none" : "1px solid #E2E8F0",
              background: filter === s ? "#2563EB" : "#fff",
              color: filter === s ? "#fff" : "#64748B",
              fontWeight: filter === s ? 600 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <Panel title={`${filtered.length} trips`}>
        <DataTable columns={columns} rows={filtered} onRowClick={openEdit} />
      </Panel>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal
          title={editTarget ? "Edit trip" : "Create new trip"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        >
          {[
            { label: "Route", key: "route", placeholder: "e.g. Route 12A" },
            { label: "Driver", key: "driver", placeholder: "e.g. Karim Moussa" },
            { label: "Vehicle", key: "vehicle", placeholder: "e.g. BUS-01" },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {f.label}
              </label>
              <input
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
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
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }}
            >
              {STATUSES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {[
              { label: "Date", key: "date", type: "date" },
              { label: "Time", key: "time", type: "time" },
            ].map((f) => (
              <div key={f.key}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
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
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
