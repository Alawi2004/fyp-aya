import { useState, useEffect, useCallback } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { StatCard } from "../components/StatCard";
import { getAllTaxiReservations } from "../api/endpoints";

const STATUS_CFG = {
  pending:    { label: "Pending",    color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  accepted:   { label: "Accepted",   color: "#4C1D95", bg: "#F5F3FF", border: "#C4B5FD" },
  on_the_way: { label: "On the Way", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  arrived:    { label: "Arrived",    color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  completed:  { label: "Completed",  color: "#059669", bg: "#f0fdf4", border: "#86efac" },
  cancelled:  { label: "Cancelled",  color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                   background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

const fmtMoney = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const fmtTime  = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const FILTERS = ["all", "pending", "accepted", "on_the_way", "completed", "cancelled"];

export default function TaxiReservationsPage() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("all");

  const load = useCallback(() => {
    getAllTaxiReservations(filter === "all" ? undefined : filter)
      .then((res) => { setRows(res?.data ?? res ?? []); setError(null); })
      .catch((err) => setError(err?.message ?? "Could not reach server"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15_000);   // keep the list fresh
    return () => clearInterval(t);
  }, [load]);

  const counts = {
    total:     rows.length,
    pending:   rows.filter((r) => r.status === "pending").length,
    active:    rows.filter((r) => ["accepted", "on_the_way", "arrived"].includes(r.status)).length,
    completed: rows.filter((r) => r.status === "completed").length,
  };

  const columns = [
    { key: "reservation_id", label: "ID", render: (v) => <span style={{ fontWeight: 700, color: "#6D28D9" }}>#{v}</span> },
    {
      key: "passenger_name", label: "Passenger",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>{v || "—"}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{row.passenger_phone || ""}</div>
        </div>
      ),
    },
    {
      key: "pickup_address", label: "Route",
      render: (v, row) => (
        <div style={{ fontSize: 12, maxWidth: 260 }}>
          <div style={{ color: "#059669", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>● {v}</div>
          <div style={{ color: "#dc2626", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>◉ {row.dest_address}</div>
        </div>
      ),
    },
    { key: "vehicle_type", label: "Vehicle", render: (v) => <span style={{ textTransform: "capitalize" }}>{v || "—"}</span> },
    { key: "estimated_fare", label: "Fare", render: (v) => <span style={{ fontWeight: 700, color: "#059669" }}>{fmtMoney(v)}</span> },
    {
      key: "driver_name", label: "Driver",
      render: (v) => v
        ? <span style={{ color: "#0F172A" }}>{v}</span>
        : <span style={{ color: "#d97706", fontSize: 12, fontWeight: 600 }}>Unassigned</span>,
    },
    { key: "scheduled_for", label: "When", render: (v) => <span style={{ fontSize: 12, color: "#475569" }}>{v || "Now"}</span> },
    { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
    { key: "created_at", label: "Booked", render: (v) => <span style={{ fontSize: 11, color: "#94A3B8" }}>{fmtTime(v)}</span> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Taxi Reservations</h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
          Live passenger taxi bookings across the fleet.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="Total Reservations" value={counts.total}     accent="#6D28D9" />
        <StatCard label="Pending"            value={counts.pending}   accent="#D97706" />
        <StatCard label="In Progress"        value={counts.active}    accent="#2563EB" />
        <StatCard label="Completed"          value={counts.completed} accent="#10B981" />
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            textTransform: "capitalize",
            border: `2px solid ${filter === f ? "#6D28D9" : "#e5e7eb"}`,
            background: filter === f ? "#F5F3FF" : "#fff",
            color: filter === f ? "#6D28D9" : "#374151",
          }}>
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Panel title="Reservations">
        {error ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <DataTable columns={columns} rows={rows} />
            {rows.length === 0 && (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>
                No taxi reservations{filter !== "all" ? ` with status "${filter.replace(/_/g, " ")}"` : ""} yet.
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
