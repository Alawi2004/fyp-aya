import { poolPromise, sql } from "../db/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/accounts                   ← ADMIN ONLY
// Returns shape the admin StaffPage expects:
//   id, name, email, location, status ("Active"|"Disabled"), today_count,
//   today_total, daily_limit, tx_limit, flagged
// ─────────────────────────────────────────────────────────────────────────────
export const getStaffAccounts = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.created_at,

        -- Today's top-up count
        COUNT(DISTINCT CASE
          WHEN CAST(st.created_at AS DATE) = CAST(GETUTCDATE() AS DATE)
          THEN st.top_up_id END)                                    AS today_count,

        -- Today's total amount
        ISNULL(SUM(CASE
          WHEN CAST(st.created_at AS DATE) = CAST(GETUTCDATE() AS DATE)
          THEN st.amount END), 0)                                   AS today_total,

        -- All-time totals
        COUNT(DISTINCT st.top_up_id)                               AS total_topups,
        ISNULL(SUM(st.amount), 0)                                  AS total_amount,
        MAX(st.created_at)                                         AS last_activity,

        -- Flagged transactions (large amount >= 500 or rapid repeat)
        COUNT(DISTINCT CASE WHEN st.amount >= 500 THEN st.top_up_id END) AS flagged,

        -- Most common recharge location as the "station"
        (SELECT TOP 1 recharge_location
         FROM staff_top_ups
         WHERE processed_by_staff_id = u.user_id
           AND recharge_location IS NOT NULL
         GROUP BY recharge_location
         ORDER BY COUNT(*) DESC)                                   AS location
      FROM users u
      LEFT JOIN staff_top_ups st ON st.processed_by_staff_id = u.user_id
      WHERE u.role NOT IN ('passenger', 'driver')
      GROUP BY u.user_id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at
      ORDER BY u.full_name
    `);

    const records = result.recordset.map(r => ({
      id:          r.user_id,
      name:        r.full_name,
      email:       r.email,
      phone:       r.phone,
      role:        r.role,
      location:    r.location || "Main Station",
      status:      r.status === "active" ? "Active" : "Disabled",
      today_count: r.today_count,
      today_total: parseFloat(r.today_total) || 0,
      total_topups: r.total_topups,
      total_amount: parseFloat(r.total_amount) || 0,
      last_activity: r.last_activity,
      daily_limit: 5000,
      tx_limit:    500,
      flagged:     r.flagged,
    }));

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff accounts" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/staff/accounts/:id               ← ADMIN ONLY
// ─────────────────────────────────────────────────────────────────────────────
export const updateStaffAccount = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status, role, full_name, phone } = req.body;

  if (!status && !role && !full_name && !phone) {
    return res.status(400).json({ error: "Provide at least one field to update" });
  }

  const VALID_ROLES    = ["admin", "staff", "ops_staff", "finance_officer", "transport_manager", "it_admin", "auditor", "super_admin"];
  const VALID_STATUSES = ["active", "inactive", "suspended"];

  // Accept frontend's "Active"/"Disabled" casing too
  const normalizedStatus = status?.toLowerCase() === "active"   ? "active"
                         : status?.toLowerCase() === "disabled" ? "inactive"
                         : status;

  if (role            && !VALID_ROLES.includes(role))                  return res.status(400).json({ error: `Invalid role` });
  if (normalizedStatus && !VALID_STATUSES.includes(normalizedStatus)) return res.status(400).json({ error: `Invalid status` });

  try {
    const pool = await poolPromise;
    const existing = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT user_id, role FROM users WHERE user_id = @id");

    if (!existing.recordset[0])               return res.status(404).json({ error: "User not found" });
    if (existing.recordset[0].role === "passenger") return res.status(400).json({ error: "Cannot modify passenger accounts" });

    const sets = [];
    const r2   = pool.request().input("id", sql.Int, userId);
    if (full_name)        { r2.input("fn", sql.NVarChar(200), full_name);         sets.push("full_name = @fn"); }
    if (phone)            { r2.input("ph", sql.NVarChar(50),  phone);             sets.push("phone = @ph"); }
    if (role)             { r2.input("ro", sql.NVarChar(50),  role);              sets.push("role = @ro"); }
    if (normalizedStatus) { r2.input("st", sql.NVarChar(50),  normalizedStatus);  sets.push("status = @st"); }

    await r2.query(`UPDATE users SET ${sets.join(", ")} WHERE user_id = @id`);
    res.json({ message: "Staff account updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update staff account" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/all-history         ← ADMIN ONLY
// Returns shape StaffPage expects:
//   id, time, staff, passenger, amount, method, location, flags (array)
// ─────────────────────────────────────────────────────────────────────────────
export const getAllStaffTransactions = async (req, res) => {
  try {
    const { from, to, staff_id, user_id } = req.query;
    const pool    = await poolPromise;
    const request = pool.request();

    let where = "WHERE 1=1";
    if (staff_id) { request.input("staffId", sql.Int, parseInt(staff_id, 10)); where += " AND st.processed_by_staff_id = @staffId"; }
    if (user_id)  { request.input("userId",  sql.Int, parseInt(user_id,  10)); where += " AND st.user_id = @userId"; }
    if (from)     { request.input("from", sql.Date, from); where += " AND CAST(st.created_at AS DATE) >= @from"; }
    if (to)       { request.input("to",   sql.Date, to);   where += " AND CAST(st.created_at AS DATE) <= @to"; }

    const result = await request.query(`
      SELECT
        st.top_up_id,
        st.amount,
        st.payment_method,
        st.recharge_location,
        st.status,
        st.created_at,
        s.user_id   AS staff_id,
        s.full_name AS staff_name,
        u.user_id   AS passenger_id,
        u.full_name AS passenger_name,

        -- Suspicious flags
        CASE WHEN st.amount >= 500 THEN 1 ELSE 0 END             AS flag_large,
        (SELECT COUNT(*)
         FROM staff_top_ups st2
         WHERE st2.processed_by_staff_id = st.processed_by_staff_id
           AND st2.user_id = st.user_id
           AND ABS(DATEDIFF(MINUTE, st2.created_at, st.created_at)) <= 30
        )                                                         AS repeat_count
      FROM staff_top_ups st
      JOIN users s ON s.user_id = st.processed_by_staff_id
      JOIN users u ON u.user_id = st.user_id
      ${where}
      ORDER BY st.created_at DESC
    `);

    const rows = result.recordset.map(r => {
      const flags = [];
      if (r.flag_large)        flags.push("large_amount");
      if (r.repeat_count >= 3) flags.push("rapid_sequence");
      if (r.repeat_count >= 2) flags.push("repeat_user");
      return {
        id:        `TX-${String(r.top_up_id).padStart(4, "0")}`,
        staff_id:  r.staff_id,
        staff:     r.staff_name,
        passenger: r.passenger_name,
        amount:    parseFloat(r.amount),
        method:    r.payment_method || "Cash",
        location:  r.recharge_location || "—",
        time:      r.created_at,
        flags,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff transaction history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/suspicious          ← ADMIN ONLY
// ─────────────────────────────────────────────────────────────────────────────
export const getSuspiciousTransactions = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        st.top_up_id,
        st.amount,
        st.payment_method,
        st.recharge_location,
        st.created_at,
        s.user_id   AS staff_id,
        s.full_name AS staff_name,
        u.user_id   AS passenger_id,
        u.full_name AS passenger_name,
        CASE WHEN st.amount >= 500 THEN 1 ELSE 0 END AS flag_large,
        (SELECT COUNT(*)
         FROM staff_top_ups st2
         WHERE st2.processed_by_staff_id = st.processed_by_staff_id
           AND st2.user_id = st.user_id
           AND ABS(DATEDIFF(MINUTE, st2.created_at, st.created_at)) <= 30
        ) AS repeat_count
      FROM staff_top_ups st
      JOIN users s ON s.user_id = st.processed_by_staff_id
      JOIN users u ON u.user_id = st.user_id
      WHERE st.amount >= 500
         OR (SELECT COUNT(*)
             FROM staff_top_ups st2
             WHERE st2.processed_by_staff_id = st.processed_by_staff_id
               AND st2.user_id = st.user_id
               AND ABS(DATEDIFF(MINUTE, st2.created_at, st.created_at)) <= 30
            ) >= 2
      ORDER BY st.created_at DESC
    `);

    const rows = result.recordset.map(r => {
      const flags = [];
      if (r.flag_large)        flags.push("large_amount");
      if (r.repeat_count >= 3) flags.push("rapid_sequence");
      if (r.repeat_count >= 2) flags.push("repeat_user");
      return {
        id:        `TX-${String(r.top_up_id).padStart(4, "0")}`,
        staff_id:  r.staff_id,
        staff:     r.staff_name,
        passenger: r.passenger_name,
        amount:    parseFloat(r.amount),
        method:    r.payment_method || "Cash",
        location:  r.recharge_location || "—",
        time:      r.created_at,
        flags,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch suspicious transactions" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/reconciliation             ← ADMIN ONLY
// Returns shape StaffPage expects:
//   id, date, staff, station, expected, reported, discrepancy, status,
//   cash_txns, total_txns
// ─────────────────────────────────────────────────────────────────────────────
export const getReconciliation = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const pool = await poolPromise;

    const result = await pool.request()
      .input("date", sql.Date, date)
      .query(`
        SELECT
          u.user_id                                             AS staff_id,
          u.full_name                                          AS staff_name,
          COUNT(st.top_up_id)                                  AS total_txns,
          COUNT(CASE WHEN LOWER(ISNULL(st.payment_method,'')) = 'cash' THEN 1 END) AS cash_txns,
          ISNULL(SUM(CASE WHEN LOWER(ISNULL(st.payment_method,'')) = 'cash' THEN st.amount END), 0) AS expected_amount,
          r.reconciliation_id,
          r.actual_amount,
          r.discrepancy,
          r.status,
          r.notes,
          (SELECT TOP 1 recharge_location
           FROM staff_top_ups
           WHERE processed_by_staff_id = u.user_id
             AND CAST(created_at AS DATE) = @date
             AND recharge_location IS NOT NULL
           GROUP BY recharge_location
           ORDER BY COUNT(*) DESC)                            AS station
        FROM staff_top_ups st
        JOIN  users u  ON u.user_id = st.processed_by_staff_id
        LEFT JOIN staff_reconciliation r
          ON r.staff_id = u.user_id
         AND r.reconciliation_date = @date
        WHERE CAST(st.created_at AS DATE) = @date
        GROUP BY u.user_id, u.full_name,
          r.reconciliation_id, r.actual_amount, r.discrepancy,
          r.status, r.notes
        ORDER BY u.full_name
      `);

    const rows = result.recordset.map(r => ({
      id:          r.reconciliation_id ?? r.staff_id,
      date,
      staff:       r.staff_name,
      station:     r.station || "Main Station",
      expected:    parseFloat(r.expected_amount) || 0,
      reported:    r.actual_amount !== null ? parseFloat(r.actual_amount) : null,
      discrepancy: r.discrepancy !== null ? parseFloat(r.discrepancy) : null,
      status:      r.status || "pending",
      notes:       r.notes || null,
      cash_txns:   r.cash_txns,
      total_txns:  r.total_txns,
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reconciliation records" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/staff/reconciliation/:id         ← ADMIN ONLY
// :id may be a reconciliation_id (existing record) or a staff user_id (new
// record — getReconciliation returns staff_id when no record exists yet).
// When the record doesn't exist it is auto-created (UPSERT behaviour).
// ─────────────────────────────────────────────────────────────────────────────
export const updateReconciliation = async (req, res) => {
  const id      = parseInt(req.params.id, 10);
  const adminId = req.user.user_id;
  const { actual_amount, status, notes, date } = req.body;

  const VALID_STATUSES = ["pending", "matched", "discrepancy", "approved", "shortage", "excess"];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const pool = await poolPromise;

    // Try to find the record by its own PK first
    let existing = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT reconciliation_id FROM staff_reconciliation WHERE reconciliation_id = @id");

    let reconciliationId = existing.recordset[0]?.reconciliation_id;

    // If not found by reconciliation_id, treat id as staff_id and upsert for
    // the given date (or today). This covers the case where getReconciliation
    // returns staff_id when no reconciliation record exists yet.
    if (!reconciliationId) {
      const reconcDate = date || new Date().toISOString().slice(0, 10);

      const byStaff = await pool.request()
        .input("staffId", sql.Int,  id)
        .input("date",    sql.Date, reconcDate)
        .query("SELECT reconciliation_id FROM staff_reconciliation WHERE staff_id = @staffId AND reconciliation_date = @date");

      if (byStaff.recordset[0]) {
        reconciliationId = byStaff.recordset[0].reconciliation_id;
      } else {
        // Compute expected cash from cash top-ups for this staff/date
        const expectedRes = await pool.request()
          .input("staffId", sql.Int,  id)
          .input("date",    sql.Date, reconcDate)
          .query(`
            SELECT ISNULL(SUM(CASE WHEN LOWER(ISNULL(payment_method,'')) = 'cash' THEN amount ELSE 0 END), 0) AS expected_amount
            FROM staff_top_ups
            WHERE processed_by_staff_id = @staffId
              AND CAST(created_at AS DATE) = @date
              AND status = 'completed'
          `);
        const expectedAmt = parseFloat(expectedRes.recordset[0]?.expected_amount || 0);

        const inserted = await pool.request()
          .input("staffId",  sql.Int,           id)
          .input("date",     sql.Date,           reconcDate)
          .input("expected", sql.Decimal(10, 2), expectedAmt)
          .query(`
            INSERT INTO staff_reconciliation (staff_id, reconciliation_date, expected_amount, status)
            OUTPUT INSERTED.reconciliation_id
            VALUES (@staffId, @date, @expected, 'pending')
          `);
        reconciliationId = inserted.recordset[0].reconciliation_id;
      }
    }

    const sets = ["reviewed_by = @adminId", "reviewed_at = GETUTCDATE()"];
    const r2   = pool.request()
      .input("id",      sql.Int, reconciliationId)
      .input("adminId", sql.Int, adminId);

    if (actual_amount !== undefined) {
      r2.input("actual", sql.Decimal(10, 2), parseFloat(actual_amount));
      sets.push("actual_amount = @actual", "discrepancy = @actual - expected_amount");
    }
    if (status) { r2.input("status", sql.NVarChar(50), status); sets.push("status = @status"); }
    if (notes !== undefined) { r2.input("notes", sql.NVarChar(500), notes || null); sets.push("notes = @notes"); }

    await r2.query(`UPDATE staff_reconciliation SET ${sets.join(", ")} WHERE reconciliation_id = @id`);
    res.json({ message: "Reconciliation updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update reconciliation" });
  }
};
