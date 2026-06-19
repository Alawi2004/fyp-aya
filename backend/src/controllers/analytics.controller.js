import { poolPromise, sql } from "../db/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/gps-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD&trip_id=X
//
// Aggregates gps_logs into 0.01° × 0.01° grid cells (~1.1 km × 0.93 km at
// Beirut's latitude), counts pings per cell, normalises to [0, 1], and returns
// point triples [lat, lng, intensity] ready for a Leaflet heatmap overlay.
//
// Optional filters: ?from= ?to= ?trip_id=
// Response: { points: [[lat, lng, intensity], ...], cell_size_deg: 0.01, total_pings: N }
// ─────────────────────────────────────────────────────────────────────────────
export const getGpsHeatmap = async (req, res) => {
  try {
    const { from, to, trip_id } = req.query;
    const pool    = await poolPromise;
    const request = pool.request();

    let where = "WHERE latitude IS NOT NULL AND longitude IS NOT NULL";
    if (from)    { request.input("from",    sql.Date, from);                         where += " AND CAST(recorded_at AS DATE) >= @from"; }
    if (to)      { request.input("to",      sql.Date, to);                           where += " AND CAST(recorded_at AS DATE) <= @to"; }
    if (trip_id) { request.input("trip_id", sql.Int,  parseInt(trip_id, 10));         where += " AND trip_id = @trip_id"; }

    const result = await request.query(`
      SELECT TOP 1000
        CAST(FLOOR(CAST(latitude  AS FLOAT) / 0.01) * 0.01 + 0.005 AS DECIMAL(9,6)) AS cell_lat,
        CAST(FLOOR(CAST(longitude AS FLOAT) / 0.01) * 0.01 + 0.005 AS DECIMAL(9,6)) AS cell_lng,
        COUNT(*) AS ping_count
      FROM gps_logs
      ${where}
      GROUP BY
        FLOOR(CAST(latitude  AS FLOAT) / 0.01),
        FLOOR(CAST(longitude AS FLOAT) / 0.01)
      HAVING COUNT(*) >= 2
      ORDER BY ping_count DESC
    `);

    const rows = result.recordset;
    if (rows.length === 0) {
      return res.json({ points: [], cell_size_deg: 0.01, total_pings: 0 });
    }

    const maxCount   = rows[0].ping_count;
    const totalPings = rows.reduce((s, r) => s + r.ping_count, 0);

    const points = rows.map(r => [
      parseFloat(r.cell_lat),
      parseFloat(r.cell_lng),
      parseFloat((r.ping_count / maxCount).toFixed(4)),
    ]);

    res.json({ points, cell_size_deg: 0.01, total_pings: totalPings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch GPS heatmap data" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/passenger-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns actual ticket booking activity aggregated by:
//   • day-of-week  (0 = Sunday … 6 = Saturday)
//   • hour-of-day  (0 … 23)
//   • calendar day (one count per date in the range)
//
// Response:
//   {
//     heatmap: number[][],   // [7 days][24 hours] — count per cell
//     peak_hours: { hour: number, count: number }[],
//     daily: { date: string, count: number }[],   // one entry per day in [from, to]
//     total: number,
//     from: string,
//     to: string
//   }
// ─────────────────────────────────────────────────────────────────────────────
export const getPassengerHeatmap = async (req, res) => {
  try {
    const to   = req.query.to   || new Date().toISOString().slice(0, 10);
    const from = req.query.from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const pool    = await poolPromise;
    const result  = await pool.request()
      .input("from", sql.Date, from)
      .input("to",   sql.Date, to)
      .query(`
        SELECT
          (DATEPART(WEEKDAY, booking_time) - 1)  AS day_of_week,
          DATEPART(HOUR,    booking_time)         AS hour_of_day,
          COUNT(*)                                AS cnt
        FROM tickets
        WHERE CAST(booking_time AS DATE) BETWEEN @from AND @to
        GROUP BY
          DATEPART(WEEKDAY, booking_time),
          DATEPART(HOUR,    booking_time)
      `);

    const dailyResult = await pool.request()
      .input("from", sql.Date, from)
      .input("to",   sql.Date, to)
      .query(`
        SELECT CAST(booking_time AS DATE) AS day, COUNT(*) AS cnt
        FROM tickets
        WHERE CAST(booking_time AS DATE) BETWEEN @from AND @to
        GROUP BY CAST(booking_time AS DATE)
      `);

    // Build the 7×24 matrix (all zeros, fill from query)
    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let total = 0;

    for (const { day_of_week, hour_of_day, cnt } of result.recordset) {
      heatmap[day_of_week][hour_of_day] = cnt;
      total += cnt;
    }

    // Peak hours: sum across all days per hour, return top 24 sorted by count
    const hourTotals = Array.from({ length: 24 }, (_, h) => ({
      hour:  h,
      count: heatmap.reduce((s, day) => s + day[h], 0),
    })).sort((a, b) => b.count - a.count);

    // Daily counts: fill every calendar day in [from, to] with 0, then overlay real counts
    const dayCounts = {};
    for (const { day, cnt } of dailyResult.recordset) {
      dayCounts[new Date(day).toISOString().slice(0, 10)] = cnt;
    }
    const daily = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      daily.push({ date: key, count: dayCounts[key] ?? 0 });
    }

    res.json({ heatmap, peak_hours: hourTotals, daily, total, from, to });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch heatmap data" });
  }
};
