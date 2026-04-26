// pages/VehiclesPage.jsx
import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { getVehicles, createVehicle, updateVehicle } from "../api/endpoints";
import { MOCK_VEHICLES } from "../data/mockData";

function normalizeVehicle(v) {
  return {
    id: v.vehicle_id ?? v.id,
    plate: v.plate_number ?? v.plate ?? "",
    model: v.model ?? "",
    year: v.year ?? "",
    capacity: v.capacity ?? 0,
    status: v.status ?? "Active",
    driver: v.driver ?? "—",
    lastService: v.last_service ?? v.lastService ?? "—",
    km: v.km ?? 0,
  };
}

// Available drivers that can be assigned to a vehicle
const AVAILABLE_DRIVERS = [
  "Karim Moussa",
  "Lara Abi Nader",
  "Joe Pharaon",
  "Maya Salameh",
  "Rami Khoury",
  "Sara Khoury",
  "Fadi Gemayel",
];

const VEHICLE_STATUSES = ["Active", "Maintenance", "Inactive"];
const VEHICLE_STATUS_STYLE = {
  Active: { bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
  Maintenance: { bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
  Inactive: { bg: "#F1F5F9", color: "#64748B", dot: "#94A3B8" },
};


const EMPTY_FORM = {
  plate: "",
  model: "",
  year: new Date().getFullYear(),
  capacity: 30,
  status: "Active",
  driver: "—",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    getVehicles()
      .then((data) => setVehicles((data || []).map(normalizeVehicle)))
      .catch(() => setVehicles(MOCK_VEHICLES));
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);

  const filtered =
    filter === "All" ? vehicles : vehicles.filter((v) => v.status === filter);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(v) {
    setEditTarget(v.id);
    setForm({
      plate: v.plate,
      model: v.model,
      year: v.year,
      capacity: v.capacity,
      status: v.status,
      driver: v.driver,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.plate || !form.model) return;
    if (editTarget) {
      await updateVehicle(editTarget, {
        plate_number: form.plate,
        model: form.model,
        vehicle_type: "bus",
        capacity: Number(form.capacity),
        status: form.status,
      }).catch(() => {});
      setVehicles((prev) =>
        prev.map((v) => (v.id === editTarget ? { ...v, ...form } : v)),
      );
    } else {
      await createVehicle({
        plate_number: form.plate,
        model: form.model,
        vehicle_type: "bus",
        capacity: Number(form.capacity),
        status: form.status,
      }).catch(() => {});
      setVehicles((prev) => [
        ...prev,
        { id: Date.now(), ...form, lastService: "—", km: 0 },
      ]);
    }
    setModalOpen(false);
  }

  function handleDelete() {
    setVehicles((prev) => prev.filter((v) => v.id !== deleteId));
    setDeleteId(null);
  }

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "Active").length,
    maintenance: vehicles.filter((v) => v.status === "Maintenance").length,
    inactive: vehicles.filter((v) => v.status === "Inactive").length,
  };

  const columns = [
    {
      key: "plate",
      label: "Vehicle",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#2563EB" }}>{v}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            {row.model} · {row.year}
          </div>
        </div>
      ),
    },
    { key: "capacity", label: "Capacity", render: (v) => `${v} seats` },
    { key: "driver", label: "Assigned driver" },
    {
      key: "km",
      label: "Odometer",
      render: (v) => (v ? `${v.toLocaleString()} km` : "—"),
    },
    { key: "lastService", label: "Last service" },
    {
      key: "status",
      label: "Status",
      render: (v) => {
        const s = VEHICLE_STATUS_STYLE[v] || {};
        return (
          <span
            style={{
              background: s.bg,
              color: s.color,
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: s.dot,
                display: "inline-block",
              }}
            />
            {v}
          </span>
        );
      },
    },
    {
      key: "id",
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
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}
          >
            Vehicles
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Fleet management and maintenance tracking
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
          + Add vehicle
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total fleet"
          value={counts.total}
          delta="vehicles"
          up={null}
        />
        <StatCard
          label="Active"
          value={counts.active}
          delta="in service"
          up={true}
        />
        <StatCard
          label="Maintenance"
          value={counts.maintenance}
          delta="need attention"
          up={counts.maintenance === 0}
        />
        <StatCard
          label="Inactive"
          value={counts.inactive}
          delta="offline"
          up={null}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {["All", ...VEHICLE_STATUSES].map((s) => (
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

      <Panel title={`${filtered.length} vehicles`}>
        <DataTable columns={columns} rows={filtered} onRowClick={openEdit} />
      </Panel>

      {modalOpen && (
        <Modal
          title={editTarget ? "Edit vehicle" : "Add new vehicle"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            {[
              { label: "Plate / ID", key: "plate", placeholder: "e.g. BUS-13" },
              {
                label: "Model",
                key: "model",
                placeholder: "e.g. Mercedes Sprinter",
              },
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
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            {[
              { label: "Year", key: "year", type: "number" },
              { label: "Capacity (seats)", key: "capacity", type: "number" },
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
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                display: "block",
                marginBottom: 5,
              }}
            >
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                display: "block",
                marginBottom: 5,
              }}
            >
              Assigned driver
            </label>
            <select
              value={form.driver}
              onChange={(e) =>
                setForm((p) => ({ ...p, driver: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 13,
                color: form.driver === "—" ? "#aaa" : "#111",
              }}
            >
              <option value="—">— No driver assigned —</option>
              {AVAILABLE_DRIVERS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Remove vehicle" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>
            Remove this vehicle from the fleet? This cannot be undone.
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
                background: "#EF4444",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
