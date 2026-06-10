import { useState, useEffect, useCallback } from "react";
import { PageLoading, PageError, PageEmpty } from "../components/DataStates";
import { Panel } from "../components/Panel";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { getRoutes, createRoute, updateRoute, deleteRoute, getRouteStops } from "../api/endpoints";
import apiClient from "../api/apiClient";
import RouteMapEditor from "./RouteMapEditor";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRoute(r) {
  return {
    id:       r.route_id ?? r.id,
    code:     r.route_name ?? r.code ?? r.name ?? "",
    name:     r.start_location && r.end_location
      ? `${r.start_location} → ${r.end_location}`
      : (r.origin && r.destination ? `${r.origin} → ${r.destination}` : (r.name ?? "")),
    distance: r.distance ?? "",
    duration: r.duration ?? "",
    active:   r.is_active !== undefined ? Boolean(r.is_active) : (r.active !== undefined ? r.active : true),
    stops:    Array.isArray(r.stops) ? r.stops : [],  // mock data has stops as a count (number), not array
  };
}

const EMPTY_ROUTE = { code: "", name: "", distance: "", duration: "", active: true };
const EMPTY_STOP  = { name: "" };

const ZONE_COLORS = [
  "#2563EB", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#DB2777", "#0891B2", "#65A30D",
];

// ── Stops list with per-stop amenities ───────────────────────────────────────

