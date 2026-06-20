import { poolPromise, sql } from "../db/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/search?q=<term>
// Searches for a passenger by email, phone, full_name, or numeric user_id.
// Returns user profile + current wallet balance for display in the top-up UI.
// Staff-only endpoint — requireStaffOnly middleware enforced on router.
// ─────────────────────────────────────────────────────────────────────────────
export const searchUser = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Search query must be at least 2 characters" });
  }

  const term = q.trim();
  const isNumeric = /^\d+$/.test(term);

  try {
    const pool = await poolPromise;
    const request = pool.request().input("term", sql.NVarChar(255), `%${term}%`);

    let whereClause = `
      (u.full_name   LIKE @term
    OR u.email       LIKE @term
    OR u.phone       LIKE @term)
    `;

    if (isNumeric) {
      request.input("uid", sql.Int, parseInt(term, 10));
      whereClause += " OR u.user_id = @uid";
    }

    const result = await request.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.created_at,
        ISNULL(w.balance, 0.00) AS balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.user_id
      WHERE u.role = 'passenger'
        AND (${whereClause})
      ORDER BY u.full_name
    `);

    res.json(result.recordset.map(u => ({
      user_id:    u.user_id,
      full_name:  u.full_name,
      email:      u.email,
      phone:      u.phone ?? null,
      role:       u.role,
      status:     u.status ?? "Active",
      joined:     u.created_at?.toISOString?.()?.slice(0, 10) ?? null,
      balance:    parseFloat(u.balance),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User search failed" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/staff/wallet/topup
// Processes an in-person wallet recharge initiated by a staff member.
//
// Body:
//   user_id               — INT, target passenger
//   amount                — DECIMAL > 0
//   payment_method        — string  ("Cash" | "Card" | "Mobile Transfer" | …)
//   recharge_location     — string, physical location where payment was received
//   transaction_reference — string, receipt / reference number (must be unique)
//   notes?                — optional string
//
// Actions (all inside a SQL transaction):
//   1. Verify user exists and is not inactive / blocked
//   2. Check for duplicate transaction_reference
//   3. Record balance_before
//   4. Upsert wallet (create if missing)
//   5. Insert into staff_top_ups (full audit record)
//   6. Insert into wallet_transactions (user-visible ledger)
//   7. Commit and return updated balance
// ─────────────────────────────────────────────────────────────────────────────
export const staffTopUpWallet = async (req, res) => {
  const {
    user_id,
    amount,
    payment_method,
    recharge_location,
    transaction_reference,
    notes,
  } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  const missing = [];
  if (!user_id)               missing.push("user_id");
  if (!amount)                missing.push("amount");
  if (!payment_method)        missing.push("payment_method");
  if (!recharge_location)     missing.push("recharge_location");
  if (!transaction_reference) missing.push("transaction_reference");

  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(", ")}`,
    });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (parsedAmount > 500) {
    return res.status(400).json({ error: "Single top-up cannot exceed $500 per transaction" });
  }

  const staffId = req.user.user_id;

  // Enforce daily limit before opening the transaction
  {
    const pool = await poolPromise;
    const dailyRes = await pool.request()
      .input("staffId", sql.Int, staffId)
      .query(`
        SELECT ISNULL(SUM(amount), 0) AS today_total
        FROM staff_top_ups
        WHERE processed_by_staff_id = @staffId
          AND CAST(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE)
            = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE)
          AND status = 'completed'
      `);
    const todayTotal = parseFloat(dailyRes.recordset[0]?.today_total || 0);
    if (todayTotal + parsedAmount > 5000) {
      return res.status(400).json({
        error: `Daily top-up limit of $5,000 reached (used: $${todayTotal.toFixed(2)}, requested: $${parsedAmount.toFixed(2)})`,
      });
    }
  }
  const pool    = await poolPromise;
  const tx      = pool.transaction();

  try {
    await tx.begin();

    // 1. Verify user exists and is active
    const userRes = await tx
      .request()
      .input("uid", sql.Int, parseInt(user_id, 10))
      .query(`
        SELECT user_id, full_name, email, phone, status, role
        FROM users WHERE user_id = @uid
      `);

    const user = userRes.recordset[0];
    if (!user) {
      await tx.rollback();
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role !== "passenger") {
      await tx.rollback();
      return res.status(400).json({ error: "Only passenger accounts can receive wallet top-ups" });
    }
    const userStatus = (user.status ?? "active").toLowerCase();
    if (userStatus === "inactive" || userStatus === "blocked" || userStatus === "suspended") {
      await tx.rollback();
      return res.status(400).json({
        error: `Cannot top up a ${userStatus} account. Contact an admin to reactivate.`,
      });
    }

    // 2. Check for duplicate transaction_reference
    const dupRes = await tx
      .request()
      .input("txref", sql.NVarChar(100), transaction_reference.trim())
      .query("SELECT 1 FROM staff_top_ups WHERE transaction_reference = @txref");

    if (dupRes.recordset.length > 0) {
      await tx.rollback();
      return res.status(409).json({
        error: "Duplicate transaction reference — this receipt number has already been processed",
      });
    }

    // 3. Get current balance (and wallet_id if it exists)
    const walletRes = await tx
      .request()
      .input("uid", sql.Int, parseInt(user_id, 10))
      .query("SELECT wallet_id, balance FROM wallets WHERE user_id = @uid");

    const balanceBefore = parseFloat(walletRes.recordset[0]?.balance ?? 0);
    const balanceAfter  = balanceBefore + parsedAmount;
    let   walletId      = walletRes.recordset[0]?.wallet_id ?? null;

    // 4. Upsert wallet
    await tx
      .request()
      .input("uid",    sql.Int,            parseInt(user_id, 10))
      .input("amount", sql.Decimal(10, 2), parsedAmount)
      .query(`
        IF EXISTS (SELECT 1 FROM wallets WHERE user_id = @uid)
          UPDATE wallets
          SET balance    = balance + @amount,
              updated_at = GETUTCDATE()
          WHERE user_id = @uid
        ELSE
          INSERT INTO wallets (user_id, balance)
          VALUES (@uid, @amount)
      `);

    // Fetch wallet_id if it was just created
    if (!walletId) {
      const newWallet = await tx
        .request()
        .input("uid", sql.Int, parseInt(user_id, 10))
        .query("SELECT wallet_id FROM wallets WHERE user_id = @uid");
      walletId = newWallet.recordset[0]?.wallet_id ?? null;
    }

    // 5. Insert full audit record into staff_top_ups
    const topUpRes = await tx
      .request()
      .input("uid",     sql.Int,            parseInt(user_id, 10))
      .input("wid",     sql.Int,            walletId)
      .input("amount",  sql.Decimal(10, 2), parsedAmount)
      .input("before",  sql.Decimal(10, 2), balanceBefore)
      .input("after",   sql.Decimal(10, 2), balanceAfter)
      .input("staffId", sql.Int,            staffId)
      .input("loc",     sql.NVarChar(255),  recharge_location.trim())
      .input("method",  sql.NVarChar(100),  payment_method.trim())
      .input("txref",   sql.NVarChar(100),  transaction_reference.trim())
      .input("notes",   sql.NVarChar(500),  notes?.trim() || null)
      .query(`
        INSERT INTO staff_top_ups
          (user_id, wallet_id, amount, transaction_type,
           balance_before, balance_after, processed_by_staff_id,
           recharge_location, payment_method, transaction_reference,
           notes, status, created_at)
        OUTPUT INSERTED.top_up_id
        VALUES
          (@uid, @wid, @amount, 'top_up',
           @before, @after, @staffId,
           @loc, @method, @txref,
           @notes, 'completed', GETUTCDATE())
      `);

    const topUpId = topUpRes.recordset[0].top_up_id;

    // 6. Insert user-visible wallet_transactions ledger row, linked back to the
    //    staff_top_ups audit row so the passenger app can show structured
    //    location / reference / processed-by details.
    await tx
      .request()
      .input("uid",     sql.Int,            parseInt(user_id, 10))
      .input("topUpId", sql.Int,            topUpId)
      .input("amount",  sql.Decimal(10, 2), parsedAmount)
      .input("loc",     sql.NVarChar(255),  recharge_location.trim())
      .input("txref",   sql.NVarChar(100),  transaction_reference.trim())
      .query(`
        INSERT INTO wallet_transactions
          (user_id, staff_top_up_id, type, amount, description, created_at)
        VALUES
          (@uid, @topUpId, 'credit', @amount,
           CONCAT('In-person recharge at ', @loc, ' — Ref: ', @txref),
           GETUTCDATE())
      `);

    await tx.commit();

    res.status(201).json({
      success:             true,
      top_up_id:           topUpId,
      user_name:           user.full_name,
      user_email:          user.email,
      amount_credited:     parsedAmount,
      balance_before:      balanceBefore,
      new_balance:         balanceAfter,
      transaction_reference: transaction_reference.trim(),
      processed_at:        new Date().toISOString(),
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    // SQL unique constraint violation
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: "Duplicate transaction reference" });
    }
    res.status(500).json({ error: "Top-up failed — transaction rolled back" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/history
// Returns only the top-ups processed by the currently authenticated staff member.
// Optional filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&user_id=X&location=Y
// ─────────────────────────────────────────────────────────────────────────────
export const getStaffHistory = async (req, res) => {
  try {
    const staffId   = req.user.user_id;
    const { from, to, user_id, location } = req.query;

    const pool    = await poolPromise;
    const request = pool.request().input("staffId", sql.Int, staffId);

    let where = "WHERE st.processed_by_staff_id = @staffId";
    if (user_id) {
      request.input("uid", sql.Int, parseInt(user_id, 10));
      where += " AND st.user_id = @uid";
    }
    if (location) {
      request.input("loc", sql.NVarChar(255), `%${location}%`);
      where += " AND st.recharge_location LIKE @loc";
    }
    if (from) {
      request.input("from", sql.Date, from);
      where += " AND CAST(st.created_at AS DATE) >= @from";
    }
    if (to) {
      request.input("to", sql.Date, to);
      where += " AND CAST(st.created_at AS DATE) <= @to";
    }

    const result = await request.query(`
      SELECT
        st.top_up_id,
        st.amount,
        st.transaction_type,
        st.balance_before,
        st.balance_after,
        st.recharge_location,
        st.payment_method,
        st.transaction_reference,
        st.notes,
        st.status,
        st.created_at,
        u.user_id,
        u.full_name  AS user_name,
        u.email      AS user_email,
        u.phone      AS user_phone
      FROM staff_top_ups st
      JOIN users u ON st.user_id = u.user_id
      ${where}
      ORDER BY st.created_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch top-up history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff/wallet/stats
// Quick summary counters for the staff dashboard header.
// Returns today's count + total amount, and all-time totals for this staff member.
// ─────────────────────────────────────────────────────────────────────────────
export const getStaffStats = async (req, res) => {
  try {
    const staffId = req.user.user_id;
    const pool    = await poolPromise;

    const result = await pool
      .request()
      .input("staffId", sql.Int, staffId)
      .query(`
        SELECT
          COUNT(*)                                       AS total_count,
          ISNULL(SUM(amount), 0)                        AS total_amount,
          COUNT(CASE WHEN CAST(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE)
                          = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE) THEN 1 END)
                                                        AS today_count,
          ISNULL(SUM(CASE WHEN CAST(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time' AS DATE)
                               = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE)
                          THEN amount END), 0)          AS today_amount
        FROM staff_top_ups
        WHERE processed_by_staff_id = @staffId
          AND status = 'completed'
      `);

    const row = result.recordset[0];
    res.json({
      total_count:  row.total_count,
      total_amount: parseFloat(row.total_amount),
      today_count:  row.today_count,
      today_amount: parseFloat(row.today_amount),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
