import { poolPromise, sql } from "../db/db.js";

// POST /api/drivers
export const createDriver = async (req, res) => {
  try {
    const { user_id, license_number, hire_date, license_expiry_date } = req.body;
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("user_id",             sql.Int,     user_id)
      .input("license",             sql.VarChar,  license_number)
      .input("hire_date",           sql.Date,     hire_date)
      .input("license_expiry_date", sql.Date,     license_expiry_date || null)
      .query(`
        INSERT INTO drivers(user_id, license_number, hire_date, license_expiry_date)
        OUTPUT INSERTED.driver_id
        VALUES(@user_id, @license, @hire_date, @license_expiry_date)
      `);

    const driver_id = result.recordset[0].driver_id;
    res.status(201).json({ message: "Driver created successfully", driver_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create driver" });
  }
};

// GET /api/drivers
export const getDrivers = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(200, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const { search } = req.query;

    const build = () => {
      const r = pool.request()
        .input("limit",  sql.Int, limit)
        .input("offset", sql.Int, offset);
      let where = "WHERE d.is_deleted = 0";
      if (search) {
        r.input("search", sql.NVarChar(200), `%${search}%`);
        where += " AND (u.full_name LIKE @search OR u.email LIKE @search OR d.license_number LIKE @search)";
      }
      return { r, where };
    };

    const { r: cr, where } = build();
    const countRes = await cr.query(`SELECT COUNT(*) AS total FROM drivers d JOIN users u ON d.user_id=u.user_id ${where}`);

    const { r: dr } = build();
    const dataRes  = await dr.query(`
      SELECT
        d.driver_id,
        d.user_id,
        u.full_name,
        u.email,
        u.phone,
        d.license_number,
        d.hire_date,
        CONVERT(VARCHAR(10), d.license_expiry_date, 23) AS license_expiry
      FROM drivers d
      JOIN users u ON d.user_id = u.user_id
      ${where}
      ORDER BY u.full_name
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({ total: countRes.recordset[0].total, page, limit, data: dataRes.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
};

// GET /api/drivers/:id
export const getDriverById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          d.driver_id,
          u.full_name,
          u.email,
          u.phone,
          d.license_number,
          d.hire_date,
          CONVERT(VARCHAR(10), d.license_expiry_date, 23) AS license_expiry
        FROM drivers d
        JOIN users u ON d.user_id = u.user_id
        WHERE d.driver_id=@id
      `);
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch driver" });
  }
};

// GET /api/drivers/performance
export const getDriverPerformance = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      -- Per-day work span minus active-trip time = idle time within shifts
      WITH trip_stats AS (
        SELECT
          t.driver_id,
          CAST(t.start_time AS DATE)                                          AS work_date,
          MIN(t.start_time)                                                   AS first_start,
          MAX(ISNULL(t.end_time, t.start_time))                               AS last_end,
          SUM(DATEDIFF(MINUTE, t.start_time, ISNULL(t.end_time, t.start_time))) AS active_minutes
        FROM trips t
        WHERE t.start_time >= DATEADD(day, -7, GETUTCDATE())
          AND t.status IN ('completed', 'ongoing', 'in_progress')
          AND t.driver_id IS NOT NULL
        GROUP BY t.driver_id, CAST(t.start_time AS DATE)
      ),
      idle_agg AS (
        SELECT
          driver_id,
          CAST(
            SUM(
              CASE
                WHEN DATEDIFF(MINUTE, first_start, last_end) > active_minutes
                THEN DATEDIFF(MINUTE, first_start, last_end) - active_minutes
                ELSE 0
              END
            ) / 60.0
          AS DECIMAL(6,1)) AS idle_hours
        FROM trip_stats
        GROUP BY driver_id
      )
      SELECT
        d.driver_id,
        d.user_id,
        u.full_name                                                           AS name,
        COUNT(DISTINCT t.trip_id)                                             AS trips_week,
        ROUND(
          100.0 * SUM(CASE WHEN LOWER(ISNULL(t.status,'')) != 'delayed' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(t.trip_id), 0), 0)                                   AS on_time_pct,
        COUNT(CASE WHEN r.rating <= 2 THEN 1 END)                            AS complaints,
        ROUND(AVG(CAST(r.rating AS FLOAT)), 1)                               AS avg_rating,
        ISNULL(ia.idle_hours, 0.0)                                            AS idle_hours
      FROM drivers d
      JOIN  users u   ON d.user_id    = u.user_id
      LEFT JOIN trips t  ON t.driver_id = d.driver_id
        AND t.start_time >= DATEADD(day, -7, GETUTCDATE())
      LEFT JOIN ratings r ON r.trip_id = t.trip_id
      LEFT JOIN idle_agg ia ON ia.driver_id = d.driver_id
      WHERE d.is_deleted = 0
      GROUP BY d.driver_id, d.user_id, u.full_name, ia.idle_hours
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch driver performance" });
  }
};

