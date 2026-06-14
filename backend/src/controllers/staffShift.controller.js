import { poolPromise, sql } from "../db/db.js";
import { ensureOperationalTables } from "../db/featureSetup.js";

const parseMoney = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const getActiveShift = async (pool, staffUserId) => {
  const result = await pool
    .request()
    .input("staffUserId", sql.Int, staffUserId)
    .query(`
      SELECT TOP 1 *
      FROM staff_shift_sessions
      WHERE staff_user_id = @staffUserId
        AND closed_at IS NULL
      ORDER BY opened_at DESC
    `);

  return result.recordset[0] || null;
};

export const openStaffShift = async (req, res) => {
  const openingCash = parseMoney(req.body.opening_cash, 0);
  if (Number.isNaN(openingCash) || openingCash < 0) {
    return res.status(400).json({ error: "opening_cash must be a non-negative number" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const existingShift = await getActiveShift(pool, req.user.user_id);
    if (existingShift) {
      return res.status(409).json({
        error: "An active shift is already open for this staff member",
        active_shift: existingShift,
      });
    }

    const result = await pool
      .request()
      .input("staffUserId", sql.Int, req.user.user_id)
      .input("openingCash", sql.Decimal(10, 2), openingCash)
      .input("openingNotes", sql.NVarChar(500), req.body.notes?.trim() || null)
      .query(`
        INSERT INTO staff_shift_sessions (staff_user_id, opening_cash, opening_notes)
        OUTPUT INSERTED.*
        VALUES (@staffUserId, @openingCash, @openingNotes)
      `);

    res.status(201).json({
      message: "Shift opened successfully",
      shift: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to open staff shift" });
  }
};

export const closeStaffShift = async (req, res) => {
  const closingCash = parseMoney(req.body.closing_cash);
  if (Number.isNaN(closingCash) || closingCash === null || closingCash < 0) {
    return res.status(400).json({ error: "closing_cash must be a non-negative number" });
  }

  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const activeShift = await getActiveShift(pool, req.user.user_id);
    if (!activeShift) {
      return res.status(404).json({ error: "No active shift found to close" });
    }

    const topUpSummary = await pool
      .request()
      .input("staffUserId", sql.Int, req.user.user_id)
      .input("openedAt", sql.DateTime2, activeShift.opened_at)
      .query(`
        IF OBJECT_ID('staff_top_ups', 'U') IS NOT NULL
        BEGIN
          SELECT
            COUNT(*) AS total_transactions,
            ISNULL(SUM(amount), 0) AS total_collected,
            COUNT(CASE WHEN LOWER(payment_method) = 'cash' THEN 1 END) AS cash_transactions,
            ISNULL(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN amount ELSE 0 END), 0) AS cash_collected
          FROM staff_top_ups
          WHERE processed_by_staff_id = @staffUserId
            AND created_at >= @openedAt
            AND status = 'completed'
        END
        ELSE
        BEGIN
          SELECT
            0 AS total_transactions,
            0 AS total_collected,
            0 AS cash_transactions,
            0 AS cash_collected
        END
      `);

    const summary = topUpSummary.recordset[0];
    const expectedCash = Number.parseFloat(activeShift.opening_cash) + Number.parseFloat(summary.cash_collected || 0);
    const difference = closingCash - expectedCash;
    const summaryPayload = {
      total_transactions: summary.total_transactions,
      total_collected: Number.parseFloat(summary.total_collected || 0),
      cash_transactions: summary.cash_transactions,
      cash_collected: Number.parseFloat(summary.cash_collected || 0),
    };

    const result = await pool
      .request()
      .input("shiftId", sql.Int, activeShift.shift_id)
      .input("expectedCash", sql.Decimal(10, 2), expectedCash)
      .input("closingCash", sql.Decimal(10, 2), closingCash)
      .input("difference", sql.Decimal(10, 2), difference)
      .input("closingNotes", sql.NVarChar(500), req.body.notes?.trim() || null)
      .input("summaryJson", sql.NVarChar(sql.MAX), JSON.stringify(summaryPayload))
      .query(`
        UPDATE staff_shift_sessions
        SET expected_cash   = @expectedCash,
            closing_cash    = @closingCash,
            cash_difference = @difference,
            closing_notes   = @closingNotes,
            summary_json    = @summaryJson,
            closed_at       = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE shift_id = @shiftId
      `);

    res.json({
      message: "Shift closed successfully",
      shift: result.recordset[0],
      cash_summary: {
        opening_cash: Number.parseFloat(activeShift.opening_cash),
        expected_cash: expectedCash,
        reported_closing_cash: closingCash,
        difference,
        ...summaryPayload,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to close staff shift" });
  }
};

export const getCurrentStaffShift = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);
    const activeShift = await getActiveShift(pool, req.user.user_id);
    res.json(activeShift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch current shift" });
  }
};

export const getShiftHistory = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureOperationalTables(pool);

    const result = await pool
      .request()
      .input("staffUserId", sql.Int, req.user.user_id)
      .query(`
        SELECT
          sss.shift_id,
          sss.opening_cash,
          sss.expected_cash,
          sss.closing_cash,
          sss.cash_difference,
          sss.opened_at,
          sss.closed_at,
          sss.opening_notes,
          sss.closing_notes,
          sss.summary_json,
          u.full_name  AS staff_name,
          u.email      AS staff_email
        FROM staff_shift_sessions sss
        JOIN users u ON sss.staff_user_id = u.user_id
        WHERE sss.staff_user_id = @staffUserId
        ORDER BY sss.opened_at DESC
      `);

    const shifts = result.recordset.map(row => {
      let summary = null;
      try { summary = JSON.parse(row.summary_json); } catch {}
      return {
        shift_id:           row.shift_id,
        staff_name:         row.staff_name,
        staff_email:        row.staff_email,
        location:           row.opening_notes || "—",
        opening_cash:       parseFloat(row.opening_cash  || 0),
        expected_cash:      row.expected_cash  != null ? parseFloat(row.expected_cash)  : null,
        closing_cash:       row.closing_cash   != null ? parseFloat(row.closing_cash)   : null,
        cash_difference:    row.cash_difference != null ? parseFloat(row.cash_difference) : null,
        opened_at:          row.opened_at,
        closed_at:          row.closed_at,
        closing_notes:      row.closing_notes  || null,
        total_transactions: summary?.total_transactions ?? null,
        total_collected:    summary?.total_collected    != null ? parseFloat(summary.total_collected)    : null,
        cash_collected:     summary?.cash_collected     != null ? parseFloat(summary.cash_collected)     : null,
        status:             row.closed_at ? "closed" : "active",
      };
    });

    res.json(shifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shift history" });
  }
};
