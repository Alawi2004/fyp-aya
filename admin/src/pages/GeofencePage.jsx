// pages/GeofencePage.jsx — Geofence zone management
import { useState, useEffect, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Circle, Tooltip, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Radio, AlertTriangle, MapPin, Navigation } from "lucide-react";
import { Panel } from "../components/Panel";
import { getStops, getGeofenceAlerts } from "../api/endpoints";
import apiClient from "../api/apiClient";

const DEFAULT_RADIUS = 200;
const MAP_CENTER     = [3.139, 101.687];
const PRESETS        = [50, 100, 200, 300, 500];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtAgo(dt) {
  if (!dt) return "—";
  const min = Math.floor((Date.now() - new Date(dt)) / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Leaflet map helpers ────────────────────────────────────────────────────────

function makeStopIcon(selected) {
  const color = selected ? "#6D28D9" : "#475569";
  const size  = selected ? 20 : 14;
  return L.divIcon({
    html: `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:#fff;border:2.5px solid ${color};
        box-shadow:0 2px 8px rgba(0,0,0,.25);
        display:flex;align-items:center;justify-content:center;
      "><div style="width:${size / 2.5}px;height:${size / 2.5}px;border-radius:50%;background:${color};"></div></div>`,
    className:    "",
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    tooltipAnchor:[size / 2 + 4, 0],
  });
}

function FlyToStop({ stop }) {
  const map   = useMap();
  const prevId = useRef(null);
  useEffect(() => {
    if (!stop || stop.stop_id === prevId.current) return;
    prevId.current = stop.stop_id;
    if (stop.latitude && stop.longitude)
      map.flyTo([parseFloat(stop.latitude), parseFloat(stop.longitude)], 16, { duration: 0.8 });
  }, [stop, map]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ZoneEditor({ stop, currentRadius, onSave, onClose }) {
  const [radius, setRadius] = useState(String(currentRadius ?? DEFAULT_RADIUS));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const r = parseFloat(radius);
    if (isNaN(r) || r < 50 || r > 5000) return;
    setSaving(true);
    await onSave(stop, r);
    setSaving(false);
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid #DDD6FE",
      padding: "16px 18px", boxShadow: "0 1px 6px rgba(109,40,217,.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Edit Zone</div>
          <div style={{ fontSize: 11, color: "#6D28D9", fontWeight: 600, marginTop: 1 }}>{stop.stop_name}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16 }}>✕</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Alert Radius (meters)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            type="range" min={50} max={1000} step={25}
            value={parseFloat(radius) || DEFAULT_RADIUS}
            onChange={e => setRadius(e.target.value)}
            style={{ flex: 1, accentColor: "#6D28D9" }}
          />
          <input
            type="number" min={50} max={5000} step={25}
            value={radius}
            onChange={e => setRadius(e.target.value)}
            style={{
              width: 72, padding: "5px 8px", border: "1.5px solid #E2E8F0",
              borderRadius: 7, fontSize: 13, textAlign: "center", outline: "none",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748B" }}>m</span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map(r => (
            <button key={r} onClick={() => setRadius(String(r))} style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${String(r) === String(radius) ? "#6D28D9" : "#E2E8F0"}`,
              background: String(r) === String(radius) ? "#F5F3FF" : "#fff",
              color:      String(r) === String(radius) ? "#6D28D9" : "#64748B",
            }}>{r}m</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12, padding: "8px 10px", background: "#F8FAFC", borderRadius: 7 }}>
        Buses trigger an alert when they enter or exit this radius around the stop.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          disabled={saving || isNaN(parseFloat(radius))}
          style={{
            flex: 1, padding: "8px", background: saving ? "#C4B5FD" : "#6D28D9",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Radius"}
        </button>
        <button onClick={onClose} style={{
          padding: "8px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0",
          borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#64748B",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ZonesList({ stops, radii, selected, onSelect }) {
  const [search, setSearch] = useState("");
  const filtered = stops.filter(s =>
    !search || s.stop_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        placeholder="Search stops…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
          fontSize: 12, outline: "none", background: "#FAFBFC",
        }}
      />
      <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        {filtered.map(stop => {
          const r          = radii[stop.stop_id] ?? DEFAULT_RADIUS;
          const isSelected = selected?.stop_id === stop.stop_id;
          const hasCoords  = stop.latitude && stop.longitude;
          return (
            <div
              key={stop.stop_id}
              onClick={() => hasCoords && onSelect(stop)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                borderRadius: 8, border: `1px solid ${isSelected ? "#DDD6FE" : "#F1F5F9"}`,
                background: isSelected ? "#F5F3FF" : "#F8FAFC",
                cursor: hasCoords ? "pointer" : "default",
                opacity: hasCoords ? 1 : 0.5,
                transition: "background .12s",
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: isSelected ? "#6D28D9" : hasCoords ? "#94A3B8" : "#E2E8F0",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: isSelected ? "#4C1D95" : "#0F172A",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {stop.stop_name}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8" }}>
                  {hasCoords
                    ? `${parseFloat(stop.latitude).toFixed(4)}, ${parseFloat(stop.longitude).toFixed(4)}`
                    : "No coordinates — cannot configure"}
                </div>
              </div>
              {hasCoords && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#6D28D9",
                  background: "#F5F3FF", padding: "2px 8px", borderRadius: 6, flexShrink: 0,
                  border: "1px solid #DDD6FE",
                }}>
                  {r}m
                </span>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8", fontSize: 13 }}>
            No stops found
          </div>
        )}
      </div>
    </div>
  );
}

function AlertsList({ alerts }) {
  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8" }}>
        <Navigation size={28} color="#CBD5E1" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 13 }}>No geofence events recorded</div>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
      {alerts.map((a, i) => {
        const isEntry = String(a.event_type ?? a.type ?? "").includes("entry");
        return (
          <div key={a.id ?? i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
            background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 6, flexShrink: 0,
              background: isEntry ? "#ECFDF5" : "#FEF2F2",
              color:      isEntry ? "#059669" : "#DC2626",
              border:     `1px solid ${isEntry ? "#A7F3D0" : "#FECACA"}`,
            }}>
              {isEntry ? "ENTRY" : "EXIT"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.stop_name ?? a.stop ?? "Stop"}
              </div>
              <div style={{ fontSize: 10, color: "#64748B" }}>
                {a.driver_name ?? "—"} · {a.vehicle ?? a.plate ?? "—"}
              </div>
            </div>
            <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{fmtAgo(a.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent }) {
  return (
    <div style={{
      padding: "8px 16px", background: "#fff", borderRadius: 10,
      border: "1px solid #F1F5F9", boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      display: "flex", flexDirection: "column", gap: 2, minWidth: 120,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", letterSpacing: "-.4px" }}>{value}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GeofencePage() {
  const [stops,    setStops]    = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [radii,    setRadii]    = useState({});
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("zones");
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  useEffect(() => {
    Promise.all([
      getStops()
        .then(d => {
          const list = Array.isArray(d) ? d : (d?.data ?? []);
          setStops(list);
          const init = {};
          list.forEach(s => { init[s.stop_id] = s.geofence_radius ?? DEFAULT_RADIUS; });
          setRadii(init);
        })
        .catch(() => {}),
      getGeofenceAlerts()
        .then(d => setAlerts(Array.isArray(d) ? d : (d?.data ?? [])))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelect = stop => {
    setSelected(stop);
    setActiveTab("zones");
  };

  const handleSave = async (stop, radius) => {
    setRadii(prev => ({ ...prev, [stop.stop_id]: radius }));
    try {
      await apiClient.put(`/stops/${stop.stop_id}`, { geofence_radius: radius });
      showToast(`Zone radius saved — ${stop.stop_name}: ${radius}m`);
    } catch {
      showToast(`Saved locally — API update pending`, "warn");
    }
    setSelected(null);
  };

  const validStops = stops.filter(s => s.latitude && s.longitude);
  const center = validStops.length > 0
    ? [parseFloat(validStops[0].latitude), parseFloat(validStops[0].longitude)]
    : MAP_CENTER;

  const entryCount = alerts.filter(a => String(a.event_type ?? a.type ?? "").includes("entry")).length;
  const exitCount  = alerts.filter(a => String(a.event_type ?? a.type ?? "").includes("exit")).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn .3s ease" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === "warn" ? "#FFFBEB" : "#1E293B",
          color:      toast.type === "warn" ? "#92400E" : "#fff",
          border:     toast.type === "warn" ? "1px solid #FDE68A" : "none",
          borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          animation: "fadeInUp .25s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>
            Geofence Management
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
            Configure arrival/departure alert zones per bus stop
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatPill label="Total Stops"     value={stops.length}       accent="#6D28D9" />
          <StatPill label="Mapped Stops"    value={validStops.length}  accent="#10B981" />
          <StatPill label="Entry Events"    value={entryCount}         accent="#3B82F6" />
          <StatPill label="Exit Events"     value={exitCount}          accent="#F59E0B" />
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, minHeight: 560 }}>

        {/* ── MAP ── */}
        <Panel
          title="Zone Map"
          icon={<MapPin size={14} color="#6D28D9" />}
          accent="#6D28D9"
          noPad
          extra={
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              Click a stop to configure its radius
            </span>
          }
        >
          <div style={{ height: 540, position: "relative", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 13 }}>
                Loading map…
              </div>
            ) : (
              <MapContainer
                center={center}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <InvalidateOnMount />
                <FlyToStop stop={selected} />

                {validStops.map(stop => {
                  const r          = radii[stop.stop_id] ?? DEFAULT_RADIUS;
                  const isSelected = selected?.stop_id === stop.stop_id;
                  const lat        = parseFloat(stop.latitude);
                  const lng        = parseFloat(stop.longitude);
                  return (
                    <span key={stop.stop_id}>
                      <Circle
                        center={[lat, lng]}
                        radius={r}
                        pathOptions={{
                          color:       isSelected ? "#6D28D9" : "#94A3B8",
                          fillColor:   isSelected ? "#6D28D9" : "#94A3B8",
                          fillOpacity: isSelected ? 0.15 : 0.07,
                          weight:      isSelected ? 2 : 1,
                          dashArray:   isSelected ? undefined : "5 5",
                        }}
                      />
                      <Marker
                        position={[lat, lng]}
                        icon={makeStopIcon(isSelected)}
                        eventHandlers={{ click: () => handleSelect(stop) }}
                      >
                        <Tooltip direction="right" offset={[8, 0]}>
                          <span style={{ fontWeight: 700 }}>{stop.stop_name}</span>
                          <br />
                          Radius: {r}m
                        </Tooltip>
                      </Marker>
                    </span>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </Panel>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Zone editor — shown when a stop is selected */}
          {selected && (
            <ZoneEditor
              stop={selected}
              currentRadius={radii[selected.stop_id] ?? DEFAULT_RADIUS}
              onSave={handleSave}
              onClose={() => setSelected(null)}
            />
          )}

          {/* Zones / Alerts tabs */}
          <Panel
            title={
              activeTab === "zones"
                ? `Stops (${validStops.length} mapped)`
                : `Geofence Alerts (${alerts.length})`
            }
            extra={
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { id: "zones",  label: "Zones",  icon: <Radio size={11} /> },
                  { id: "alerts", label: "Alerts", icon: <AlertTriangle size={11} /> },
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 6, border: "none",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: activeTab === t.id ? "#6D28D9" : "#F8FAFC",
                    color:      activeTab === t.id ? "#fff" : "#64748B",
                  }}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
            }
          >
            {activeTab === "zones"
              ? <ZonesList stops={stops} radii={radii} selected={selected} onSelect={handleSelect} />
              : <AlertsList alerts={alerts} />
            }
          </Panel>

          {/* Legend */}
          <div style={{
            background: "#fff", borderRadius: 12, border: "1px solid #F1F5F9",
            padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.04)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
              Legend
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { color: "#6D28D9", dash: false, label: "Selected stop zone" },
                { color: "#94A3B8", dash: true,  label: "Configured zone (inactive)" },
              ].map(({ color, dash, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width={32} height={10}>
                    <line
                      x1={0} y1={5} x2={32} y2={5}
                      stroke={color} strokeWidth={2}
                      strokeDasharray={dash ? "4 3" : undefined}
                    />
                  </svg>
                  <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", border: "2.5px solid #6D28D9" }} />
                <span style={{ fontSize: 11, color: "#64748B" }}>Stop marker (click to edit)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