// GET /api/drivers/schedules
export const getDriverSchedules = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        ds.schedule_id, ds.driver_id, d.user_id,
        u.full_name AS driver_name,
        ds.mon, ds.tue, ds.wed, ds.thu, ds.fri, ds.sat, ds.sun
      FROM driver_schedules ds
      JOIN drivers d ON ds.driver_id = d.driver_id
      JOIN users   u ON d.user_id    = u.user_id
    `);
    res.json(result.recordset);
  } catch (_err) {
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
};

// GET /api/drivers/available
// Passenger-accessible — no admin permission required.
// ?mode=now          → drivers not currently on an active trip
// ?mode=scheduled&datetime=2026-06-09T10:00:00  → drivers free during that slot
export const getAvailableDrivers = async (req, res) => {
  try {
    const { mode, datetime } = req.query;
    const pool = await poolPromise;

    let requestedAt;
    if (mode === 'scheduled' && datetime) {
      requestedAt = new Date(datetime);
      if (isNaN(requestedAt.getTime())) {
        return res.status(400).json({ error: 'Invalid datetime' });
      }
    } else {
      requestedAt = new Date();
    }

    // "now" mode: driver is busy if they have an ACTIVE trip right now (ongoing/in_progress only).
    // "scheduled" mode: driver is busy if any non-completed trip overlaps the requested 2-hour slot.
    // Note: 'scheduled' status is intentionally excluded from the "now" check — a scheduled trip
    // with a past start_time and no end_time (stale/never-started) must not block a driver now.
    const busyWhere = mode === 'now'
      ? `ct.status IN ('ongoing', 'in_progress')`
      : `ct.status NOT IN ('completed', 'cancelled')
         AND ct.start_time < DATEADD(HOUR, 2, @requestedAt)
         AND ISNULL(ct.end_time, DATEADD(HOUR, 2, ct.start_time)) > DATEADD(MINUTE, -30, @requestedAt)`;

    const result = await pool.request()
      .input('requestedAt', sql.DateTime2, requestedAt)
      .query(`
        SELECT
          d.driver_id,
          u.full_name                   AS name,
          u.phone,
          ISNULL(rs.avg_rating,    0.0) AS avg_rating,
          ISNULL(rs.total_ratings, 0)   AS total_ratings,
          lv.vehicle_id,
          veh.plate_number,
          veh.color,
          veh.model,
          gpsPos.current_lat,
          gpsPos.current_lng
        FROM drivers d
        JOIN users u ON d.user_id = u.user_id
        -- latest vehicle assigned to this driver (via most recent trip)
        LEFT JOIN (
          SELECT driver_id, MAX(vehicle_id) AS vehicle_id
          FROM trips
          WHERE driver_id IS NOT NULL AND vehicle_id IS NOT NULL
          GROUP BY driver_id
        ) lv ON lv.driver_id = d.driver_id
        LEFT JOIN vehicles veh ON veh.vehicle_id = lv.vehicle_id
        -- aggregate rating stats across all trips
        LEFT JOIN (
          SELECT t.driver_id,
                 ROUND(AVG(CAST(r.rating AS FLOAT)), 1) AS avg_rating,
                 COUNT(r.rating_id)                      AS total_ratings
          FROM trips t
          JOIN ratings r ON r.trip_id = t.trip_id
          WHERE t.driver_id IS NOT NULL
          GROUP BY t.driver_id
        ) rs ON rs.driver_id = d.driver_id
        -- latest GPS ping for each driver (across all their trips)
        LEFT JOIN (
          SELECT driver_id, current_lat, current_lng
          FROM (
            SELECT
              t.driver_id,
              CAST(g.latitude  AS FLOAT) AS current_lat,
              CAST(g.longitude AS FLOAT) AS current_lng,
              ROW_NUMBER() OVER (PARTITION BY t.driver_id ORDER BY g.recorded_at DESC) AS rn
            FROM gps_logs g
            JOIN trips t ON t.trip_id = g.trip_id
            WHERE t.driver_id IS NOT NULL
          ) sub
          WHERE sub.rn = 1
        ) gpsPos ON gpsPos.driver_id = d.driver_id
        WHERE ISNULL(d.is_deleted, 0) = 0
          AND NOT EXISTS (
            SELECT 1 FROM trips ct
            WHERE ct.driver_id = d.driver_id
              AND ${busyWhere}
          )
        ORDER BY ISNULL(rs.avg_rating, 0) DESC, u.full_name
      `);

    res.json({ drivers: result.recordset, mode, requestedAt: requestedAt.toISOString() });
  } catch (err) {
    console.error('[getAvailableDrivers]', err);
    res.status(500).json({ error: 'Failed to fetch available drivers' });
  }
};

// DELETE /api/drivers/:id
export const deleteDriver = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE drivers SET is_deleted = 1 WHERE driver_id = @id AND is_deleted = 0");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Driver not found" });
    res.json({ message: "Driver soft-deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete driver" });
  }
};

// PUT /api/drivers/:id/schedule
export const updateDriverSchedule = async (req, res) => {
  try {
    const { Mon, Tue, Wed, Thu, Fri, Sat, Sun } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input("driver_id", sql.Int, req.params.id)
      .input("mon", sql.VarChar, Mon)
      .input("tue", sql.VarChar, Tue)
      .input("wed", sql.VarChar, Wed)
      .input("thu", sql.VarChar, Thu)
      .input("fri", sql.VarChar, Fri)
      .input("sat", sql.VarChar, Sat)
      .input("sun", sql.VarChar, Sun)
      .query(`
        MERGE driver_schedules AS target
        USING (SELECT @driver_id AS driver_id) AS source ON target.driver_id = source.driver_id
        WHEN MATCHED THEN
          UPDATE SET mon=@mon, tue=@tue, wed=@wed, thu=@thu, fri=@fri, sat=@sat, sun=@sun,
                     updated_at=GETUTCDATE()
        WHEN NOT MATCHED THEN
          INSERT (driver_id,mon,tue,wed,thu,fri,sat,sun)
          VALUES (@driver_id,@mon,@tue,@wed,@thu,@fri,@sat,@sun);
      `);
    res.json({ message: "Schedule updated" });
  } catch (err) {
    console.error("[updateDriverSchedule]", err.message);
    res.status(500).json({ error: "Failed to update schedule: " + err.message });
  }
};

// PUT /api/drivers/:id
export const updateDriver = async (req, res) => {
  try {
    const { license_number, hire_date, license_expiry_date } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id",                  sql.Int,     req.params.id)
      .input("license",             sql.VarChar,  license_number)
      .input("hire_date",           sql.Date,     hire_date)
      .input("license_expiry_date", sql.Date,     license_expiry_date || null)
      .query(`
        UPDATE drivers
        SET license_number      = @license,
            hire_date           = @hire_date,
            license_expiry_date = @license_expiry_date
        WHERE driver_id = @id
      `);
    res.json({ message: "Driver updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update driver" });
  }
};
