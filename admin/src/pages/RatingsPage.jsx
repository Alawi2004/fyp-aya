import { useState, useEffect, useMemo } from "react";
import { Star, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { ExportBtn } from "../components/ExportBtn";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import { getRatings } from "../api/endpoints";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRating(r) {
  const dt = r.created_at ? new Date(r.created_at) : null;
  return {
    id:        r.rating_id ?? r.id,
    passenger: r.full_name ?? r.passenger ?? `User #${r.user_id ?? ""}`,
    trip:      r.trip_id ? `TRP-${r.trip_id}` : (r.trip ?? ""),
    route:     r.route_name ?? r.route ?? "—",
    driver:    r.driver_name ?? r.driver ?? "—",
    rating:    r.rating ?? 0,
    comment:   r.comment ?? "",
    date:      dt ? dt.toISOString().split("T")[0] : (r.date ?? ""),
  };
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + r.rating, 0) / arr.length;
}

function groupBy(arr, key) {
  const map = {};
  arr.forEach(r => {
    const k = r[key] || "Unknown";
    if (!map[k]) map[k] = [];
    map[k].push(r);
  });
  return Object.entries(map)
    .map(([name, reviews]) => ({ name, reviews, avg: avg(reviews), count: reviews.length }))
    .sort((a, b) => b.avg - a.avg);
}

function StarDisplay({ rating, size = 13 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? "#f9a825" : "#e0e0e0" }}>★</span>
      ))}
    </span>
  );
}

function ScoreBadge({ value }) {
  const color = value >= 4.5 ? "#059669" : value >= 3.5 ? "#D97706" : "#DC2626";
  const bg    = value >= 4.5 ? "#ECFDF5"  : value >= 3.5 ? "#FFFBEB" : "#FEF2F2";
  return (
    <span style={{ background: bg, color, fontWeight: 800, fontSize: 15, padding: "4px 10px", borderRadius: 8 }}>
      {value.toFixed(1)}
    </span>
  );
}

// ── Tab nav ───────────────────────────────────────────────────────────────────
function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#F8FAFC", borderRadius: 10, padding: 4, border: "1px solid #E2E8F0" }}>
      {tabs.map(({ id, label }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: active === id ? 700 : 500,
          background: active === id ? "#fff" : "transparent",
          color:      active === id ? "#2563EB" : "#64748B",
          boxShadow:  active === id ? "0 1px 4px rgba(0,0,0,.09)" : "none",
          transition: "all .15s",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────
function ReviewRow({ r, showDriver = true, showRoute = true, showPassenger = true }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 16px", borderBottom: "1px solid #F8FAFC" }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <StarDisplay rating={r.rating} size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {r.comment && (
          <div style={{ fontSize: 13, color: "#0F172A", fontStyle: "italic", marginBottom: 5 }}>
            "{r.comment}"
          </div>
        )}
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94A3B8", flexWrap: "wrap" }}>
          {showPassenger && <span>{r.passenger}</span>}
          {showDriver    && r.driver !== "—"  && <span>Driver: {r.driver}</span>}
          {showRoute     && r.route  !== "—"  && <span>Route: {r.route}</span>}
          <span>{r.trip}</span>
          {r.date && <span>{r.date}</span>}
        </div>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: r.rating >= 4 ? "#059669" : r.rating >= 3 ? "#D97706" : "#DC2626", flexShrink: 0 }}>
        {r.rating}/5
      </span>
    </div>
  );
}