function StopsList({ route, onDelete }) {
  const [openStop, setOpenStop] = useState(null);

  if (route.stops.length === 0) {
    return <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: "8px 0" }}>No stops yet. Add one above.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {route.stops.map(stop => {
        const sid = stop.id ?? stop.stop_id;
        const isOpen = openStop === sid;
        return (
          <div key={sid}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#2563EB", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {stop.order ?? stop.stop_order ?? "·"}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "#333" }}>{stop.name ?? stop.stop_name}</span>
              {stop.latitude && (
                <span style={{ fontSize: 10, color: "#94A3B8" }}>
                  {parseFloat(stop.latitude).toFixed(4)}, {parseFloat(stop.longitude).toFixed(4)}
                </span>
              )}
              {/* Amenities toggle */}
              <button
                onClick={() => setOpenStop(isOpen ? null : sid)}
                title="Amenities & QR"
                style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 6, border: `1px solid ${isOpen ? "#2563EB" : "#E2E8F0"}`,
                  background: isOpen ? "#EFF6FF" : "#fff", color: isOpen ? "#2563EB" : "#64748B", cursor: "pointer",
                }}
              >
                Info
              </button>
              <button onClick={() => onDelete(sid)} style={{ fontSize: 10, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>✕</button>
            </div>

            {isOpen && <StopAmenitiesPanel stop={stop} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Fare Zones panel ──────────────────────────────────────────────────────────

function FareZonesPanel({ route }) {
  const [zones,    setZones]    = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [form,     setForm]     = useState({ zone_name: "", zone_color: "#2563EB", base_fare: "" });
  const [expanded, setExpanded] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState(null);

  const load = () => {
    apiClient.get(`/routes/${route.id}/fare-zones`)
      .then(data => setZones(Array.isArray(data) ? data : []))
      .catch(() => setZones([]));
  };

  useEffect(() => { load(); }, [route.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const openAdd = () => { setEditZone(null); setForm({ zone_name: "", zone_color: "#2563EB", base_fare: "" }); setShowForm(true); };
  const openEdit = (z) => { setEditZone(z); setForm({ zone_name: z.zone_name, zone_color: z.zone_color, base_fare: String(z.base_fare) }); setShowForm(true); };

  const saveZone = async () => {
    if (!form.zone_name || !form.base_fare) return;
    setBusy(true);
    try {
      const body = { zone_name: form.zone_name, zone_color: form.zone_color, base_fare: parseFloat(form.base_fare) };
      if (editZone) {
        await apiClient.put(`/routes/${route.id}/fare-zones/${editZone.zone_id}`, body);
        setZones(prev => prev.map(z => z.zone_id === editZone.zone_id ? { ...z, ...body } : z));
      } else {
        const res = await apiClient.post(`/routes/${route.id}/fare-zones`, body);
        setZones(prev => [...prev, { ...body, zone_id: res.zone_id ?? Date.now(), stops: [] }]);
      }
      setShowForm(false);
      showToast(editZone ? "Zone updated" : "Zone created");
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteZone = async (zoneId) => {
    if (!confirm("Delete this fare zone?")) return;
    await apiClient.delete(`/routes/${route.id}/fare-zones/${zoneId}`).catch(() => {});
    setZones(prev => prev.filter(z => z.zone_id !== zoneId));
    showToast("Zone deleted");
  };

  const toggleStopInZone = async (zone, stop) => {
    const inZone = zone.stops?.some(s => s.stop_id === stop.id || s.stop_id === stop.stop_id);
    const stopId = stop.id ?? stop.stop_id;
    if (inZone) {
      await apiClient.delete(`/routes/${route.id}/fare-zones/${zone.zone_id}/stops/${stopId}`).catch(() => {});
      setZones(prev => prev.map(z => z.zone_id !== zone.zone_id ? z : { ...z, stops: z.stops.filter(s => s.stop_id !== stopId) }));
    } else {
      await apiClient.post(`/routes/${route.id}/fare-zones/${zone.zone_id}/stops`, { stop_id: stopId }).catch(() => {});
      setZones(prev => prev.map(z => z.zone_id !== zone.zone_id ? z : { ...z, stops: [...(z.stops || []), { stop_id: stopId, stop_name: stop.name ?? stop.stop_name }] }));
    }
  };

  const totalStopsInZones = zones ? new Set(zones.flatMap(z => (z.stops || []).map(s => s.stop_id))).size : 0;

  return (
    <div style={{ padding: "12px 18px 16px", borderTop: "1px solid #F1F5F9" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 3000, background: "#1E293B", color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Fare Zones</span>
          <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 8 }}>
            {zones ? `${zones.length} zones · ${totalStopsInZones} stops assigned` : "Loading…"}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openAdd} style={{ fontSize: 12, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>
          + Add Zone
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
            {editZone ? "Edit Zone" : "New Fare Zone"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Zone Name</label>
              <input value={form.zone_name} onChange={e => setForm(p => ({ ...p, zone_name: e.target.value }))}
                placeholder="e.g. City Centre" style={inp} />
            </div>
            <div>
              <label style={lbl}>Base Fare ($)</label>
              <input type="number" min="0" step="0.25" value={form.base_fare} onChange={e => setForm(p => ({ ...p, base_fare: e.target.value }))}
                placeholder="1.50" style={inp} />
            </div>
            <div>
              <label style={lbl}>Color</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingTop: 2 }}>
                {ZONE_COLORS.map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, zone_color: c }))} style={{
                    width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer",
                    border: form.zone_color === c ? "2.5px solid #0F172A" : "2px solid transparent",
                    boxSizing: "border-box",
                  }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveZone} disabled={busy || !form.zone_name || !form.base_fare} style={{
              padding: "6px 14px", borderRadius: 7, border: "none",
              background: busy || !form.zone_name || !form.base_fare ? "#93C5FD" : "#2563EB",
              color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer"
            }}>
              {busy ? "Saving…" : editZone ? "Update" : "Create Zone"}
            </button>
          </div>
        </div>
      )}

      {/* Zone cards */}
      {zones === null ? (
        <p style={{ fontSize: 12, color: "#94A3B8", padding: "8px 0" }}>Loading zones…</p>
      ) : zones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8" }}>
          <div style={{ fontSize: 24, marginBottom: 6, color: "#CBD5E1" }}>—</div>
          <p style={{ fontSize: 13 }}>No fare zones yet. Add one to define pricing.</p>
        </div>
      ) : zones.map(z => (
        <div key={z.zone_id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
          {/* Zone row */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, cursor: "pointer", background: "#fff" }}
            onClick={() => setExpanded(expanded === z.zone_id ? null : z.zone_id)}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: z.zone_color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", flex: 1 }}>{z.zone_name}</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#059669" }}>${parseFloat(z.base_fare).toFixed(2)}</span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{(z.stops || []).length} stops</span>
            <button onClick={e => { e.stopPropagation(); openEdit(z); }} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Edit</button>
            <button onClick={e => { e.stopPropagation(); deleteZone(z.zone_id); }} style={{ fontSize: 11, color: "#DC2626", background: "#FEF2F2", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>Delete</button>
            <span style={{ color: "#CBD5E1", fontSize: 12 }}>{expanded === z.zone_id ? "▲" : "▼"}</span>
          </div>

          {/* Stop assignment */}
          {expanded === z.zone_id && (
            <div style={{ borderTop: "1px solid #F1F5F9", padding: "10px 14px", background: "#FAFBFC" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                Assign stops to this zone
              </div>
              {route.stops.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94A3B8" }}>No stops on this route.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {route.stops.map(stop => {
                    const sid = stop.id ?? stop.stop_id;
                    const inZone = (z.stops || []).some(s => s.stop_id === sid);
                    return (
                      <button key={sid} onClick={() => toggleStopInZone(z, stop)} style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${inZone ? z.zone_color : "#E2E8F0"}`,
                        background: inZone ? `${z.zone_color}18` : "#fff",
                        color: inZone ? z.zone_color : "#64748B",
                        cursor: "pointer",
                      }}>
                        {inZone ? "✓ " : ""}{stop.name ?? stop.stop_name ?? `Stop ${stop.order}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Fare calculator preview */}
      {zones && zones.length > 0 && (
        <div style={{ marginTop: 12, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 6 }}>Zone Fares</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {zones.map(z => (
              <div key={z.zone_id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: z.zone_color }} />
                <span style={{ fontSize: 12, color: "#1E40AF", fontWeight: 500 }}>
                  {z.zone_name}: <strong>${parseFloat(z.base_fare).toFixed(2)}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", outline: "none" };

// ── Route Overlap Warning ─────────────────────────────────────────────────────

function OverlapWarning({ routeId }) {
  const [overlaps, setOverlaps] = useState(null);

  useEffect(() => {
    apiClient.get(`/routes/${routeId}/overlap`)
      .then(d => setOverlaps(Array.isArray(d) ? d : []))
      .catch(() => setOverlaps([]));
  }, [routeId]);

  if (!overlaps || overlaps.length === 0) return null;

  return (
    <div style={{
      background: "#FFFBEB", border: "1px solid #FDE68A",
      borderRadius: 8, padding: "10px 14px", marginBottom: 12,
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#B45309", flexShrink: 0 }}>!</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", marginBottom: 3 }}>
          Route Overlap Detected
        </div>
        {overlaps.map(o => (
          <div key={o.route_id} style={{ fontSize: 11, color: "#92400E" }}>
            Shares <strong>{o.shared_stops}</strong> stop{o.shared_stops !== 1 ? "s" : ""} with{" "}
            <strong>{o.route_name || `Route #${o.route_id}`}</strong>
            {(o.start_location || o.end_location) && (
              <span style={{ color: "#B45309" }}> ({o.start_location} → {o.end_location})</span>
            )}
          </div>
        ))}
        <div style={{ fontSize: 10, color: "#CA8A04", marginTop: 4 }}>
          Consider merging or differentiating these routes to avoid duplicate coverage.
        </div>
      </div>
    </div>
  );
}

// ── Stop amenities panel ──────────────────────────────────────────────────────

const AMENITY_LIST = [
  { key: "has_shelter",        label: "Shelter"        },
  { key: "has_seating",        label: "Seating"        },
  { key: "has_lighting",       label: "Lighting"       },
  { key: "has_wheelchair",     label: "Wheelchair"     },
  { key: "has_ticket_machine", label: "Ticket Machine" },
  { key: "has_wifi",           label: "WiFi"           },
];

function StopAmenitiesPanel({ stop }) {
  const [amenities, setAmenities] = useState(null);
  const [qr,        setQr]        = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    const stopId = stop.id ?? stop.stop_id;
    apiClient.get(`/stops/${stopId}/amenities`)
      .then(d => setAmenities(d ?? {}))
      .catch(() => setAmenities({}));
    apiClient.get(`/stops/${stopId}/qr`)
      .then(d => setQr(d))
      .catch(() => setQr(null));
  }, [stop.id, stop.stop_id]);

  const toggle = useCallback((key) => {
    setAmenities(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/stops/${stop.id ?? stop.stop_id}/amenities`, amenities);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const qrSrc = qr?.qr_code
    || `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr?.data || `stop-${stop.id ?? stop.stop_id}`)}&size=120x120&margin=4`;

  return (
    <div style={{
      margin: "4px 0 8px 32px",
      background: "#F8FAFC", border: "1px solid #E2E8F0",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

        {/* Left: amenities + inputs */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
            Amenities
          </div>

          {amenities === null ? (
            <p style={{ fontSize: 12, color: "#94A3B8" }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {AMENITY_LIST.map(({ key, label }) => {
                  const active = !!amenities[key];
                  return (
                    <button key={key} onClick={() => toggle(key)} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${active ? "#2563EB" : "#E2E8F0"}`,
                      background: active ? "#EFF6FF" : "#fff",
                      color: active ? "#2563EB" : "#64748B",
                      cursor: "pointer",
                    }}>
                      {label}{active ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>NFC Tag ID</label>
                  <input value={amenities.nfc_tag_id || ""} onChange={e => { setAmenities(p => ({ ...p, nfc_tag_id: e.target.value })); setSaved(false); }}
                    placeholder="e.g. NFC-BEY-048" style={{ ...inp, fontSize: 12 }} />
                </div>
                <div>
                  <label style={lbl}>Nearby Landmark</label>
                  <input value={amenities.nearby_landmark || ""} onChange={e => { setAmenities(p => ({ ...p, nearby_landmark: e.target.value })); setSaved(false); }}
                    placeholder="e.g. Near Hamra post office" style={{ ...inp, fontSize: 12 }} />
                </div>
              </div>

              <button onClick={save} disabled={saving} style={{
                padding: "6px 16px", borderRadius: 7, border: "none",
                background: saved ? "#059669" : saving ? "#93C5FD" : "#2563EB",
                color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              }}>
                {saved ? "✓ Saved" : saving ? "Saving…" : "Save Amenities"}
              </button>
            </>
          )}
        </div>

        {/* Right: QR code */}
        <div style={{ textAlign: "center", minWidth: 140 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
            Stop QR Code
          </div>
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 8, display: "inline-block" }}>
            <img src={qrSrc} alt="Stop QR" width={120} height={120}
              style={{ display: "block", borderRadius: 4 }}
              onError={e => { e.target.style.display = "none"; }} />
          </div>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>
            Scan to view live arrivals
          </div>
          <a
            href={qrSrc}
            download={`stop-${stop.id ?? stop.stop_id}-qr.png`}
            style={{ display: "inline-block", marginTop: 6, fontSize: 11, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}
          >
            Download QR
          </a>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  RoutesPage
// ══════════════════════════════════════════════════════════════════════════════

export default function RoutesPage() {
  const [routes,        setRoutes]        = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError,   setRoutesError]   = useState(null);
  const [expanded,      setExpanded]      = useState(null);
  const [activeTab,     setActiveTab]     = useState({});
  const [mapRoute,      setMapRoute]      = useState(null);
  const [toast,         setToast]         = useState(null);

  const loadRoutes = useCallback(() => {
    setRoutesLoading(true);
    setRoutesError(null);
    getRoutes()
      .then(data => setRoutes((data || []).map(normalizeRoute)))
      .catch(err => setRoutesError(err?.message ?? "Failed to load routes"))
      .finally(() => setRoutesLoading(false));
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const [routeModal,   setRouteModal]   = useState(false);
  const [stopModal,    setStopModal]    = useState(null);
  const [editRoute,    setEditRoute]    = useState(null);
  const [routeForm,    setRouteForm]    = useState(EMPTY_ROUTE);
  const [routeSaveErr, setRouteSaveErr] = useState(null);
  const [isSavingRoute,setIsSavingRoute]= useState(false);
  const [stopForm,     setStopForm]     = useState(EMPTY_STOP);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteErr,    setDeleteErr]    = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  function openAddRoute()  { setEditRoute(null); setRouteForm(EMPTY_ROUTE); setRouteSaveErr(null); setRouteModal(true); }
  function openEditRoute(r) {
    setEditRoute(r.id);
    setRouteForm({ code: r.code, name: r.name, distance: r.distance, duration: r.duration, active: r.active });
    setRouteSaveErr(null);
    setRouteModal(true);
  }

  async function saveRoute() {
    if (!routeForm.code || !routeForm.name) { setRouteSaveErr("Route code and name are required."); return; }
    setRouteSaveErr(null);
    setIsSavingRoute(true);
    try {
      const [start, end] = routeForm.name.split("→").map(s => s.trim());
      if (editRoute) {
        await updateRoute(editRoute, {
          route_name:     routeForm.code,
          start_location: start || routeForm.name,
          end_location:   end   || "",
          is_active:      routeForm.active,
        });
      } else {
        await createRoute({
          route_name:     routeForm.code,
          start_location: start || routeForm.name,
          end_location:   end   || "",
        });
      }
      setRouteModal(false);
      loadRoutes();
    } catch (err) {
      setRouteSaveErr(err?.message ?? "Save failed");
    } finally {
      setIsSavingRoute(false);
    }
  }

  function saveStop(routeId) {
    if (!stopForm.name) return;
    setRoutes(prev => prev.map(r => {
      if (r.id !== routeId) return r;
      return { ...r, stops: [...r.stops, { id: Date.now(), name: stopForm.name, order: r.stops.length + 1 }] };
    }));
    setStopModal(null);
    setStopForm(EMPTY_STOP);
  }

  function deleteStop(routeId, stopId) {
    setRoutes(prev => prev.map(r => {
      if (r.id !== routeId) return r;
      return { ...r, stops: r.stops.filter(s => s.id !== stopId).map((s, i) => ({ ...s, order: i + 1 })) };
    }));
  }

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  async function toggleActive(route) {
    const newActive = !route.active;
    setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, active: newActive } : r));
    try {
      await updateRoute(route.id, { is_active: newActive });
      showToast(`${route.code} ${newActive ? "activated" : "deactivated"}`);
    } catch (err) {
      setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, active: route.active } : r));
      showToast(err?.message ?? "Failed to update route", true);
    }
  }
  function getTab(id) { return activeTab[id] ?? "stops"; }
  function setTab(id, tab) { setActiveTab(prev => ({ ...prev, [id]: tab })); }

  const counts = {
    total: routes.length,
    active: routes.filter(r => r.active).length,
    stops: routes.reduce((a, r) => a + r.stops.length, 0),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 2000, background: toast.isError ? "#EF4444" : "#1E293B", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Routes & Stops</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Manage routes, stops, map paths, and zone-based pricing</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openAddRoute} className="btn-primary" style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Route
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Total routes"  value={counts.total}  delta="defined"           up={null} />
        <StatCard label="Active routes" value={counts.active} delta="in service"         up={true} />
        <StatCard label="Total stops"   value={counts.stops}  delta="across all routes"  up={null} />
      </div>

      {/* ── Route list ── */}
      {routesLoading && <PageLoading message="Loading routes…" />}
      {routesError   && <PageError message={routesError} onRetry={loadRoutes} />}
      {!routesLoading && !routesError && routes.length === 0 && (
        <PageEmpty message="No routes configured" hint="Create your first route with the + Add Route button" />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {routes.map(route => (
          <div key={route.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>

            {/* Route header row */}
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 12, cursor: "pointer" }}
              onClick={() => setExpanded(expanded === route.id ? null : route.id)}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: route.active ? "#EFF6FF" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={route.active ? "#2563EB" : "#aaa"} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="4" cy="14" r="2"/><circle cx="14" cy="14" r="2"/>
                  <path d="M2 7h14l-2-5H4L2 7z"/><path d="M2 7v5a2 2 0 002 2"/><path d="M16 7v5a2 2 0 01-2 2"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{route.code}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>{route.name}</span>
                  <span style={{ fontSize: 10, background: route.active ? "#ECFDF5" : "#F1F5F9", color: route.active ? "#059669" : "#64748B", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                    {route.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {route.distance} · {route.duration} · {route.stops.length} stops
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                {/* Map editor */}
                <button
                  onClick={() => setMapRoute(route)}
                  title="Edit route on map"
                  style={{ fontSize: 11, color: "#7C3AED", background: "#F5F3FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}
                >
                  Map
                </button>
                <button onClick={() => openEditRoute(route)} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
                <button onClick={() => toggleActive(route)} style={{ fontSize: 11, color: route.active ? "#B91C1C" : "#059669", background: route.active ? "#FEF2F2" : "#ECFDF5", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                  {route.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => { setDeleteTarget(route); setDeleteErr(null); }} style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Delete</button>
              </div>
              <span style={{ color: "#bbb", fontSize: 16, marginLeft: 4 }}>{expanded === route.id ? "▲" : "▼"}</span>
            </div>

            {/* Expanded panel */}
            {expanded === route.id && (
              <>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 0, borderTop: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                  {[
                    { id: "stops", label: `Stops (${route.stops.length})` },
                    { id: "zones", label: "Fare Zones" },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setTab(route.id, tab.id)} style={{
                      padding: "10px 20px", border: "none", background: "none",
                      fontSize: 13, fontWeight: getTab(route.id) === tab.id ? 700 : 500,
                      color: getTab(route.id) === tab.id ? "#2563EB" : "#64748B",
                      borderBottom: getTab(route.id) === tab.id ? "2px solid #2563EB" : "2px solid transparent",
                      cursor: "pointer",
                    }}>{tab.label}</button>
                  ))}
                </div>

                {/* Stops tab */}
                {getTab(route.id) === "stops" && (
                  <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 18px 16px" }}>

                    {/* Overlap warning */}
                    <OverlapWarning routeId={route.id} />

                    <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Stops ({route.stops.length})</span>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => { setStopModal(route.id); setStopForm(EMPTY_STOP); }} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                        + Add Stop
                      </button>
                    </div>

                    <StopsList route={route} onDelete={(stopId) => deleteStop(route.id, stopId)} />
                  </div>
                )}

                {/* Fare Zones tab */}
                {getTab(route.id) === "zones" && (
                  <FareZonesPanel route={route} />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Add/Edit Route Modal ── */}
      {routeModal && (
        <Modal title={editRoute ? "Edit route" : "Add new route"} onClose={() => { setRouteModal(false); setRouteSaveErr(null); }} onSave={saveRoute} saving={isSavingRoute}>
          {routeSaveErr && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{routeSaveErr}</div>}
          {[
            { label: "Route code", key: "code",     placeholder: "e.g. Route 14F" },
            { label: "Route name", key: "name",     placeholder: "e.g. Airport → Downtown" },
            { label: "Distance",   key: "distance", placeholder: "e.g. 15 km" },
            { label: "Duration",   key: "duration", placeholder: "e.g. 30 min" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{f.label}</label>
              <input placeholder={f.placeholder} value={routeForm[f.key]} onChange={e => setRouteForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
            </div>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={routeForm.active} onChange={e => setRouteForm(p => ({ ...p, active: e.target.checked })) } />
            Active route
          </label>
        </Modal>
      )}

      {/* ── Add Stop Modal ── */}
      {stopModal && (
        <Modal title="Add stop" onClose={() => setStopModal(null)} onSave={() => saveStop(stopModal)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Stop name</label>
            <input placeholder="e.g. Hamra Street" value={stopForm.name} onChange={e => setStopForm({ name: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </Modal>
      )}

      {/* ── Map Editor (portal into document.body) ── */}
      {mapRoute && (
        <RouteMapEditor
          route={mapRoute}
          onClose={() => setMapRoute(null)}
          onSaved={() => setMapRoute(null)}
        />
      )}

      {/* ── Delete Route Modal ── */}
      {deleteTarget && (
        <Modal title="Delete route" onClose={() => { setDeleteTarget(null); setDeleteErr(null); setIsDeleting(false); }}>
          {deleteErr && <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{deleteErr}</div>}
          <p style={{ fontSize: 14, color: "#333", marginBottom: 6 }}>Delete <strong>{deleteTarget.code}</strong>?</p>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>{deleteTarget.name} — all stops, waypoints, and fare zones will be removed. This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setDeleteTarget(null); setDeleteErr(null); }} disabled={isDeleting} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button
              disabled={isDeleting}
              onClick={async () => {
                setIsDeleting(true); setDeleteErr(null);
                try {
                  await deleteRoute(deleteTarget.id);
                  setDeleteTarget(null);
                  loadRoutes();
                } catch (err) {
                  setDeleteErr(err?.message ?? "Delete failed");
                } finally { setIsDeleting(false); }
              }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer", opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
