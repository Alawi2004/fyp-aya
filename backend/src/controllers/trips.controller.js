import { poolPromise, sql } from "../db/db.js";

export const createTrip = async (req, res) => {
  const pool = await poolPromise;
  const { vehicle_id, driver_id, route_id, start_time, status } = req.body;

  await pool
    .request()
    .input("vehicle_id", sql.Int, vehicle_id)
    .input("driver_id", sql.Int, driver_id)
    .input("route_id", sql.Int, route_id)
    .input("start_time", sql.DateTime, start_time)
    .input("status", sql.VarChar, status).query(`
      INSERT INTO trips(vehicle_id,driver_id,route_id,start_time,status)
      VALUES(@vehicle_id,@driver_id,@route_id,@start_time,@status)
    `);

  res.status(201).json({ message: "Trip created" });
};

export const getTrips = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(200, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const { search, status, from, to } = req.query;

    const JOINS = `
      FROM trips t
      LEFT JOIN routes r   ON t.route_id   = r.route_id
      LEFT JOIN drivers d  ON t.driver_id  = d.driver_id
      LEFT JOIN users du   ON d.user_id    = du.user_id
      LEFT JOIN vehicles v ON t.vehicle_id = v.vehicle_id
    `;

    const build = () => {
      const r = pool.request()
        .input("limit",  sql.Int, limit)
        .input("offset", sql.Int, offset);
      let where = "WHERE 1=1";
      if (search) { r.input("search", sql.NVarChar(200), `%${search}%`); where += " AND (r.route_name LIKE @search OR du.full_name LIKE @search OR v.plate_number LIKE @search)"; }
      if (status) { r.input("status", sql.NVarChar(50),  status);        where += " AND t.status = @status"; }
      if (from)   { r.input("from",   sql.Date,          from);           where += " AND CAST(t.start_time AS DATE) >= @from"; }
      if (to)     { r.input("to",     sql.Date,          to);             where += " AND CAST(t.start_time AS DATE) <= @to"; }
      return { r, where };
    };

    const { r: cr, where } = build();
    const countRes = await cr.query(`SELECT COUNT(*) AS total ${JOINS} ${where}`);

    const { r: dr } = build();
    const dataRes  = await dr.query(`
      SELECT
        t.trip_id, t.status, t.start_time, t.end_time,
        r.route_name, r.start_location, r.end_location,
        du.full_name AS driver_name,
        v.plate_number, v.model AS vehicle_model, v.capacity
      ${JOINS}
      ${where}
      ORDER BY t.start_time DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({ total: countRes.recordset[0].total, page, limit, data: dataRes.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trips" });
  }
};

export const getTripById = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM trips WHERE trip_id=@id");
    res.json(result.recordset[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trip" });
  }
};

export const updateTripStatus = async (req, res) => {
  const pool = await poolPromise;
  await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .input("status", sql.VarChar, req.body.status)
    .query("UPDATE trips SET status=@status WHERE trip_id=@id");

  res.json({ message: "Trip updated" });
};

export const getTripsByVehicleType = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("p_type", sql.VarChar, req.params.type)
    .execute("get_trips_by_vehicle");

  res.json(result.recordset);
};

export const getPassengerLoad = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().input("id", sql.Int, req.params.id)
    .query(`
      SELECT * FROM view_passenger_load WHERE trip_id=@id
    `);

  res.json(result.recordset[0]);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/conflicts
// Returns all pairs of active/scheduled trips where the same driver or vehicle
// is double-booked across overlapping time windows.
// Trips with no end_time assume a 60-minute duration.
// Response shape matches the client-side detectConflicts() output:
//   [{ type, resource, a: <trip>, b: <trip> }, ...]
// ─────────────────────────────────────────────────────────────────────────────
export const getTripConflicts = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      WITH enriched AS (
        SELECT
          t.trip_id,
          t.driver_id,
          t.vehicle_id,
          t.status,
          t.start_time,
          ISNULL(t.end_time, DATEADD(MINUTE, 60, t.start_time)) AS end_time_eff,
          r.route_name,
          du.full_name   AS driver_name,
          v.plate_number AS vehicle_plate
        FROM trips t
        LEFT JOIN routes   r  ON r.route_id  = t.route_id
        LEFT JOIN drivers  d  ON d.driver_id = t.driver_id
        LEFT JOIN users    du ON du.user_id  = d.user_id
        LEFT JOIN vehicles v  ON v.vehicle_id = t.vehicle_id
        WHERE LOWER(ISNULL(t.status,'scheduled')) NOT IN ('completed','cancelled')
      )
      SELECT
        CASE WHEN a.driver_id IS NOT NULL AND a.driver_id = b.driver_id
             THEN 'driver' ELSE 'vehicle' END                         AS conflict_type,
        CASE WHEN a.driver_id IS NOT NULL AND a.driver_id = b.driver_id
             THEN ISNULL(a.driver_name,'')
             ELSE ISNULL(a.vehicle_plate,'') END                      AS resource,
        a.trip_id        AS a_id,
        a.route_name     AS a_route,
        a.driver_name    AS a_driver,
        a.vehicle_plate  AS a_vehicle,
        CONVERT(VARCHAR(10), a.start_time, 23)  AS a_date,
        CONVERT(VARCHAR(5),  a.start_time, 108) AS a_time,
        a.status         AS a_status,
        b.trip_id        AS b_id,
        b.route_name     AS b_route,
        b.driver_name    AS b_driver,
        b.vehicle_plate  AS b_vehicle,
        CONVERT(VARCHAR(10), b.start_time, 23)  AS b_date,
        CONVERT(VARCHAR(5),  b.start_time, 108) AS b_time,
        b.status         AS b_status
      FROM enriched a
      JOIN enriched b
        ON  a.trip_id < b.trip_id
        AND a.start_time   < b.end_time_eff
        AND b.start_time   < a.end_time_eff
        AND (
              (a.driver_id  IS NOT NULL AND a.driver_id  = b.driver_id)
           OR (a.vehicle_id IS NOT NULL AND a.vehicle_id = b.vehicle_id)
            )
      ORDER BY a_date, a_time
    `);

    const conflicts = result.recordset.map(row => ({
      type:     row.conflict_type,
      resource: row.resource,
      a: {
        id:      row.a_id,
        route:   row.a_route   ?? "",
        driver:  row.a_driver  ?? "",
        vehicle: row.a_vehicle ?? "",
        date:    row.a_date    ?? "",
        time:    row.a_time    ?? "",
        status:  row.a_status  ?? "Scheduled",
      },
      b: {
        id:      row.b_id,
        route:   row.b_route   ?? "",
        driver:  row.b_driver  ?? "",
        vehicle: row.b_vehicle ?? "",
        date:    row.b_date    ?? "",
        time:    row.b_time    ?? "",
        status:  row.b_status  ?? "Scheduled",
      },
    }));

    res.json(conflicts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to detect conflicts" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/recurring
// Returns all recurring schedules ordered by route_name + departure_time.
// ─────────────────────────────────────────────────────────────────────────────
export const getRecurringSchedules = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        schedule_id  AS id,
        route_name   AS route,
        driver_name  AS driver,
        vehicle_plate AS vehicle,
        CONVERT(VARCHAR(5), departure_time, 108) AS time,
        recurrence,
        ISNULL(JSON_QUERY(custom_days), '[]') AS days_json,
        status,
        CONVERT(VARCHAR(10), active_from, 23) AS active_from,
        CONVERT(VARCHAR(10), next_run,    23) AS next_run,
        created_at
      FROM recurring_trip_schedules
      ORDER BY route_name, departure_time
    `);

    const rows = result.recordset.map(r => ({
      ...r,
      days: (() => { try { return JSON.parse(r.days_json); } catch { return []; } })(),
      days_json: undefined,
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recurring schedules" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trips/recurring
// Body: { route, driver?, vehicle?, time, recurrence, days?, status?, active_from, next_run? }
// ─────────────────────────────────────────────────────────────────────────────
export const createRecurringSchedule = async (req, res) => {
  const { route, driver, vehicle, time, recurrence, days, status, active_from, next_run } = req.body;

  if (!route || !time || !recurrence || !active_from) {
    return res.status(400).json({ error: "route, time, recurrence, and active_from are required" });
  }

  const VALID = ["daily", "weekdays", "weekends", "custom"];
  if (!VALID.includes(recurrence)) {
    return res.status(400).json({ error: `recurrence must be one of: ${VALID.join(", ")}` });
  }

  try {
    const pool = await poolPromise;
    const ins  = await pool.request()
      .input("route",    sql.NVarChar(100), route)
      .input("driver",   sql.NVarChar(100), driver   || null)
      .input("vehicle",  sql.NVarChar(50),  vehicle  || null)
      .input("time",     sql.VarChar(8),    time)
      .input("recur",    sql.NVarChar(20),  recurrence)
      .input("days",     sql.NVarChar(200), Array.isArray(days) ? JSON.stringify(days) : null)
      .input("status",   sql.NVarChar(20),  status || "Active")
      .input("from",     sql.Date,          active_from)
      .input("next_run", sql.Date,          next_run || active_from)
      .query(`
        INSERT INTO recurring_trip_schedules
          (route_name, driver_name, vehicle_plate, departure_time,
           recurrence, custom_days, status, active_from, next_run)
        OUTPUT INSERTED.schedule_id
        VALUES
          (@route, @driver, @vehicle, @time, @recur, @days, @status, @from, @next_run)
      `);

    res.status(201).json({ schedule_id: ins.recordset[0].schedule_id, message: "Recurring schedule created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create recurring schedule" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/trips/recurring/:id
// Supports full update or status-only toggle (pause/resume/activate).
// Body: any subset of { route, driver, vehicle, time, recurrence, days, status, active_from, next_run }
// ─────────────────────────────────────────────────────────────────────────────
export const updateRecurringSchedule = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { route, driver, vehicle, time, recurrence, days, status, active_from, next_run } = req.body;

  const sets = [];
  const pool = await poolPromise;
  const req2 = pool.request().input("id", sql.Int, id);

  if (route      !== undefined) { req2.input("route",    sql.NVarChar(100), route);                                       sets.push("route_name = @route"); }
  if (driver     !== undefined) { req2.input("driver",   sql.NVarChar(100), driver || null);                              sets.push("driver_name = @driver"); }
  if (vehicle    !== undefined) { req2.input("vehicle",  sql.NVarChar(50),  vehicle || null);                             sets.push("vehicle_plate = @vehicle"); }
  if (time       !== undefined) { req2.input("time",     sql.VarChar(8),    time);                                        sets.push("departure_time = @time"); }
  if (recurrence !== undefined) { req2.input("recur",    sql.NVarChar(20),  recurrence);                                  sets.push("recurrence = @recur"); }
  if (days       !== undefined) { req2.input("days",     sql.NVarChar(200), Array.isArray(days) ? JSON.stringify(days) : null); sets.push("custom_days = @days"); }
  if (status     !== undefined) { req2.input("status",   sql.NVarChar(20),  status);                                      sets.push("status = @status"); }
  if (active_from!== undefined) { req2.input("from",     sql.Date,          active_from);                                  sets.push("active_from = @from"); }
  if (next_run   !== undefined) { req2.input("next_run", sql.Date,          next_run);                                     sets.push("next_run = @next_run"); }

  if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const result = await req2.query(
      `UPDATE recurring_trip_schedules SET ${sets.join(", ")} WHERE schedule_id = @id`
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Schedule not found" });
    res.json({ message: "Recurring schedule updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update recurring schedule" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/trips/recurring/:id
// Hard deletes the schedule (recurring schedules have no foreign-key children).
// ─────────────────────────────────────────────────────────────────────────────
export const deleteRecurringSchedule = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, parseInt(req.params.id, 10))
      .query("DELETE FROM recurring_trip_schedules WHERE schedule_id = @id");

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Schedule not found" });
    res.json({ message: "Recurring schedule deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete recurring schedule" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/timetable?date=YYYY-MM-DD
// Returns all trips on a given date (defaults to today) with route/driver/vehicle info.
// ─────────────────────────────────────────────────────────────────────────────
export const getTimetableTrips = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const pool = await poolPromise;

    const result = await pool.request()
      .input("date", sql.Date, date)
      .query(`
        SELECT
          t.trip_id                                          AS id,
          r.route_name                                       AS route,
          du.full_name                                       AS driver,
          v.plate_number                                     AS vehicle,
          CONVERT(VARCHAR(10), t.start_time, 23)            AS date,
          CONVERT(VARCHAR(5),  t.start_time, 108)           AS time,
          t.status,
          v.capacity                                         AS seats
        FROM trips t
        LEFT JOIN routes   r  ON r.route_id  = t.route_id
        LEFT JOIN drivers  d  ON d.driver_id = t.driver_id
        LEFT JOIN users    du ON du.user_id  = d.user_id
        LEFT JOIN vehicles v  ON v.vehicle_id = t.vehicle_id
        WHERE CAST(t.start_time AS DATE) = @date
        ORDER BY t.start_time
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch timetable" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/checklists — admin pre-trip checklist audit
// Returns all driver checklist submissions joined with trip/route/driver/vehicle.
// ─────────────────────────────────────────────────────────────────────────────
export const getTripChecklists = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        tc.checklist_id,
        tc.trip_id,
        CONCAT('TRP-', RIGHT('000' + CAST(tc.trip_id AS VARCHAR), 3)) AS trip_ref,
        u.full_name    AS driver,
        v.plate_number AS vehicle,
        r.route_name   AS route,
        tc.fuel_ok,
        tc.lights_ok,
        tc.tires_ok,
        tc.submitted_at
      FROM trip_checklists tc
      LEFT JOIN trips    t ON t.trip_id    = tc.trip_id
      LEFT JOIN routes   r ON r.route_id   = t.route_id
      LEFT JOIN drivers  d ON d.driver_id  = t.driver_id
      LEFT JOIN users    u ON u.user_id    = d.user_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      ORDER BY tc.submitted_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trip checklists' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/:id/arrivals — per-stop arrival data for a trip
// Returns stop arrival records with stop name, scheduled/actual times, delay.
// ─────────────────────────────────────────────────────────────────────────────
export const getTripStopArrivals = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('trip_id', sql.Int, parseInt(req.params.id, 10))
      .query(`
        SELECT
          tsa.trip_stop_arrival_id AS id,
          tsa.stop_id,
          s.stop_name,
          tsa.stop_order,
          tsa.scheduled_arrival_at,
          tsa.actual_arrival_at,
          tsa.delay_seconds,
          tsa.arrival_status,
          tsa.notes
        FROM trip_stop_arrivals tsa
        LEFT JOIN stops s ON s.stop_id = tsa.stop_id
        WHERE tsa.trip_id = @trip_id
        ORDER BY ISNULL(tsa.stop_order, 9999) ASC, tsa.scheduled_arrival_at ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stop arrivals' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trips/delays — admin delay management view
// Returns all delay reports joined with trip, route, driver, vehicle, and
// the count of confirmed/boarded passengers affected.
// ─────────────────────────────────────────────────────────────────────────────
export const getTripDelays = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        td.delay_id,
        td.trip_id,
        CONCAT('TRP-', RIGHT('000' + CAST(td.trip_id AS VARCHAR), 3)) AS trip_ref,
        r.route_name   AS route,
        u.full_name    AS driver,
        v.plate_number AS vehicle,
        td.reason,
        td.delay_minutes,
        td.notes,
        td.reported_at,
        (
          SELECT COUNT(*)
          FROM tickets tk
          WHERE tk.trip_id = td.trip_id
            AND tk.status IN ('confirmed', 'boarded')
        ) AS affected_passengers
      FROM trip_delays td
      LEFT JOIN trips    t ON t.trip_id    = td.trip_id
      LEFT JOIN routes   r ON r.route_id   = t.route_id
      LEFT JOIN drivers  d ON d.driver_id  = t.driver_id
      LEFT JOIN users    u ON u.user_id    = d.user_id
      LEFT JOIN vehicles v ON v.vehicle_id = t.vehicle_id
      ORDER BY td.reported_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trip delays' });
  }
};