// ── Entity card (driver / route / passenger) ──────────────────────────────────
function EntityCard({ group, label, showReviews, onToggle }) {
  const color = group.avg >= 4.5 ? "#059669" : group.avg >= 3.5 ? "#D97706" : "#DC2626";
  const initials = group.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{group.name}</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{group.count} review{group.count !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StarDisplay rating={Math.round(group.avg)} size={12} />
          <ScoreBadge value={group.avg} />
        </div>
        <span style={{ color: "#CBD5E1", fontSize: 12 }}>{showReviews ? "▲" : "▼"}</span>
      </div>

      {showReviews && (
        <div style={{ borderTop: "1px solid #F1F5F9" }}>
          {group.reviews.slice(0, 5).map(r => (
            <ReviewRow key={r.id} r={r} showDriver={label !== "driver"} showRoute={label !== "route"} showPassenger={label !== "passenger"} />
          ))}
          {group.reviews.length > 5 && (
            <div style={{ padding: "8px 16px", textAlign: "center", fontSize: 12, color: "#94A3B8" }}>
              {group.reviews.length - 5} more review{group.reviews.length - 5 !== 1 ? "s" : ""} not shown
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RatingsPage() {
  const [ratings,    setRatings]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("all");
  const [search,     setSearch]     = useState("");
  const [starFilter, setStarFilter] = useState(0);
  const [driverFilter, setDriverFilter] = useState("All");
  const [routeFilter,  setRouteFilter]  = useState("All");
  const [expanded,   setExpanded]   = useState(null);

  useEffect(() => {
    setLoading(true);
    getRatings()
      .then(data => setRatings((data || []).map(normalizeRating)))
      .catch(() => setRatings([]))
      .finally(() => setLoading(false));
  }, []);

  const drivers    = useMemo(() => ["All", ...new Set(ratings.map(r => r.driver).filter(v => v && v !== "—"))], [ratings]);
  const routes     = useMemo(() => ["All", ...new Set(ratings.map(r => r.route).filter(v => v && v !== "—"))], [ratings]);

  const filtered = useMemo(() => ratings.filter(r => {
    const q = search.toLowerCase();
    return (starFilter === 0 || r.rating === starFilter)
        && (driverFilter === "All" || r.driver === driverFilter)
        && (routeFilter  === "All" || r.route  === routeFilter)
        && (!q || r.passenger.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q) || r.route.toLowerCase().includes(q) || r.driver.toLowerCase().includes(q));
  }), [ratings, starFilter, driverFilter, routeFilter, search]);

  const byDriver    = useMemo(() => groupBy(ratings.filter(r => r.driver !== "—"), "driver"),    [ratings]);
  const byRoute     = useMemo(() => groupBy(ratings.filter(r => r.route  !== "—"), "route"),     [ratings]);
  const byPassenger = useMemo(() => groupBy(ratings, "passenger"), [ratings]);

  const overallAvg  = ratings.length ? avg(ratings) : 0;
  const dist        = [5, 4, 3, 2, 1].map(s => ({ star: s, count: ratings.filter(r => r.rating === s).length }));
  const fiveStars   = dist[0].count;
  const lowStars    = dist[3].count + dist[4].count;

  const toggle = (key) => setExpanded(e => e === key ? null : key);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>Ratings & Feedback</h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>Passenger reviews broken down by driver, route, and passenger</p>
        </div>
        <div style={{ flex: 1 }} />
        <ExportBtn
          rows={filtered}
          columns={[
            { key: "id",        label: "ID"        },
            { key: "passenger", label: "Passenger" },
            { key: "trip",      label: "Trip"      },
            { key: "route",     label: "Route"     },
            { key: "driver",    label: "Driver"    },
            { key: "rating",    label: "Rating"    },
            { key: "comment",   label: "Comment"   },
            { key: "date",      label: "Date"      },
          ]}
          filename={`ratings-${new Date().toISOString().slice(0,10)}.csv`}
          title="Ratings & Feedback Report"
        />
        <TabNav
          tabs={[
            { id: "all",       label: "All Reviews" },
            { id: "driver",    label: "By Driver" },
            { id: "route",     label: "By Route" },
            { id: "passenger", label: "By Passenger" },
          ]}
          active={tab}
          onChange={t => { setTab(t); setExpanded(null); setSearch(""); }}
        />
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <StatCard label="Avg rating"    value={overallAvg.toFixed(1)} delta="out of 5"       up={overallAvg >= 4} accent="#F59E0B" icon={<Star size={18} color="#F59E0B" />} />
        <StatCard label="Total reviews" value={ratings.length}         delta="all time"        accent="#2563EB" icon={<MessageSquare size={18} color="#2563EB" />} />
        <StatCard label="5-star"        value={fiveStars}              delta={`${ratings.length ? Math.round(fiveStars/ratings.length*100) : 0}% of total`} up={true} accent="#10B981" icon={<ThumbsUp size={18} color="#10B981" />} />
        <StatCard label="1–2 star"      value={lowStars}               delta="need attention"  up={lowStars === 0} accent="#EF4444" icon={<ThumbsDown size={18} color="#EF4444" />} />
      </div>

      {/* ── All Reviews ── */}
      {tab === "all" && (
        <>
          {/* Distribution + top summaries */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

            {/* Rating distribution */}
            <Panel title="Distribution">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dist.map(({ star, count }) => (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#f9a825", minWidth: 58 }}>{"★".repeat(star)}</span>
                    <div style={{ flex: 1, height: 9, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${ratings.length ? (count/ratings.length)*100 : 0}%`, height: "100%", background: star >= 4 ? "#10B981" : star === 3 ? "#F59E0B" : "#EF4444", borderRadius: 5, transition: "width .4s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#64748B", minWidth: 20, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Top drivers */}
            <Panel title="Top Drivers">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {byDriver.slice(0, 5).map((d, i) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < 4 ? "1px solid #F8FAFC" : "none" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#f9a825" : "#bbb", width: 18 }}>#{i+1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#0F172A" }}>{d.name}</span>
                    <StarDisplay rating={Math.round(d.avg)} size={10} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", minWidth: 28 }}>{d.avg.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{d.count}</span>
                  </div>
                ))}
                {byDriver.length === 0 && <div style={{ fontSize: 13, color: "#bbb", textAlign: "center", padding: "12px 0" }}>No driver data</div>}
              </div>
            </Panel>

            {/* Top routes */}
            <Panel title="Top Routes">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {byRoute.slice(0, 5).map((r, i) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < 4 ? "1px solid #F8FAFC" : "none" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#f9a825" : "#bbb", width: 18 }}>#{i+1}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", minWidth: 28 }}>{r.avg.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{r.count}</span>
                  </div>
                ))}
                {byRoute.length === 0 && <div style={{ fontSize: 13, color: "#bbb", textAlign: "center", padding: "12px 0" }}>No route data</div>}
              </div>
            </Panel>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Search passenger, driver, route, comment…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 300 }}
            />
            <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}>
              {drivers.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}>
              {routes.map(r => <option key={r}>{r}</option>)}
            </select>
            <div style={{ display: "flex", gap: 5 }}>
              {[0,5,4,3,2,1].map(s => (
                <button key={s} onClick={() => setStarFilter(starFilter === s && s !== 0 ? 0 : s)} style={{
                  padding: "5px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  border: starFilter === s ? "none" : "1px solid #E2E8F0",
                  background: starFilter === s ? "#F59E0B" : "#fff",
                  color: starFilter === s ? "#fff" : "#64748B",
                  fontWeight: starFilter === s ? 600 : 400,
                }}>
                  {s === 0 ? "All" : "★".repeat(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Reviews table */}
          <Panel title={`${filtered.length} review${filtered.length !== 1 ? "s" : ""}`} noPad>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>No reviews match your filters.</div>
            ) : filtered.map(r => <ReviewRow key={r.id} r={r} />)}
          </Panel>
        </>
      )}

      {/* ── By Driver ── */}
      {tab === "driver" && (
        <>
          <input
            placeholder="Search driver…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byDriver.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div style={{ textAlign: "center", color: "#bbb", padding: "48px 0" }}>No drivers found.</div>
            )}
            {byDriver
              .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
              .map(g => (
                <EntityCard key={g.name} group={g} label="driver" showReviews={expanded === g.name} onToggle={() => toggle(g.name)} />
              ))}
          </div>
        </>
      )}

      {/* ── By Route ── */}
      {tab === "route" && (
        <>
          <input
            placeholder="Search route…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byRoute.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div style={{ textAlign: "center", color: "#bbb", padding: "48px 0" }}>No routes found.</div>
            )}
            {byRoute
              .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
              .map(g => (
                <EntityCard key={g.name} group={g} label="route" showReviews={expanded === g.name} onToggle={() => toggle(g.name)} />
              ))}
          </div>
        </>
      )}

      {/* ── By Passenger ── */}
      {tab === "passenger" && (
        <>
          <input
            placeholder="Search passenger…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, outline: "none", width: 280 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byPassenger.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div style={{ textAlign: "center", color: "#bbb", padding: "48px 0" }}>No passengers found.</div>
            )}
            {byPassenger
              .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
              .map(g => (
                <EntityCard key={g.name} group={g} label="passenger" showReviews={expanded === g.name} onToggle={() => toggle(g.name)} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
