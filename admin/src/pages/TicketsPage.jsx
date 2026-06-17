// pages/TicketsPage.jsx
import { useState, useEffect } from "react";
import { ExportBtn } from "../components/ExportBtn";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { getTickets } from "../api/endpoints";
import apiClient from "../api/apiClient";
import { useSettings } from "../context/SettingsContext";
import { fmtMoney } from "../utils/fmt";

function normalizeTicket(t) {
  const dt = t.booking_time || t.created_at
    ? new Date(t.booking_time || t.created_at) : null;
  return {
    id: t.ticket_id ? `TKT-${String(t.ticket_id).padStart(3, "0")}` : (t.id ?? ""),
    passenger: t.full_name ?? t.passenger ?? `User #${t.user_id ?? ""}`,
    trip: t.trip_id ? `TRP-${t.trip_id}` : (t.trip ?? ""),
    route: t.route_name ?? t.route ?? "",
    seat: t.seat_number ?? t.seat ?? "",
    date: dt ? dt.toISOString().split("T")[0] : (t.date ?? ""),
    time: dt ? dt.toTimeString().slice(0, 5) : (t.time ?? ""),
    amount: parseFloat(t.amount ?? t.amount_display ?? 0) || 0,
    status: t.status
      ? t.status.charAt(0).toUpperCase() + t.status.slice(1)
      : "Confirmed",
    _raw_id: t.ticket_id ?? t.id,
  };
}

const TICKET_STATUS_STYLE = {
  Confirmed: { bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
  Cancelled: { bg: "#FEF2F2", color: "#B91C1C", dot: "#EF4444" },
  Used: { bg: "#F5F3FF", color: "#6D28D9", dot: "#3B82F6" },
  Pending: { bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
};


export default function TicketsPage() {
  const { currency, exchangeRate } = useSettings();
  const [tickets,      setTickets]      = useState([]);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [routeFilter,  setRouteFilter]  = useState("All");
  const [cancelError,  setCancelError]  = useState(null);

  const load = () => {
    getTickets()
      .then((data) => setTickets((data || []).map(normalizeTicket)))
      .catch(() => setTickets([]));
  };

  useEffect(() => { load(); }, []);

  const routes = ["All", ...new Set(tickets.map((t) => t.route).filter(Boolean))];
  const statuses = ["All", "Confirmed", "Used", "Cancelled", "Pending"];

  const filtered = tickets.filter((t) => {
    const matchSearch =
      t.passenger.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.trip.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    const matchRoute = routeFilter === "All" || t.route === routeFilter;
    return matchSearch && matchStatus && matchRoute;
  });

  async function cancelTicket(id, rawId) {
    setCancelError(null);
    try {
      await apiClient.delete(`/bookings/${rawId}`);
      // Reload from DB so UI always reflects the real state
      load();
    } catch (err) {
      setCancelError(err?.message ?? "Failed to cancel ticket");
    }
  }

  const counts = {
    total: tickets.length,
    confirmed: tickets.filter((t) => t.status === "Confirmed").length,
    used: tickets.filter((t) => t.status === "Used").length,
    cancelled: tickets.filter((t) => t.status === "Cancelled").length,
    revenue: tickets
      .filter((t) => t.status !== "Cancelled")
      .reduce((s, t) => s + (t.amount || 0), 0),
  };

  const columns = [
    {
      key: "id",
      label: "Ticket ID",
      render: (v) => (
        <span
          style={{
            fontFamily: "monospace",
            fontWeight: 600,
            color: "#6D28D9",
            fontSize: 12,
          }}
        >
          {v}
        </span>
      ),
    },
    { key: "passenger", label: "Passenger" },
    {
      key: "trip",
      label: "Trip",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{row.route}</div>
        </div>
      ),
    },
    { key: "seat", label: "Seat" },
    { key: "time", label: "Time" },
    {
      key: "amount",
      label: "Fare",
      render: (v) => <span style={{ fontWeight: 600 }}>{fmtMoney(v, currency, exchangeRate)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (v) => {
        const s = TICKET_STATUS_STYLE[v] || {};
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
      label: "Action",
      render: (_, row) =>
        row.status === "Confirmed" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm(`Cancel ticket ${row.id} for ${row.passenger}? This cannot be undone.`)) return;
              cancelTicket(row.id, row._raw_id);
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
            Cancel
          </button>
        ) : (
          <span style={{ color: "#ccc", fontSize: 11 }}>—</span>
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>
            Tickets
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            All bookings and reservations
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <ExportBtn
          rows={filtered}
          columns={[
            { key: "id",        label: "Ticket ID"  },
            { key: "passenger", label: "Passenger"  },
            { key: "trip",      label: "Trip"       },
            { key: "route",     label: "Route"      },
            { key: "seat",      label: "Seat"       },
            { key: "date",      label: "Date"       },
            { key: "time",      label: "Time"       },
            { key: "amount",    label: "Fare"       },
            { key: "status",    label: "Status"     },
          ]}
          filename={`tickets-${new Date().toISOString().slice(0,10)}.csv`}
          title="Tickets Report"
        />
      </div>

      {cancelError && (
        <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>
          {cancelError}
          <button onClick={() => setCancelError(null)} style={{ marginLeft: 12, fontSize: 11, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total tickets"
          value={counts.total}
          delta="today"
          up={null}
        />
        <StatCard
          label="Confirmed"
          value={counts.confirmed}
          delta="active"
          up={true}
        />
        <StatCard
          label="Cancelled"
          value={counts.cancelled}
          delta="refunded"
          up={counts.cancelled === 0}
        />
        <StatCard
          label="Fare collected"
          value={fmtMoney(counts.revenue, currency, exchangeRate)}
          delta="total revenue"
          up={true}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          placeholder="Search passenger, ticket or trip..."
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
          }}
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
          }}
        >
          {routes.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      <Panel title={`${filtered.length} tickets`}>
        <DataTable columns={columns} rows={filtered} />
        {filtered.length === 0 && (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              color: "#bbb",
              fontSize: 13,
            }}
          >
            No tickets match your filters.
          </div>
        )}
      </Panel>
    </div>
  );
}


