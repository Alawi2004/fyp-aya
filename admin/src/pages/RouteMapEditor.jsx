import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../api/apiClient";

// ── Custom div-icons (avoids Vite default-icon path issue) ────────────────────

const makeStopIcon = (order) =>
  L.divIcon({
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:#2563EB;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:800;color:#fff;
      font-family:Inter,system-ui,sans-serif;
    ">${order}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const waypointIcon = L.divIcon({
  html: `<div style="
    width:12px;height:12px;border-radius:50%;
    background:#64748B;border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.25);
  "></div>`,
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// ── Click handler: adds waypoints when add-mode is on ─────────────────────────

function MapClickHandler({ active, onAdd }) {
  useMapEvents({
    click(e) {
      if (active) onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Default coords spread across Beirut when stops have no coordinates ─────────

function defaultPos(index, total) {
  const s = { lat: 33.892, lng: 35.503 };
  const e = { lat: 33.854, lng: 35.538 };
  const t = total > 1 ? index / (total - 1) : 0.5;
  return { lat: s.lat + t * (e.lat - s.lat), lng: s.lng + t * (e.lng - s.lng) };
}

// ══════════════════════════════════════════════════════════════════════════════
//  RouteMapEditor — rendered as a portal into document.body so it reliably
//  covers the full viewport regardless of the parent stacking context.
// ══════════════════════════════════════════════════════════════════════════════

export default function RouteMapEditor({ route, onClose, onSaved }) {
  const [stops,     setStops]     = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [addMode,   setAddMode]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);

  useEffect(() => {
    const raw = route.stops ?? [];
    const normalised = raw.map((s, i) => ({
      id:    s.id ?? s.stop_id ?? i,
      name:  s.name ?? s.stop_name ?? `Stop ${i + 1}`,
      lat:   parseFloat(s.latitude  ?? s.lat)  || defaultPos(i, raw.length).lat,
      lng:   parseFloat(s.longitude ?? s.lng)  || defaultPos(i, raw.length).lng,
      order: s.order ?? s.stop_order ?? i,
    }));
    setStops(normalised.sort((a, b) => a.order - b.order));

    apiClient.get(`/routes/${route.id}/waypoints`)
      .then(data => setWaypoints((data || []).map(w => ({
        lat: parseFloat(w.latitude),
        lng: parseFloat(w.longitude),
      }))))
      .catch(() => setWaypoints([]));
  }, [route]);

  const center = stops.length
    ? [stops.reduce((s, p) => s + p.lat, 0) / stops.length,
       stops.reduce((s, p) => s + p.lng, 0) / stops.length]
    : [33.888, 35.495];

  const moveStop = useCallback((id, lat, lng) =>
    setStops(prev => prev.map(s => s.id === id ? { ...s, lat, lng } : s)), []);

  const addWaypoint = useCallback((lat, lng) =>
    setWaypoints(prev => [...prev, { lat, lng }]), []);

  const moveWaypoint = useCallback((i, lat, lng) =>
    setWaypoints(prev => prev.map((w, idx) => idx === i ? { lat, lng } : w)), []);

  const deleteWaypoint = useCallback((i) =>
    setWaypoints(prev => prev.filter((_, idx) => idx !== i)), []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

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

  const stopLine   = stops.map(s => [s.lat, s.lng]);
  const allPoints  = [...stopLine, ...waypoints.map(w => [w.lat, w.lng])];

  // ── Rendered as a portal into document.body ──────────────────────────────────
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
          padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        }}>{toast}</div>
      )}

      {/* Toolbar */}
      <div style={{
        height: 56, background: "#fff", borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0,
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

        <button onClick={() => setAddMode(m => !m)} style={{
          padding: "7px 14px", borderRadius: 8,
          border: `1.5px solid ${addMode ? "#2563EB" : "#E2E8F0"}`,
          background: addMode ? "#EFF6FF" : "#fff",
          color: addMode ? "#2563EB" : "#374151",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>
          {addMode ? "✓ Click map to add" : "+ Add Waypoint"}
        </button>

        {waypoints.length > 0 && (
          <button onClick={() => setWaypoints([])} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Clear ({waypoints.length})
          </button>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: saving ? "#93C5FD" : "#2563EB",
          color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
        }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Map — height must be explicit for Leaflet to initialize */}
        <div style={{ flex: 1, position: "relative", height: "calc(100vh - 56px)" }}>
          {addMode && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              background: "#2563EB", color: "#fff", borderRadius: 20,
              padding: "5px 16px", fontSize: 12, fontWeight: 600, zIndex: 1000,
              pointerEvents: "none",
            }}>
              Click anywhere to add a waypoint
            </div>
          )}

          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            <MapClickHandler active={addMode} onAdd={addWaypoint} />

            {/* Route line through stops */}
            {stopLine.length > 1 && (
              <Polyline positions={stopLine} color="#2563EB" weight={4} opacity={0.85} />
            )}

            {/* Stop markers — draggable, use e.target in dragend (no ref needed) */}
            {stops.map((stop, i) => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lng]}
                draggable
                icon={makeStopIcon(i + 1)}
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
                  contextmenu() {
                    deleteWaypoint(i);
                  },
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
        <div style={{ width: 220, borderLeft: "1px solid #E2E8F0", background: "#F8FAFC", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "14px 14px 8px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              Stops ({stops.length})
            </div>
            {stops.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 7, marginBottom: 3, background: "#fff", border: "1px solid #E2E8F0" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2563EB", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 11, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              Waypoints ({waypoints.length})
            </div>
            {waypoints.length === 0
              ? <p style={{ fontSize: 11, color: "#94A3B8" }}>None yet. Enable "Add Waypoint" then click the map.</p>
              : waypoints.map((wp, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 7, marginBottom: 3, background: "#fff", border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748B", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#475569", flex: 1 }}>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                  <button onClick={() => deleteWaypoint(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))
            }
          </div>

          <div style={{ padding: "12px 14px", fontSize: 11, color: "#94A3B8", lineHeight: 1.6 }}>
            <strong style={{ color: "#475569" }}>Tips:</strong><br />
            • Drag blue stop markers to reposition GPS<br />
            • Click "+ Add Waypoint" then click map to add path points<br />
            • Right-click a waypoint to delete it<br />
            • Hit "Save" when done
          </div>
        </div>
      </div>
    </div>,
    document.body   // ← portal target
  );
}
