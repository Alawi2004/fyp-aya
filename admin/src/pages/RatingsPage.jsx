// pages/RatingsPage.jsx
import { useState, useEffect } from "react";
import { DataTable } from "../components/Table";
import { Panel } from "../components/Panel";
import { StatCard } from "../components/StatCard";
import { getRatings } from "../api/endpoints";

function normalizeRating(r) {
  const dt = r.created_at ? new Date(r.created_at) : null;
  return {
    id: r.rating_id ?? r.id,
    passenger: r.full_name ?? r.passenger ?? `User #${r.user_id ?? ""}`,
    trip: r.trip_id ? `TRP-${r.trip_id}` : (r.trip ?? ""),
    route: r.route_name ?? r.route ?? "",
    driver: r.driver_name ?? r.driver ?? "",
    rating: r.rating ?? 0,
    comment: r.comment ?? "",
    date: dt ? dt.toISOString().split("T")[0] : (r.date ?? ""),
  };
}


function StarDisplay({ rating, size = 13 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= rating ? "#f9a825" : "#e0e0e0" }}>
          ★
        </span>
      ))}
    </span>
  );
}

// Plain utility function — NOT a React component.
// Bug was: written as function DriverSummary({ ratings }) which destructures
// an object, so calling buildDriverSummary(array) passed the array as "this"
// and ratings was undefined → forEach crashed.
function buildDriverSummary(ratingsArray) {
  if (!ratingsArray || ratingsArray.length === 0) return [];
  const map = {};
  ratingsArray.forEach((r) => {
    if (!map[r.driver]) {
      map[r.driver] = {
        total: 0,
        count: 0,
        initials: r.driver
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2),
      };
    }
    map[r.driver].total += r.rating;
    map[r.driver].count += 1;
  });
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      avg: (d.total / d.count).toFixed(1),
      count: d.count,
      initials: d.initials,
    }))
    .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));
}

export default function RatingsPage() {
  const [ratings, setRatings] = useState([]);
  const [starFilter, setStarFilter] = useState(0);

  useEffect(() => {
    getRatings()
      .then((data) => setRatings((data || []).map(normalizeRating)))
      .catch(() => setRatings([]));
  }, []);
  const [driverFilter, setDriverFilter] = useState("All");
  const [search, setSearch] = useState("");

  const drivers = ["All", ...new Set(ratings.map((r) => r.driver).filter(Boolean))];

  const filtered = ratings.filter((r) => {
    const matchStar = starFilter === 0 || r.rating === starFilter;
    const matchDriver = driverFilter === "All" || r.driver === driverFilter;
    const matchSearch =
      r.passenger.toLowerCase().includes(search.toLowerCase()) ||
      r.comment.toLowerCase().includes(search.toLowerCase());
    return matchStar && matchDriver && matchSearch;
  });

  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : "0.0";
  const dist = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: ratings.filter((r) => r.rating === s).length,
  }));
  const driverSums = buildDriverSummary(ratings);

  // Each column has a UNIQUE key — fixes the duplicate key="id" warning
  const columns = [
    {
      key: "passenger",
      label: "Passenger",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            {row.trip} · {row.route}
          </div>
        </div>
      ),
    },
    { key: "driver", label: "Driver" },
    { key: "date", label: "Date" },
    {
      key: "rating",
      label: "Rating",
      render: (v) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StarDisplay rating={v} />
          <span style={{ fontSize: 12, color: "#475569" }}>{v}/5</span>
        </div>
      ),
    },
    {
      key: "comment",
      label: "Comment",
      render: (v) => (
        <span style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>
          "{v}"
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}>
          Ratings & feedback
        </h1>
        <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
          Passenger reviews and driver performance
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Avg rating"
          value={avgRating}
          delta="out of 5"
          up={parseFloat(avgRating) >= 4}
        />
        <StatCard
          label="Total reviews"
          value={ratings.length}
          delta="all time"
          up={null}
        />
        <StatCard
          label="5-star reviews"
          value={dist[0].count}
          delta={`${Math.round((dist[0].count / ratings.length) * 100)}% of total`}
          up={true}
        />
        <StatCard
          label="1–2 star"
          value={dist[3].count + dist[4].count}
          delta="need attention"
          up={dist[3].count + dist[4].count === 0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="Rating distribution">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dist.map(({ star, count }) => (
              <div
                key={star}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span style={{ fontSize: 12, color: "#f9a825", minWidth: 60 }}>
                  {"★".repeat(star)}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 10,
                    background: "#F1F5F9",
                    borderRadius: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(count / ratings.length) * 100}%`,
                      height: "100%",
                      background:
                        star >= 4
                          ? "#10B981"
                          : star === 3
                            ? "#F59E0B"
                            : "#EF4444",
                      borderRadius: 5,
                      transition: "width .4s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    minWidth: 20,
                    textAlign: "right",
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <StarDisplay rating={Math.round(parseFloat(avgRating))} size={16} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>
              {avgRating}
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>overall average</span>
          </div>
        </Panel>

        <Panel title="Driver leaderboard">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {driverSums.map((d, i) => (
              <div
                key={d.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderBottom:
                    i < driverSums.length - 1 ? "1px solid #F1F5F9" : "none",
                }}
              >
                <span
                  style={{
                    width: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: i === 0 ? "#f9a825" : "#bbb",
                  }}
                >
                  #{i + 1}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#EFF6FF",
                    color: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {d.initials}
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0F172A",
                  }}
                >
                  {d.name}
                </span>
                <StarDisplay rating={Math.round(parseFloat(d.avg))} size={11} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0F172A",
                    minWidth: 28,
                  }}
                >
                  {d.avg}
                </span>
                <span style={{ fontSize: 11, color: "#aaa" }}>
                  {d.count} reviews
                </span>
              </div>
            ))}
          </div>
        </Panel>
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
          placeholder="Search passenger or comment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
            outline: "none",
            width: 260,
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setStarFilter(0)}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 11,
              cursor: "pointer",
              border: starFilter === 0 ? "none" : "1px solid #E2E8F0",
              background: starFilter === 0 ? "#2563EB" : "#fff",
              color: starFilter === 0 ? "#fff" : "#64748B",
              fontWeight: starFilter === 0 ? 600 : 400,
            }}
          >
            All stars
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              onClick={() => setStarFilter(starFilter === s ? 0 : s)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                fontSize: 11,
                cursor: "pointer",
                border: starFilter === s ? "none" : "1px solid #E2E8F0",
                background: starFilter === s ? "#F59E0B" : "#fff",
                color: starFilter === s ? "#fff" : "#64748B",
                fontWeight: starFilter === s ? 600 : 400,
              }}
            >
              {"★".repeat(s)}
            </button>
          ))}
        </div>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
          }}
        >
          {drivers.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      <Panel title={`${filtered.length} reviews`}>
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
            No reviews match your filters.
          </div>
        )}
      </Panel>
    </div>
  );
}
