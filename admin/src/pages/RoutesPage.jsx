// pages/RoutesPage.jsx
import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { getRoutes, createRoute, updateRoute, getRouteStops } from "../api/endpoints";
import apiClient from "../api/apiClient";

function normalizeRoute(r) {
  return {
    id: r.route_id ?? r.id,
    code: r.route_name ?? r.code ?? "",
    name: r.start_location && r.end_location
      ? `${r.start_location} → ${r.end_location}`
      : (r.name ?? ""),
    distance: r.distance ?? "",
    duration: r.duration ?? "",
    active: r.active !== undefined ? r.active : true,
    stops: r.stops ?? [],
  };
}

const EMPTY_ROUTE = {
  code: "",
  name: "",
  distance: "",
  duration: "",
  active: true,
};
const EMPTY_STOP = { name: "" };

export default function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getRoutes()
      .then((data) => setRoutes((data || []).map(normalizeRoute)))
      .catch(() => {});
  }, []);
  const [routeModal, setRouteModal] = useState(false);
  const [stopModal, setStopModal] = useState(null); // route id
  const [editRoute, setEditRoute] = useState(null);
  const [routeForm, setRouteForm] = useState(EMPTY_ROUTE);
  const [stopForm, setStopForm] = useState(EMPTY_STOP);
  const [deleteRoute, setDeleteRoute] = useState(null);

  function openAddRoute() {
    setEditRoute(null);
    setRouteForm(EMPTY_ROUTE);
    setRouteModal(true);
  }
  function openEditRoute(r) {
    setEditRoute(r.id);
    setRouteForm({
      code: r.code,
      name: r.name,
      distance: r.distance,
      duration: r.duration,
      active: r.active,
    });
    setRouteModal(true);
  }

  async function saveRoute() {
    if (!routeForm.code || !routeForm.name) return;
    const [start, end] = routeForm.name.split("→").map((s) => s.trim());
    if (editRoute) {
      await updateRoute(editRoute, {
        route_name: routeForm.code,
        start_location: start || routeForm.name,
        end_location: end || "",
      }).catch(() => {});
      setRoutes((prev) =>
        prev.map((r) => (r.id === editRoute ? { ...r, ...routeForm } : r)),
      );
    } else {
      await createRoute({
        route_name: routeForm.code,
        start_location: start || routeForm.name,
        end_location: end || "",
      }).catch(() => {});
      setRoutes((prev) => [
        ...prev,
        { id: Date.now(), ...routeForm, stops: [] },
      ]);
    }
    setRouteModal(false);
  }

  function saveStop(routeId) {
    if (!stopForm.name) return;
    setRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        const newStop = {
          id: Date.now(),
          name: stopForm.name,
          order: r.stops.length + 1,
        };
        return { ...r, stops: [...r.stops, newStop] };
      }),
    );
    setStopModal(null);
    setStopForm(EMPTY_STOP);
  }

  function deleteStop(routeId, stopId) {
    setRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        const filtered = r.stops
          .filter((s) => s.id !== stopId)
          .map((s, i) => ({ ...s, order: i + 1 }));
        return { ...r, stops: filtered };
      }),
    );
  }

  function toggleActive(id) {
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
  }

  const counts = {
    total: routes.length,
    active: routes.filter((r) => r.active).length,
    stops: routes.reduce((a, r) => a + r.stops.length, 0),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}
          >
            Routes & stops
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Define and manage transportation routes
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={openAddRoute}
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
          + Add route
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total routes"
          value={counts.total}
          delta="defined"
          up={null}
        />
        <StatCard
          label="Active routes"
          value={counts.active}
          delta="in service"
          up={true}
        />
        <StatCard
          label="Total stops"
          value={counts.stops}
          delta="across all routes"
          up={null}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {routes.map((route) => (
          <div
            key={route.id}
            style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Route header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 18px",
                gap: 12,
                cursor: "pointer",
              }}
              onClick={() =>
                setExpanded(expanded === route.id ? null : route.id)
              }
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: route.active ? "#EFF6FF" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke={route.active ? "#2563EB" : "#aaa"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="4" cy="14" r="2" />
                  <circle cx="14" cy="14" r="2" />
                  <path d="M2 7h14l-2-5H4L2 7z" />
                  <path d="M2 7v5a2 2 0 002 2" />
                  <path d="M16 7v5a2 2 0 01-2 2" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}
                  >
                    {route.code}
                  </span>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {route.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      background: route.active ? "#ECFDF5" : "#F1F5F9",
                      color: route.active ? "#059669" : "#64748B",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontWeight: 600,
                    }}
                  >
                    {route.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {route.distance} · {route.duration} · {route.stops.length}{" "}
                  stops
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditRoute(route);
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
                    toggleActive(route.id);
                  }}
                  style={{
                    fontSize: 11,
                    color: route.active ? "#B91C1C" : "#059669",
                    background: route.active ? "#FEF2F2" : "#ECFDF5",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                >
                  {route.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteRoute(route.id);
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
              <span style={{ color: "#bbb", fontSize: 16, marginLeft: 4 }}>
                {expanded === route.id ? "▲" : "▼"}
              </span>
            </div>

            {/* Stops list (expanded) */}
            {expanded === route.id && (
              <div
                style={{
                  borderTop: "1px solid #F1F5F9",
                  padding: "12px 18px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
                  >
                    Stops ({route.stops.length})
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => {
                      setStopModal(route.id);
                      setStopForm(EMPTY_STOP);
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
                    + Add stop
                  </button>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {route.stops.map((stop) => (
                    <div
                      key={stop.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        background: "#F8FAFC",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#2563EB",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {stop.order}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "#333" }}>
                        {stop.name}
                      </span>
                      <button
                        onClick={() => deleteStop(route.id, stop.id)}
                        style={{
                          fontSize: 10,
                          color: "#B91C1C",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ))}
                  {route.stops.length === 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#bbb",
                        textAlign: "center",
                        padding: "8px 0",
                      }}
                    >
                      No stops yet. Add one above.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Route Modal */}
      {routeModal && (
        <Modal
          title={editRoute ? "Edit route" : "Add new route"}
          onClose={() => setRouteModal(false)}
          onSave={saveRoute}
        >
          {[
            { label: "Route code", key: "code", placeholder: "e.g. Route 14F" },
            {
              label: "Route name",
              key: "name",
              placeholder: "e.g. Airport → Downtown",
            },
            { label: "Distance", key: "distance", placeholder: "e.g. 15 km" },
            {
              label: "Est. duration",
              key: "duration",
              placeholder: "e.g. 30 min",
            },
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
                value={routeForm[f.key]}
                onChange={(e) =>
                  setRouteForm((p) => ({ ...p, [f.key]: e.target.value }))
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
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={routeForm.active}
              onChange={(e) =>
                setRouteForm((p) => ({ ...p, active: e.target.checked }))
              }
            />
            Active route
          </label>
        </Modal>
      )}

      {/* Add Stop Modal */}
      {stopModal && (
        <Modal
          title="Add stop"
          onClose={() => setStopModal(null)}
          onSave={() => saveStop(stopModal)}
        >
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
              Stop name
            </label>
            <input
              placeholder="e.g. Hamra Street"
              value={stopForm.name}
              onChange={(e) => setStopForm({ name: e.target.value })}
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
        </Modal>
      )}

      {/* Delete Route Modal */}
      {deleteRoute && (
        <Modal title="Delete route" onClose={() => setDeleteRoute(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>
            Delete this route and all its stops? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDeleteRoute(null)}
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
              onClick={() => {
                setRoutes((p) => p.filter((r) => r.id !== deleteRoute));
                setDeleteRoute(null);
              }}
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
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
