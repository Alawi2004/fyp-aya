import { poolPromise, sql } from "../db/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/accounts                   ← ADMIN ONLY
// Lists all non-passenger, non-driver system accounts (staff roles).
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
        COUNT(DISTINCT st.top_up_id)            AS total_topups,
        ISNULL(SUM(st.amount), 0)               AS total_amount,
        MAX(st.created_at)                       AS last_activity
      FROM users u
      LEFT JOIN staff_top_ups st ON st.processed_by_staff_id = u.user_id
      WHERE u.role NOT IN ('passenger', 'driver')
      GROUP BY
        u.user_id, u.full_name, u.email, u.phone,
        u.role, u.status, u.created_at
      ORDER BY u.full_name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff accounts" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/staff/accounts/:id               ← ADMIN ONLY
// Updates a staff account's status and/or role.
// Body: { status?, role?, full_name?, phone? }
// ─────────────────────────────────────────────────────────────────────────────
export const updateStaffAccount = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status, role, full_name, phone } = req.body;

  if (!status && !role && !full_name && !phone) {
    return res.status(400).json({ error: "Provide at least one field to update (status, role, full_name, phone)" });
  }

  const VALID_ROLES   = ["admin", "staff", "ops_staff", "finance_officer", "transport_manager", "it_admin", "auditor", "super_admin"];
  const VALID_STATUSES = ["active", "inactive", "suspended"];

  if (role   && !VALID_ROLES.includes(role))     return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` });
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });

  try {
    const pool = await poolPromise;

    const existing = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT user_id, role FROM users WHERE user_id = @id");

    if (!existing.recordset[0]) return res.status(404).json({ error: "User not found" });
    if (existing.recordset[0].role === "passenger") return res.status(400).json({ error: "Cannot modify passenger accounts from this endpoint" });

    const sets  = [];
    const req2  = pool.request().input("id", sql.Int, userId);

    if (full_name) { req2.input("full_name", sql.NVarChar(200), full_name); sets.push("full_name = @full_name"); }
    if (phone)     { req2.input("phone",     sql.NVarChar(50),  phone);     sets.push("phone = @phone"); }
    if (role)      { req2.input("role",      sql.NVarChar(50),  role);      sets.push("role = @role"); }
    if (status)    { req2.input("status",    sql.NVarChar(50),  status);    sets.push("status = @status"); }

    await req2.query(`UPDATE users SET ${sets.join(", ")} WHERE user_id = @id`);

    res.json({ message: "Staff account updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update staff account" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/all-history         ← ADMIN ONLY
// Full view of every top-up processed by any staff member.
// Supports: ?from=YYYY-MM-DD&to=YYYY-MM-DD&staff_id=X&user_id=Y
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
        st.balance_before,
        st.balance_after,
        st.payment_method,
        st.recharge_location,
        st.transaction_reference,
        st.notes,
        st.status,
        st.created_at,
        s.user_id     AS staff_id,
        s.full_name   AS staff_name,
        s.email       AS staff_email,
        u.user_id     AS passenger_id,
        u.full_name   AS passenger_name,
        u.email       AS passenger_email
      FROM staff_top_ups st
      JOIN users s ON s.user_id = st.processed_by_staff_id
      JOIN users u ON u.user_id = st.user_id
      ${where}
      ORDER BY st.created_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff transaction history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/suspicious          ← ADMIN ONLY
// Returns top-ups flagged for:
//   • amount ≥ 1000 (unusually large)
//   • ≥ 3 top-ups by the same staff to the same passenger within 1 hour
//   • processed outside business hours (before 07:00 or after 22:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────
export const getSuspiciousTransactions = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      WITH flagged AS (
        -- Flag 1: large single top-up
        SELECT
          st.top_up_id,
          'Large Amount'  AS flag_reason,
          st.amount,
          st.created_at,
          st.processed_by_staff_id,
          st.user_id,
          st.payment_method,
          st.recharge_location,
          st.transaction_reference,
          st.balance_before,
          st.balance_after
        FROM staff_top_ups st
        WHERE st.amount >= 1000

        UNION

        -- Flag 2: out-of-hours (before 07:00 or after 22:00 UTC)
        SELECT
          st.top_up_id,
          'Out of Hours'  AS flag_reason,
          st.amount,
          st.created_at,
          st.processed_by_staff_id,
          st.user_id,
          st.payment_method,
          st.recharge_location,
          st.transaction_reference,
          st.balance_before,
          st.balance_after
        FROM staff_top_ups st
        WHERE DATEPART(HOUR, st.created_at) < 7
           OR DATEPART(HOUR, st.created_at) >= 22

        UNION

        -- Flag 3: rapid repeat (same staff → same passenger, ≥ 3 times within 60 min)
        SELECT
          st.top_up_id,
          'Rapid Repeat'  AS flag_reason,
          st.amount,
          st.created_at,
          st.processed_by_staff_id,
          st.user_id,
          st.payment_method,
          st.recharge_location,
          st.transaction_reference,
          st.balance_before,
          st.balance_after
        FROM staff_top_ups st
        WHERE (
          SELECT COUNT(*)
          FROM staff_top_ups st2
          WHERE st2.processed_by_staff_id = st.processed_by_staff_id
            AND st2.user_id = st.user_id
            AND ABS(DATEDIFF(MINUTE, st2.created_at, st.created_at)) <= 60
        ) >= 3
      )
      SELECT DISTINCT
        f.top_up_id,
        STRING_AGG(f.flag_reason, ', ') OVER (PARTITION BY f.top_up_id) AS flags,
        f.amount,
        f.balance_before,
        f.balance_after,
        f.payment_method,
        f.recharge_location,
        f.transaction_reference,
        f.created_at,
        s.user_id   AS staff_id,
        s.full_name AS staff_name,
        s.email     AS staff_email,
        u.user_id   AS passenger_id,
        u.full_name AS passenger_name,
        u.email     AS passenger_email
      FROM flagged f
      JOIN users s ON s.user_id = f.processed_by_staff_id
      JOIN users u ON u.user_id = f.user_id
      ORDER BY f.created_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch suspicious transactions" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/reconciliation             ← ADMIN ONLY
// Returns per-staff reconciliation records for a given date.
// Query: ?date=YYYY-MM-DD (defaults to today)
// Aggregates expected amounts from staff_top_ups and joins with
// staff_reconciliation records for declared actual amounts.
// ─────────────────────────────────────────────────────────────────────────────
export const getReconciliation = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const pool = await poolPromise;

    const result = await pool.request()
      .input("date", sql.Date, date)
      .query(`
        SELECT
          u.user_id                               AS staff_id,
          u.full_name                             AS staff_name,
          u.email                                 AS staff_email,
          COUNT(st.top_up_id)                     AS transaction_count,
          ISNULL(SUM(st.amount), 0)               AS expected_amount,
          r.reconciliation_id,
          r.actual_amount,
          r.discrepancy,
          r.status,
          r.notes,
          r.reviewed_at,
          rv.full_name                            AS reviewed_by
        FROM staff_top_ups st
        JOIN  users u  ON u.user_id = st.processed_by_staff_id
        LEFT JOIN staff_reconciliation r
          ON r.staff_id = u.user_id
         AND r.reconciliation_date = @date
        LEFT JOIN users rv ON rv.user_id = r.reviewed_by
        WHERE CAST(st.created_at AS DATE) = @date
        GROUP BY
          u.user_id, u.full_name, u.email,
          r.reconciliation_id, r.actual_amount, r.discrepancy,
          r.status, r.notes, r.reviewed_at, rv.full_name
        ORDER BY u.full_name
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reconciliation records" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/staff/reconciliation/:id         ← ADMIN ONLY
// Records the actual declared amount and marks reconciliation status.
// Body: { actual_amount, status, notes? }
// ─────────────────────────────────────────────────────────────────────────────
export const updateReconciliation = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const adminId = req.user.user_id;
  const { actual_amount, status, notes } = req.body;

  const VALID_STATUSES = ["pending", "matched", "discrepancy", "approved"];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const pool = await poolPromise;

    const existing = await pool.request()
      .input("id", sql.Int, id)
      .query("SELECT reconciliation_id FROM staff_reconciliation WHERE reconciliation_id = @id");

    if (!existing.recordset[0]) return res.status(404).json({ error: "Reconciliation record not found" });

    const sets  = ["reviewed_by = @adminId", "reviewed_at = GETUTCDATE()"];
    const req2  = pool.request()
      .input("id",      sql.Int, id)
      .input("adminId", sql.Int, adminId);

    if (actual_amount !== undefined) {
      req2.input("actual", sql.Decimal(10, 2), parseFloat(actual_amount));
      sets.push("actual_amount = @actual", "discrepancy = actual_amount - expected_amount");
    }
    if (status) { req2.input("status", sql.NVarChar(50), status); sets.push("status = @status"); }
    if (notes !== undefined) { req2.input("notes", sql.NVarChar(500), notes || null); sets.push("notes = @notes"); }

    await req2.query(`UPDATE staff_reconciliation SET ${sets.join(", ")} WHERE reconciliation_id = @id`);

    res.json({ message: "Reconciliation updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update reconciliation" });
  }
};
