import { poolPromise } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";
import { sqlLocalDate } from "../utils/lebanonTime.js";

const VALID_FORMATS = new Set(["json", "csv"]);
const tableColumnsCache = new Map();

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
};

const sendFormatted = (res, format, filename, rows, meta = {}) => {
  if (format === "csv") {
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const csv = [
      keys.join(","),
      ...rows.map((row) => keys.map((key) => escapeCsv(row[key])).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  return res.json({ meta, data: rows });
};

const getFormatAndRange = (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  if (!VALID_FORMATS.has(format)) {
    res.status(400).json({ error: "format must be either json or csv" });
    return null;
  }

  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 29 * 86400000);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    res.status(400).json({ error: "from and to must be valid dates" });
    return null;
  }

  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);
  return { format, fromIso, toIso };
};

const withDateWindow = (column, fromIso, toIso) => `
  ${sqlLocalDate(column)} >= '${fromIso}'
  AND ${sqlLocalDate(column)} <= '${toIso}'
`;

const getTableColumns = async (pool, tableName) => {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName);
  }

  const result = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${tableName}'
  `);

  const columns = new Set(result.recordset.map((row) => row.COLUMN_NAME.toLowerCase()));
  tableColumnsCache.set(tableName, columns);
  return columns;
};

export const getRevenueReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool = await poolPromise;
    const ticketColumns = await getTableColumns(pool, "tickets");
    const dateColumn = ticketColumns.has("booking_time")
      ? "booking_time"
      : ticketColumns.has("created_at")
        ? "created_at"
        : null;

    if (!dateColumn) {
      return res.status(500).json({ error: "Tickets table is missing a reportable date column" });
    }

    const amountExpression = ticketColumns.has("amount")
      ? "CAST(ISNULL(amount, 0) AS DECIMAL(10,2))"
      : "CAST(0 AS DECIMAL(10,2))";

    const dateFilter = withDateWindow(dateColumn, params.fromIso, params.toIso);
    const rows = (
      await pool.request().query(`
        SELECT
          ${sqlLocalDate(dateColumn)} AS report_date,
          COUNT(*) AS tickets_sold,
          ISNULL(SUM(${amountExpression}), 0) AS total_revenue
        FROM tickets
        WHERE ${dateFilter}
        GROUP BY ${sqlLocalDate(dateColumn)}
        ORDER BY report_date
      `)
    ).recordset;

    sendFormatted(res, params.format, "revenue-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "revenue",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate revenue report" });
  }
};

export const getPassengerUsageReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool = await poolPromise;
    const dateFilter = withDateWindow("pc.recorded_at", params.fromIso, params.toIso);
    const rows = (
      await pool.request().query(`
        WITH trip_peaks AS (
          SELECT
            pc.trip_id,
            ${sqlLocalDate('pc.recorded_at')} AS report_date,
            MAX(pc.passenger_count) AS peak_passengers
          FROM passenger_counts pc
          WHERE ${dateFilter}
          GROUP BY pc.trip_id, ${sqlLocalDate('pc.recorded_at')}
        )
        SELECT
          tp.report_date,
          COUNT(*) AS trips_measured,
          ISNULL(SUM(tp.peak_passengers), 0) AS total_peak_passengers,
          ISNULL(AVG(CAST(tp.peak_passengers AS DECIMAL(10,2))), 0) AS avg_peak_passengers
        FROM trip_peaks tp
        GROUP BY tp.report_date
        ORDER BY tp.report_date
      `)
    ).recordset;

    sendFormatted(res, params.format, "passenger-usage-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "passenger_usage",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate passenger usage report" });
  }
};

export const getDriverPerformanceReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const dateFilter = withDateWindow("t.start_time", params.fromIso, params.toIso);
    const rows = (
      await pool.request().query(`
        SELECT
          d.driver_id,
          u.full_name AS driver_name,
          COUNT(DISTINCT t.trip_id) AS trips_handled,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.trip_id END) AS trips_completed,
          ISNULL(AVG(CAST(r.rating AS DECIMAL(10,2))), 0) AS average_rating,
          COUNT(DISTINCT c.complaint_id) AS complaint_count
        FROM drivers d
        JOIN users u ON u.user_id = d.user_id
        LEFT JOIN trips t ON t.driver_id = d.driver_id
          AND ${dateFilter}
        LEFT JOIN ratings r ON r.trip_id = t.trip_id
        LEFT JOIN complaints c ON c.driver_id = d.driver_id
          AND ${withDateWindow("c.submitted_at", params.fromIso, params.toIso)}
        GROUP BY d.driver_id, u.full_name
        ORDER BY trips_completed DESC, average_rating DESC
      `)
    ).recordset;

    sendFormatted(res, params.format, "driver-performance-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "driver_performance",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate driver performance report" });
  }
};

export const getComplaintTrendsReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const rows = (
      await pool.request().query(`
        SELECT
          ${sqlLocalDate('submitted_at')} AS report_date,
          category,
          priority,
          status,
          COUNT(*) AS complaint_count
        FROM complaints
        WHERE ${withDateWindow("submitted_at", params.fromIso, params.toIso)}
        GROUP BY ${sqlLocalDate('submitted_at')}, category, priority, status
        ORDER BY report_date, category, priority
      `)
    ).recordset;

    sendFormatted(res, params.format, "complaint-trends-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "complaint_trends",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate complaint trends report" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/vehicle-utilization?from=&to=&format=json|csv
// Per-vehicle: active trip hours, trip count. Distance and idle not in DB.
// ─────────────────────────────────────────────────────────────────────────────
export const getVehicleUtilizationReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool = await poolPromise;
    const rows = (
      await pool.request().query(`
        SELECT
          v.plate_number                                            AS plate,
          ISNULL(v.vehicle_type, 'Standard')                       AS type,
          COUNT(DISTINCT t.trip_id)                                AS trips,
          ISNULL(CAST(SUM(
            DATEDIFF(MINUTE, t.start_time, ISNULL(t.end_time, t.start_time))
          ) AS FLOAT) / 60.0, 0)                                   AS active_hours,
          0                                                         AS idle_hours,
          0                                                         AS distance_km
        FROM vehicles v
        LEFT JOIN trips t ON t.vehicle_id = v.vehicle_id
          AND ${sqlLocalDate('t.start_time')} >= '${params.fromIso}'
          AND ${sqlLocalDate('t.start_time')} <= '${params.toIso}'
          AND LOWER(ISNULL(t.status,'')) IN ('completed','ongoing','in_progress')
        WHERE v.status != 'deleted'
        GROUP BY v.vehicle_id, v.plate_number, v.vehicle_type
        ORDER BY active_hours DESC
      `)
    ).recordset.map(r => ({
      ...r,
      active_hours:    parseFloat(parseFloat(r.active_hours).toFixed(1)),
      utilization_pct: r.active_hours > 0
        ? Math.round((r.active_hours / 12) * 100)   // assume 12-hour max shift
        : 0,
    }));

    sendFormatted(res, params.format, "vehicle-utilization-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "vehicle_utilization",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate vehicle utilization report" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/top-routes?from=&to=&format=json|csv
// Aggregate trip + ticket data per route, ordered by revenue.
// ─────────────────────────────────────────────────────────────────────────────
export const getTopRoutesReport = async (req, res) => {
  const params = getFormatAndRange(req, res);
  if (!params) return;

  try {
    const pool    = await poolPromise;
    const tickCols = await getTableColumns(pool, "tickets");
    const amtExpr  = tickCols.has("amount")
      ? "CAST(ISNULL(tk.amount, 0) AS DECIMAL(10,2))"
      : "CAST(0 AS DECIMAL(10,2))";

    const rows = (
      await pool.request().query(`
        SELECT TOP 10
          r.route_name                                           AS route,
          ISNULL(CONCAT(r.start_location,' → ',r.end_location), r.route_name) AS name,
          COUNT(DISTINCT t.trip_id)                             AS trips,
          COUNT(tk.ticket_id)                                   AS passengers,
          ISNULL(SUM(${amtExpr}), 0)                            AS revenue,
          CASE WHEN COUNT(DISTINCT t.trip_id) > 0
            THEN ROUND(
              CAST(COUNT(tk.ticket_id) AS FLOAT)
              / (ISNULL(MAX(v.capacity), 30) * COUNT(DISTINCT t.trip_id)) * 100, 0)
            ELSE 0 END                                          AS load_pct
        FROM routes r
        LEFT JOIN trips t ON t.route_id = r.route_id
          AND ${sqlLocalDate('t.start_time')} >= '${params.fromIso}'
          AND ${sqlLocalDate('t.start_time')} <= '${params.toIso}'
        LEFT JOIN tickets tk ON tk.trip_id = t.trip_id
        LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
        GROUP BY r.route_id, r.route_name, r.start_location, r.end_location
        HAVING COUNT(DISTINCT t.trip_id) > 0
        ORDER BY revenue DESC, trips DESC
      `)
    ).recordset.map(r => ({
      ...r,
      revenue:  parseFloat(r.revenue),
      load:     Math.min(100, parseInt(r.load_pct) || 0),
    }));

    sendFormatted(res, params.format, "top-routes-report", rows, {
      from: params.fromIso,
      to: params.toIso,
      report: "top_routes",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate top routes report" });
  }
};
