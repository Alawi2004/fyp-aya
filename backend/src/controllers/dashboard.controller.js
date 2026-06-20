import { poolPromise } from "../db/db.js";

export const getTripsDashboard = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM view_trip_vehicle");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trips dashboard" });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const pool = await poolPromise;
    const [usersR, tripsR, vehiclesR, allVehiclesR, ratingsR, revenueR, complaintsR, driversR] = await Promise.all([
      pool.request().query("SELECT COUNT(*) AS total FROM users"),
      pool.request().query("SELECT COUNT(*) AS total FROM trips WHERE LOWER(status) IN ('ongoing','active')"),
      pool.request().query("SELECT COUNT(*) AS total FROM vehicles WHERE LOWER(status)='active'"),
      pool.request().query("SELECT COUNT(*) AS total FROM vehicles WHERE status != 'deleted'"),
      pool.request().query("SELECT AVG(CAST(rating AS FLOAT)) AS avg_rating FROM ratings"),
      // Today's revenue, Lebanon local day (UTC+2/+3 with DST), net of refunds.
      // Counts fare debits and subtracts same-day refund credits; wallet top-ups
      // and other non-refund credits are ignored.
      pool.request().query(`
        SELECT ISNULL(SUM(
          CASE
            WHEN type = 'debit'                                  THEN amount
            WHEN type = 'credit' AND description LIKE 'Refund%'  THEN -amount
            ELSE 0
          END
        ), 0) AS total
        FROM wallet_transactions
        WHERE CAST(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE)
            = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE)
      `),
      pool.request().query(`
        SELECT COUNT(*) AS total FROM complaints
        WHERE LOWER(status) NOT IN ('resolved', 'closed')
      `),
      pool.request().query("SELECT COUNT(*) AS total FROM drivers WHERE is_deleted = 0"),
    ]);
    res.json({
      totalUsers:        usersR.recordset[0].total,
      activeTrips:       tripsR.recordset[0].total,
      activeVehicles:    vehiclesR.recordset[0].total,
      totalVehicles:     allVehiclesR.recordset[0].total,
      avgRating:         ratingsR.recordset[0].avg_rating || 0,
      todayRevenue:      Number(revenueR.recordset[0].total) || 0,
      pendingComplaints: complaintsR.recordset[0].total,
      totalDrivers:      driversR.recordset[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/overview
// Returns all data needed by DashboardPage in one round-trip:
//   trips       — top 5 non-completed trips
//   vehicles    — top 6 vehicles with active trip/driver info
//   fleet       — vehicle status breakdown
//   drivers     — top 4 drivers by rating (last 7 days)
//   week        — 7-day trip counts + revenue (wallet debit sums)
//   rev_summary — this_week / last_week totals for the revenue panel
//   load_hours  — ticket bookings by hour today (normalised to 0-100)
//   alerts      — 5 most recent notifications
// ─────────────────────────────────────────────────────────────────────────────
export const getDashboardOverview = async (req, res) => {
  try {
    const pool = await poolPromise;

    const [tripsR, vehiclesR, fleetR, driversR, weekR, revR, loadR, alertsR] =
      await Promise.all([

        // 1. Active / non-completed trips
        pool.request().query(`
          SELECT TOP 5
            t.trip_id, t.route_id, t.status, t.start_time,
            r.route_name, r.start_location, r.end_location,
            u.full_name AS driver_name,
            v.plate_number, v.capacity,
            (SELECT COUNT(*) FROM tickets tk WHERE tk.trip_id = t.trip_id) AS passengers
          FROM trips t
          LEFT JOIN routes   r ON r.route_id  = t.route_id
          LEFT JOIN drivers  d ON d.driver_id = t.driver_id
          LEFT JOIN users    u ON u.user_id   = d.user_id
          LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
          WHERE LOWER(ISNULL(t.status,'scheduled')) NOT IN ('completed','cancelled')
          ORDER BY t.start_time DESC
        `),

        // 2. Live vehicle tracking panel
        pool.request().query(`
          SELECT TOP 6
            v.plate_number,
            LOWER(v.status) AS status,
            u.full_name     AS driver_name,
            r.route_name
          FROM vehicles v
          LEFT JOIN (
            SELECT vehicle_id, driver_id, route_id,
                   ROW_NUMBER() OVER (PARTITION BY vehicle_id ORDER BY start_time DESC) AS rn
            FROM trips
            WHERE LOWER(ISNULL(status,'')) NOT IN ('completed','cancelled')
          ) t ON t.vehicle_id = v.vehicle_id AND t.rn = 1
          LEFT JOIN drivers d ON d.driver_id = t.driver_id
          LEFT JOIN users   u ON u.user_id   = d.user_id
          LEFT JOIN routes  r ON r.route_id  = t.route_id
          WHERE v.status != 'deleted'
          ORDER BY CASE WHEN LOWER(v.status)='active' THEN 0 ELSE 1 END, v.vehicle_id
        `),

        // 3. Fleet status breakdown
        pool.request().query(`
          SELECT LOWER(status) AS status, COUNT(*) AS cnt
          FROM vehicles WHERE status != 'deleted'
          GROUP BY LOWER(status)
        `),

        // 4. Driver leaderboard (last 7 days)
        pool.request().query(`
          SELECT TOP 4
            u.full_name,
            COUNT(DISTINCT t.trip_id)                       AS trips,
            ROUND(ISNULL(AVG(CAST(ra.rating AS FLOAT)), 0), 1) AS avg_rating
          FROM drivers d
          JOIN users u ON u.user_id = d.user_id
          LEFT JOIN trips t  ON t.driver_id = d.driver_id
            AND t.start_time >= DATEADD(day, -7, GETUTCDATE())
          LEFT JOIN ratings ra ON ra.trip_id = t.trip_id
          WHERE d.is_deleted = 0
          GROUP BY u.full_name
          ORDER BY avg_rating DESC, trips DESC
        `),

        // 5. 7-day trip counts + revenue (Lebanon local day, net of refunds)
        pool.request().query(`
          WITH days AS (
            SELECT DATEADD(day, n.n,
              DATEADD(day, -6, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE))) AS dt
            FROM (VALUES(0),(1),(2),(3),(4),(5),(6)) n(n)
          )
          SELECT
            LEFT(DATENAME(WEEKDAY, d.dt), 3)    AS day,
            (SELECT COUNT(*) FROM trips t
             WHERE CAST(t.start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE) = d.dt) AS trips,
            ISNULL((SELECT SUM(CASE
                      WHEN wt.type='debit'                                 THEN wt.amount
                      WHEN wt.type='credit' AND wt.description LIKE 'Refund%' THEN -wt.amount
                      ELSE 0 END)
             FROM wallet_transactions wt
             WHERE CAST(wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE) = d.dt), 0) AS rev
          FROM days d
          ORDER BY d.dt
        `),

        // 6. This-week vs last-week revenue totals (Lebanon local day, net of refunds)
        pool.request().query(`
          SELECT
            ISNULL(SUM(CASE WHEN local_dt >= DATEADD(day,-6,  today) THEN net END), 0) AS this_week,
            ISNULL(SUM(CASE WHEN local_dt >= DATEADD(day,-13, today)
                             AND local_dt <  DATEADD(day,-6,  today) THEN net END), 0) AS last_week
          FROM (
            SELECT
              CAST(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE) AS local_dt,
              CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE)            AS today,
              CASE
                WHEN type='debit'                                 THEN amount
                WHEN type='credit' AND description LIKE 'Refund%'  THEN -amount
                ELSE 0
              END AS net
            FROM wallet_transactions
          ) x
        `),

        // 7. Passenger load by hour today
        pool.request().query(`
          SELECT DATEPART(HOUR, booking_time) AS hr, COUNT(*) AS cnt
          FROM tickets
          WHERE CAST(booking_time AS DATE) = CAST(GETUTCDATE() AS DATE)
          GROUP BY DATEPART(HOUR, booking_time)
        `),

        // 8. Recent notifications as alerts
        pool.request().query(`
          SELECT TOP 5 notification_id, message, created_at
          FROM notifications
          ORDER BY created_at DESC
        `),
      ]);

    // ── trips ──────────────────────────────────────────────────────────────────
    const trips = tripsR.recordset.map(t => {
      const cap = t.capacity ?? 30;
      const pax = t.passengers ?? 0;
      const st  = t.start_time ? new Date(t.start_time) : null;
      return {
        id:       `TRP-${String(t.trip_id).padStart(3, "0")}`,
        route_id: t.route_id ?? null,
        route:    t.route_name ?? "—",
        name:   (t.start_location && t.end_location)
                  ? `${t.start_location} → ${t.end_location}`
                  : t.route_name ?? "—",
        seats:  `${pax}/${cap}`,
        eta:    st ? st.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
        status: _cap(t.status ?? "Scheduled"),
      };
    });

    // ── vehicles ───────────────────────────────────────────────────────────────
    const vehicles = vehiclesR.recordset.map(v => ({
      id:       v.plate_number,
      driver:   v.driver_name ?? "—",
      speed:    0,       // real-time speed not stored in DB
      location: v.route_name ?? "—",
      fuel:     null,    // fuel level not tracked in DB
      status:   _cap(v.status ?? "Unknown"),
    }));

    // ── fleet ──────────────────────────────────────────────────────────────────
    const fm = {};
    let totalVehicles = 0;
    for (const r of fleetR.recordset) { fm[r.status] = r.cnt; totalVehicles += r.cnt; }
    const fleet = [
      { label: "Active",      count: fm["active"]      ?? 0, total: totalVehicles, color: "#10B981" },
      { label: "Maintenance", count: fm["maintenance"] ?? 0, total: totalVehicles, color: "#F59E0B" },
      { label: "Offline",     count: (fm["inactive"] ?? 0) + (fm["offline"] ?? 0), total: totalVehicles, color: "#EF4444" },
    ];

    // ── drivers ────────────────────────────────────────────────────────────────
    const drivers = driversR.recordset.map(d => ({
      initials: d.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      name:     d.full_name,
      trips:    d.trips,
      rating:   parseFloat(d.avg_rating) || 0,
      change:   "—",
    }));

    // ── week ───────────────────────────────────────────────────────────────────
    const week = weekR.recordset.map(r => ({
      day:   r.day,
      trips: r.trips,
      rev:   parseFloat(r.rev),
    }));

    // ── rev_summary ────────────────────────────────────────────────────────────
    const revRow       = revR.recordset[0] ?? { this_week: 0, last_week: 0 };
    const thisWeekRev  = parseFloat(revRow.this_week)  || 0;
    const lastWeekRev  = parseFloat(revRow.last_week)  || 0;
    const revChangePct = lastWeekRev > 0
      ? Math.round(((thisWeekRev - lastWeekRev) / lastWeekRev) * 100)
      : 0;
    const rev_summary  = { this_week: thisWeekRev, last_week: lastWeekRev, change_pct: revChangePct };

    // ── load_hours ─────────────────────────────────────────────────────────────
    const hourMap  = {};
    for (const r of loadR.recordset) hourMap[r.hr] = r.cnt;
    const maxLoad  = Math.max(...Object.values(hourMap), 1);
    const nowHour  = new Date().getHours();
    const HOUR_SLOTS = [[6,"6am"],[8,"8am"],[9,"9am"],[11,"11am"],[13,"1pm"],[15,"3pm"],[17,"5pm"]];
    const load_hours = HOUR_SLOTS.map(([h, label]) => {
      const pct = Math.round(((hourMap[h] ?? 0) / maxLoad) * 100);
      const obj = { label, pct };
      if (h === nowHour) obj.current = true;
      if (h > nowHour)  obj.future  = true;
      return obj;
    });

    // ── alerts ─────────────────────────────────────────────────────────────────
    const alerts = alertsR.recordset.map(n => ({
      type: "info",
      text: n.message ?? "(no message)",
      time: _ago(n.created_at),
    }));

    res.json({ trips, vehicles, fleet, drivers, week, rev_summary, load_hours, alerts, totalVehicles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch dashboard overview" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/issues
// Returns all non-emergency issues with driver, vehicle context and derived
// category/priority fields. Status is not stored in DB yet — defaults to 'open'.
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminIssues = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 200
        i.issue_id,
        i.driver_id,
        i.trip_id,
        i.description,
        i.created_at,
        u.full_name    AS driver_name,
        v.plate_number AS vehicle,
        CASE WHEN i.trip_id IS NULL THEN NULL
             ELSE CONCAT('TRP-', RIGHT('000' + CAST(i.trip_id AS VARCHAR), 3))
        END AS trip_ref
      FROM issues i
      LEFT JOIN drivers  d ON d.driver_id  = i.driver_id
      LEFT JOIN users    u ON u.user_id    = d.user_id
      LEFT JOIN trips    t ON t.trip_id    = i.trip_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      WHERE i.description NOT LIKE 'EMERGENCY:%'
      ORDER BY i.created_at DESC
    `);

    res.json(result.recordset.map(r => ({
      ...r,
      status:   'open',
      category: _issueCategory(r.description),
      priority: _issuePriority(r.description),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
};

function _issueCategory(desc = '') {
  const d = desc.toLowerCase();
  if (d.match(/brake|engine|tire|wheel|oil|fuel|mechanical|ac|heat|wiper|light/)) return 'Mechanical';
  if (d.match(/passenger|fight|argument|injury|medical/)) return 'Passenger Incident';
  if (d.match(/road|block|police|checkpoint|obstruct|reroute/)) return 'Road Obstruction';
  if (d.match(/suspicious|security|theft|weapon/)) return 'Security';
  return 'General';
}

function _issuePriority(desc = '') {
  const d = desc.toLowerCase();
  if (d.match(/brake|fire|collision|injury|weapon|suspicious|soft|broken/)) return 'high';
  if (d.match(/ac|wiper|radio|light|noise/)) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/emergency-alerts
// Returns all emergency alerts (issues with EMERGENCY: prefix) joined with
// driver name and vehicle, newest first.
// ─────────────────────────────────────────────────────────────────────────────
export const getEmergencyAlerts = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 50
        i.issue_id  AS id,
        i.driver_id,
        i.trip_id,
        LTRIM(SUBSTRING(i.description, 11, LEN(i.description))) AS message,
        i.created_at,
        u.full_name    AS driver_name,
        v.plate_number AS vehicle,
        CASE WHEN i.trip_id IS NULL THEN NULL
             ELSE CONCAT('TRP-', RIGHT('000' + CAST(i.trip_id AS VARCHAR), 3))
        END AS trip_ref
      FROM issues i
      LEFT JOIN drivers  d ON d.driver_id  = i.driver_id
      LEFT JOIN users    u ON u.user_id    = d.user_id
      LEFT JOIN trips    t ON t.trip_id    = i.trip_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      WHERE i.description LIKE 'EMERGENCY:%'
      ORDER BY i.created_at DESC
    `);
    res.json(result.recordset.map(r => ({ ...r, status: 'active' })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch emergency alerts' });
  }
};

function _cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function _ago(date) {
  if (!date) return "—";
  const min = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h  < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
