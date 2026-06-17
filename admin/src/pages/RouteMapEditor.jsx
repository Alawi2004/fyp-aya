import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../api/apiClient";
import { getRouteStops, updateRouteStopOrder, removeStopFromRoute } from "../api/endpoints";

// ── Custom div-icons ───────────────────────────────────────────────────────────

const makeStopIcon = (order, isFirst, isLast) => {
  const color = isFirst ? '#10B981' : isLast ? '#EF4444' : '#6D28D9';
  const size  = (isFirst || isLast) ? 22 : 18;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#fff;border:2.5px solid ${color};
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:800;color:${color};
      font-family:Inter,system-ui,sans-serif;
    ">${order}</div>`,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const waypointIcon = L.divIcon({
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#64748B;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.25);
  "></div>`,
  className: "",
  iconSize:   [12, 12],
  iconAnchor: [6, 6],
});

// ── Map click handler ──────────────────────────────────────────────────────────

// mode: "waypoint" | "stop" | null
function MapClickHandler({ mode, onWaypointClick, onStopClick }) {
  useMapEvents({
    click(e) {
      if (mode === "waypoint") onWaypointClick(e.latlng.lat, e.latlng.lng);
      else if (mode === "stop") onStopClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Default positions spread across Beirut ────────────────────────────────────

function defaultPos(index, total) {
  const s = { lat: 33.892, lng: 35.503 };
  const e = { lat: 33.854, lng: 35.538 };
  const t = total > 1 ? index / (total - 1) : 0.5;
  return { lat: s.lat + t * (e.lat - s.lat), lng: s.lng + t * (e.lng - s.lng) };
}

// ══════════════════════════════════════════════════════════════════════════════
//  RouteMapEditor
// ══════════════════════════════════════════════════════════════════════════════

export default function RouteMapEditor({ route, onClose, onSaved }) {
  const [stops,      setStops]      = useState([]);
  const [waypoints,  setWaypoints]  = useState([]);
  const [mode,       setMode]       = useState(null); // "waypoint" | "stop" | null
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);

  // Pending stop: set when user clicks the map in "stop" mode
  const [pendingPos,  setPendingPos]  = useState(null); // { lat, lng }
  const [pendingName, setPendingName] = useState("");
  const [addingStop,  setAddingStop]  = useState(false);
  const nameInputRef = useRef(null);

  // Load stops + waypoints fresh from the API
  useEffect(() => {
    getRouteStops(route.id)
      .then(data => {
        const raw = data || [];
        setStops(raw.map((s, i) => ({
          id:    s.stop_id ?? i,
          name:  s.stop_name ?? s.name ?? `Stop ${i + 1}`,
          lat:   parseFloat(s.latitude  ?? s.lat)  || defaultPos(i, raw.length).lat,
          lng:   parseFloat(s.longitude ?? s.lng)  || defaultPos(i, raw.length).lng,
          order: s.stop_order ?? s.order ?? i,
        })).sort((a, b) => a.order - b.order));
      })
      .catch(() => {
        const raw = route.stops ?? [];
        setStops(raw.map((s, i) => ({
          id:    s.id ?? s.stop_id ?? i,
          name:  s.name ?? s.stop_name ?? `Stop ${i + 1}`,
          lat:   parseFloat(s.latitude  ?? s.lat)  || defaultPos(i, raw.length).lat,
          lng:   parseFloat(s.longitude ?? s.lng)  || defaultPos(i, raw.length).lng,
          order: s.order ?? s.stop_order ?? i,
        })).sort((a, b) => a.order - b.order));
      });

    apiClient.get(`/routes/${route.id}/waypoints`)
      .then(data => setWaypoints((data || []).map(w => ({
        lat: parseFloat(w.latitude),
        lng: parseFloat(w.longitude),
      }))))
      .catch(() => setWaypoints([]));
  }, [route.id]);

  // Auto-focus the name input when a pending stop position is set
  useEffect(() => {
    if (pendingPos) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [pendingPos]);

  const center = stops.length
    ? [stops.reduce((s, p) => s + p.lat, 0) / stops.length,
       stops.reduce((s, p) => s + p.lng, 0) / stops.length]
    : [33.888, 35.495];

  const moveStop     = useCallback((id, lat, lng) =>
    setStops(prev => prev.map(s => s.id === id ? { ...s, lat, lng } : s)), []);
  const addWaypoint  = useCallback((lat, lng) =>
    setWaypoints(prev => [...prev, { lat, lng }]), []);
  const moveWaypoint = useCallback((i, lat, lng) =>
    setWaypoints(prev => prev.map((w, idx) => idx === i ? { lat, lng } : w)), []);
  const deleteWaypoint = useCallback((i) =>
    setWaypoints(prev => prev.filter((_, idx) => idx !== i)), []);

  // Remove a stop from the route and re-number the rest
  async function removeStop(stopId) {
    try {
      await removeStopFromRoute(route.id, stopId);
      setStops(prev => {
        const renumbered = prev
          .filter(s => s.id !== stopId)
          .map((s, i) => ({ ...s, order: i + 1 }));
        // Update orders in DB for any stop that shifted
        prev.filter(s => s.id !== stopId).forEach((s, i) => {
          if (s.order !== i + 1) updateRouteStopOrder(route.id, s.id, i + 1).catch(() => {});
        });
        return renumbered;
      });
      showToast("Stop removed");
    } catch (e) {
      showToast("Failed to remove stop: " + e.message);
    }
  }

  // Swap a stop with its neighbour (direction: -1 = up, +1 = down)
  async function shiftStop(index, direction) {
    const other = index + direction;
    if (other < 0 || other >= stops.length) return;
    const a = stops[index];
    const b = stops[other];
    // Swap orders optimistically
    setStops(prev =>
      prev.map(s => {
        if (s.id === a.id) return { ...s, order: b.order };
        if (s.id === b.id) return { ...s, order: a.order };
        return s;
      }).sort((x, y) => x.order - y.order)
    );
    // Persist both orders
    await Promise.all([
      updateRouteStopOrder(route.id, a.id, b.order),
      updateRouteStopOrder(route.id, b.id, a.order),
    ]).catch(e => showToast("Reorder failed: " + e.message));
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Called when user clicks the map in "stop" mode
  function handleStopClick(lat, lng) {
    setPendingPos({ lat, lng });
    setPendingName("");
  }

  // Confirm the pending stop: create in DB, assign to route, update local state.
  // When 2+ stops already exist the new stop is inserted before the terminal (last stop).
  async function confirmAddStop() {
    if (!pendingName.trim() || addingStop) return;
    setAddingStop(true);
    try {
      const terminal     = stops.length >= 2 ? stops[stops.length - 1] : null;
      const insertOrder  = terminal ? terminal.order : stops.length + 1;

      const res = await apiClient.post("/stops", {
        stop_name: pendingName.trim(),
        latitude:  pendingPos.lat,
        longitude: pendingPos.lng,
      });
      await apiClient.post(`/routes/${route.id}/stops`, {
        stop_id:    res.stop_id,
        stop_order: insertOrder,
      });

      // Bump the terminal so it stays last
      if (terminal) {
        await updateRouteStopOrder(route.id, terminal.id, terminal.order + 1);
      }

      setStops(prev => {
        const updated = terminal
          ? prev.map(s => s.id === terminal.id ? { ...s, order: s.order + 1 } : s)
          : prev;
        return [...updated, {
          id:    res.stop_id,
          name:  pendingName.trim(),
          lat:   pendingPos.lat,
          lng:   pendingPos.lng,
          order: insertOrder,
        }].sort((a, b) => a.order - b.order);
      });

      setPendingPos(null);
      setPendingName("");
      showToast("Stop added");
    } catch (e) {
      showToast("Failed to add stop: " + e.message);
    } finally {
      setAddingStop(false);
    }
  }

  // Save stop positions + waypoints
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const stop of stops) {
        apiClient.put(`/routes/stops/${stop.id}/position`, { latitude: stop.lat, longitude: stop.lng }).catch(() => {});
      }
      await apiClient.post(`/routes/${route.id}/waypoints`, { waypoints });
      showToast("Saved!");
      setTimeout(() => { onSaved?.(); onClose(); }, 900);
    } catch (e) {
      showToast("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  function toggleMode(m) {
    setMode(prev => prev === m ? null : m);
    setPendingPos(null);
  }

  const stopLine = stops.map(s => [s.lat, s.lng]);

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column",
      background: "#fff", fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          background: "#1E293B", color: "#fff", borderRadius: 8,
          padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 10000,
          boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        }}>{toast}</div>
      )}

      {/* Toolbar */}
      <div style={{
        height: 56, background: "#fff", borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 10, flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 22, lineHeight: 1, padding: "0 8px 0 0" }}>←</button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
            Map Editor — {route.code} <span style={{ color: "#64748B", fontWeight: 400 }}>{route.name}</span>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            Drag stop markers to reposition · Right-click waypoints to delete
          </div>
        </div>

        {/* Add Stop mode */}
        <button onClick={() => toggleMode("stop")} style={{
          padding: "7px 14px", borderRadius: 8,
          border: `1.5px solid ${mode === "stop" ? "#10B981" : "#E2E8F0"}`,
          background: mode === "stop" ? "#ECFDF5" : "#fff",
          color: mode === "stop" ? "#059669" : "#374151",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          {mode === "stop" ? "✓ Click to place stop" : "+ Add Stop"}
        </button>

        {/* Add Waypoint mode */}
        <button onClick={() => toggleMode("waypoint")} style={{
          padding: "7px 14px", borderRadius: 8,
          border: `1.5px solid ${mode === "waypoint" ? "#6D28D9" : "#E2E8F0"}`,
          background: mode === "waypoint" ? "#F5F3FF" : "#fff",
          color: mode === "waypoint" ? "#6D28D9" : "#374151",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          {mode === "waypoint" ? "✓ Click to add waypoint" : "+ Add Waypoint"}
        </button>

        {waypoints.length > 0 && (
          <button onClick={() => setWaypoints([])} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Clear waypoints ({waypoints.length})
          </button>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: saving ? "#C4B5FD" : "#6D28D9",
          color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
        }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Map */}
        <div style={{ flex: 1, position: "relative", height: "calc(100vh - 56px)" }}>

          {/* Mode hint banner */}
          {mode && !pendingPos && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              background: mode === "stop" ? "#059669" : "#6D28D9", color: "#fff", borderRadius: 20,
              padding: "5px 16px", fontSize: 12, fontWeight: 600, zIndex: 1000,
              pointerEvents: "none",
            }}>
              {mode === "stop" ? "Click the map to place a new stop" : "Click anywhere to add a waypoint"}
            </div>
          )}

          {/* Pending stop name form */}
          {pendingPos && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2000, background: "#fff", borderRadius: 12,
              padding: "20px 22px", boxShadow: "0 8px 32px rgba(0,0,0,.22)",
              minWidth: 280, border: "1px solid #E2E8F0",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Name this stop</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>
                {pendingPos.lat.toFixed(5)}, {pendingPos.lng.toFixed(5)}
              </div>
              <input
                ref={nameInputRef}
                placeholder="e.g. Hamra Street"
                value={pendingName}
                onChange={e => setPendingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") confirmAddStop();
                  if (e.key === "Escape") { setPendingPos(null); setPendingName(""); }
                }}
                style={{
                  width: "100%", padding: "9px 12px",
                  border: "1px solid #E2E8F0", borderRadius: 8,
                  fontSize: 13, boxSizing: "border-box", marginBottom: 14, outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setPendingPos(null); setPendingName(""); }}
                  style={{ flex: 1, padding: "8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddStop}
                  disabled={!pendingName.trim() || addingStop}
                  style={{
                    flex: 1, padding: "8px", borderRadius: 7, border: "none",
                    background: !pendingName.trim() || addingStop ? "#C4B5FD" : "#059669",
                    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {addingStop ? "Adding…" : "Add Stop"}
                </button>
              </div>
            </div>
          )}

          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            attributionControl={false}
          >
            <TileLayer
              url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              subdomains="0123"
              maxZoom={20}
            />
            <MapClickHandler
              mode={pendingPos ? null : mode}
              onWaypointClick={addWaypoint}
              onStopClick={handleStopClick}
            />

            {/* Route polyline */}
            {stopLine.length > 1 && (
              <>
                <Polyline positions={stopLine} color="#C4B5FD" weight={7} opacity={0.35} />
                <Polyline positions={stopLine} color="#6D28D9" weight={4} opacity={0.9} dashArray="12 6" />
              </>
            )}

            {/* Stop markers — draggable */}
            {stops.map((stop, i) => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lng]}
                draggable
                icon={makeStopIcon(i + 1, i === 0, i === stops.length - 1)}
                eventHandlers={{
                  dragend(e) {
                    const { lat, lng } = e.target.getLatLng();
                    moveStop(stop.id, lat, lng);
                  },
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -16]}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{stop.name}</span>
                </Tooltip>
              </Marker>
            ))}

            {/* Waypoint markers */}
            {waypoints.map((wp, i) => (
              <Marker
                key={i}
                position={[wp.lat, wp.lng]}
                draggable
                icon={waypointIcon}
                eventHandlers={{
                  dragend(e) {
                    const { lat, lng } = e.target.getLatLng();
                    moveWaypoint(i, lat, lng);
                  },
                  contextmenu() { deleteWaypoint(i); },
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span style={{ fontSize: 10 }}>Waypoint {i + 1} · right-click to delete</span>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div style={{ width: 260, borderLeft: "1px solid #E2E8F0", background: "#F8FAFC", overflowY: "auto", flexShrink: 0 }}>

          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              Stops ({stops.length})
            </div>
            {stops.length === 0
              ? <p style={{ fontSize: 11, color: "#94A3B8" }}>None yet. Click "+ Add Stop" then click the map.</p>
              : stops.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 6px", borderRadius: 7, marginBottom: 3, background: "#fff", border: "1px solid #E2E8F0" }}>
                  {/* Colour dot */}
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: i === 0 ? "#10B981" : i === stops.length - 1 ? "#EF4444" : "#6D28D9",
                    color: "#fff", fontSize: 9, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</div>

                  {/* Name */}
                  <span style={{ fontSize: 11, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>

                  {/* Reorder up */}
                  <button
                    onClick={() => shiftStop(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                    style={{
                      background: "none", border: "none", cursor: i === 0 ? "default" : "pointer",
                      color: i === 0 ? "#CBD5E1" : "#64748B", fontSize: 12, lineHeight: 1, padding: "2px 3px",
                    }}
                  >▲</button>

                  {/* Reorder down */}
                  <button
                    onClick={() => shiftStop(i, 1)}
                    disabled={i === stops.length - 1}
                    title="Move down"
                    style={{
                      background: "none", border: "none", cursor: i === stops.length - 1 ? "default" : "pointer",
                      color: i === stops.length - 1 ? "#CBD5E1" : "#64748B", fontSize: 12, lineHeight: 1, padding: "2px 3px",
                    }}
                  >▼</button>

                  {/* Remove */}
                  <button
                    onClick={() => removeStop(s.id)}
                    title="Remove stop from route"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#EF4444", fontSize: 14, lineHeight: 1, padding: "2px 3px",
                    }}
                  >×</button>
                </div>
              ))
            }
          </div>

          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              Waypoints ({waypoints.length})
            </div>
            {waypoints.length === 0
              ? <p style={{ fontSize: 11, color: "#94A3B8" }}>None yet. Enable "+ Add Waypoint" then click the map.</p>
              : waypoints.map((wp, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 7, marginBottom: 3, background: "#fff", border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748B", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#475569", flex: 1 }}>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                  <button onClick={() => deleteWaypoint(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))
            }
          </div>

          <div style={{ padding: "12px 14px", fontSize: 11, color: "#94A3B8", lineHeight: 1.7 }}>
            <strong style={{ color: "#475569" }}>Tips:</strong><br />
            • <strong style={{ color: "#059669" }}>+ Add Stop</strong> → click map → name it<br />
            • ▲ ▼ to reorder · × to remove a stop<br />
            • <strong style={{ color: "#6D28D9" }}>+ Add Waypoint</strong> → shapes the road path<br />
            • Drag any marker to reposition it<br />
            • Right-click a waypoint to delete it<br />
            • <strong style={{ color: "#0F172A" }}>Save</strong> to persist positions + waypoints
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

