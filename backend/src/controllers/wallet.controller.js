import { poolPromise, sql } from "../db/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet
// Returns the authenticated user's current wallet balance.
// Passengers may only read their own wallet (user_id comes from JWT).
// ─────────────────────────────────────────────────────────────────────────────
export const getWallet = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, userId)
      .query("SELECT wallet_id, balance, is_frozen, freeze_reason FROM wallets WHERE user_id = @id");

    const row = result.recordset[0];
    res.json({
      wallet_id:     row?.wallet_id ?? null,
      balance:       row ? parseFloat(row.balance) : 0,
      is_frozen:     row ? !!row.is_frozen : false,
      freeze_reason: row?.freeze_reason ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/transactions
// Returns transaction history for the authenticated user.
// Each recharge row includes location_name, staff_name, and tx_ref for auditing.
// ─────────────────────────────────────────────────────────────────────────────
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, userId)
      .query(`
        SELECT
          wt.transaction_id,
          wt.type,
          wt.amount,
          wt.description,
          wt.created_at,
          COALESCE(wr.location_name, st.recharge_location)     AS location_name,
          COALESCE(wr.tx_ref,        st.transaction_reference) AS tx_ref,
          COALESCE(ru.full_name,     su.full_name)             AS processed_by
        FROM wallet_transactions wt
        LEFT JOIN wallet_recharges wr ON wt.recharge_id     = wr.recharge_id
        LEFT JOIN users           ru ON wr.staff_id         = ru.user_id
        LEFT JOIN staff_top_ups   st ON wt.staff_top_up_id  = st.top_up_id
        LEFT JOIN users           su ON st.processed_by_staff_id = su.user_id
        WHERE wt.user_id = @id
        ORDER BY wt.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/locations
// Returns the list of approved physical top-up locations.
// Public endpoint — no auth required.
// ─────────────────────────────────────────────────────────────────────────────
export const getTopUpLocations = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(`
        SELECT location_id, name, address, city, phone, hours, latitude, longitude, is_active
        FROM top_up_locations
        WHERE is_active = 1
        ORDER BY city, name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch top-up locations" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/topup                    ← ADMIN / STAFF ONLY
// Processes an in-person wallet recharge.
// Body: { user_id, amount, location_name, tx_ref, notes? }
// JWT must carry role = 'admin' or 'staff' (enforced by requireAdmin middleware).
// ─────────────────────────────────────────────────────────────────────────────
export const adminTopUpWallet = async (req, res) => {
  const { user_id, amount, location_name, tx_ref, notes } = req.body;

  if (!user_id || !amount || !location_name || !tx_ref) {
    return res.status(400).json({
      error: "user_id, amount, location_name, and tx_ref are all required",
    });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const staffId = req.user.user_id;

  const pool = await poolPromise;

  // Read wallet limits from system_settings (fall back to safe defaults)
  const limitsRes = await pool.request().query(`
    SELECT setting_key, setting_value FROM system_settings
    WHERE setting_key IN ('wallet.min_topup','wallet.max_topup','wallet.max_balance')
  `);
  const limitsMap = {};
  for (const r of limitsRes.recordset) limitsMap[r.setting_key] = parseFloat(r.setting_value);
  const minTopup   = limitsMap["wallet.min_topup"]   ?? 5;
  const maxTopup   = limitsMap["wallet.max_topup"]   ?? 500;
  const maxBalance = limitsMap["wallet.max_balance"] ?? 1000;

  if (parsedAmount < minTopup) {
    return res.status(400).json({ error: `Minimum top-up is $${minTopup.toFixed(2)}` });
  }
  if (parsedAmount > maxTopup) {
    return res.status(400).json({ error: `Single top-up cannot exceed $${maxTopup.toFixed(2)}` });
  }

  // Check current balance won't exceed max
  const balCheckRes = await pool.request()
    .input("uid", sql.Int, user_id)
    .query("SELECT COALESCE((SELECT balance FROM wallets WHERE user_id=@uid), 0) AS balance");
  const currentBalance = parseFloat(balCheckRes.recordset[0]?.balance ?? 0);
  if (currentBalance + parsedAmount > maxBalance) {
    return res.status(400).json({
      error: `Top-up would exceed the maximum wallet balance of $${maxBalance.toFixed(2)}. Current balance: $${currentBalance.toFixed(2)}`,
    });
  }

  const tx = pool.transaction();

  try {
    await tx.begin();

    // 1. Upsert the wallet row
    await tx
      .request()
      .input("uid",    sql.Int,            user_id)
      .input("amount", sql.Decimal(10, 2), parsedAmount)
      .query(`
        IF EXISTS (SELECT 1 FROM wallets WHERE user_id = @uid)
          UPDATE wallets SET balance = balance + @amount WHERE user_id = @uid
        ELSE
          INSERT INTO wallets (user_id, balance) VALUES (@uid, @amount)
      `);

    // 2. Insert audit record into wallet_recharges
    const rechargeResult = await tx
      .request()
      .input("uid",           sql.Int,            user_id)
      .input("staff_id",      sql.Int,            staffId)
      .input("amount",        sql.Decimal(10, 2), parsedAmount)
      .input("location_name", sql.VarChar(255),   location_name)
      .input("tx_ref",        sql.VarChar(100),   tx_ref)
      .input("notes",         sql.VarChar(500),   notes || null)
      .query(`
        INSERT INTO wallet_recharges
          (user_id, staff_id, amount, location_name, tx_ref, notes, created_at)
        OUTPUT INSERTED.recharge_id
        VALUES
          (@uid, @staff_id, @amount, @location_name, @tx_ref, @notes, GETUTCDATE())
      `);

    const rechargeId = rechargeResult.recordset[0].recharge_id;

    // 3. Insert matching transaction record (for user-visible history)
    await tx
      .request()
      .input("uid",         sql.Int,            user_id)
      .input("recharge_id", sql.Int,            rechargeId)
      .input("amount",      sql.Decimal(10, 2), parsedAmount)
      .input("location",    sql.VarChar(255),   location_name)
      .input("tx_ref",      sql.VarChar(100),   tx_ref)
      .query(`
        INSERT INTO wallet_transactions
          (user_id, recharge_id, type, amount, description, created_at)
        VALUES
          (@uid, @recharge_id, 'credit',
           @amount,
           CONCAT('In-person recharge at ', @location, ' — Ref: ', @tx_ref),
           GETUTCDATE())
      `);

    await tx.commit();

    // Return updated balance
    const balResult = await pool
      .request()
      .input("uid", sql.Int, user_id)
      .query("SELECT balance FROM wallets WHERE user_id = @uid");

    res.status(201).json({
      message:         "Wallet recharged successfully",
      recharge_id:     rechargeId,
      new_balance:     parseFloat(balResult.recordset[0]?.balance ?? parsedAmount),
      amount_credited: parsedAmount,
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Recharge failed — transaction rolled back" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/recharges                 ← ADMIN / STAFF ONLY
// Returns full recharge audit log.
// Supports optional query: ?user_id=X&location=Y&from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
export const getRechargeAuditLog = async (req, res) => {
  try {
    const { user_id, location, from, to } = req.query;
    const pool = await poolPromise;
    const request = pool.request();

    let where = "WHERE 1=1";
    if (user_id) {
      request.input("uid", sql.Int, parseInt(user_id));
      where += " AND wr.user_id = @uid";
    }
    if (location) {
      request.input("loc", sql.VarChar(255), `%${location}%`);
      where += " AND wr.location_name LIKE @loc";
    }
    if (from) {
      request.input("from", sql.Date, from);
      where += " AND CAST(wr.created_at AS DATE) >= @from";
    }
    if (to) {
      request.input("to", sql.Date, to);
      where += " AND CAST(wr.created_at AS DATE) <= @to";
    }

    const result = await request.query(`
      SELECT
        wr.recharge_id,
        wr.tx_ref,
        wr.amount,
        wr.location_name,
        wr.notes,
        wr.created_at,
        u.user_id,
        u.full_name  AS user_name,
        u.email      AS user_email,
        s.full_name  AS staff_name,
        s.email      AS staff_email
      FROM wallet_recharges wr
      JOIN users u ON wr.user_id  = u.user_id
      JOIN users s ON wr.staff_id = s.user_id
      ${where}
      ORDER BY wr.created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recharge audit log" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/adjust                   ← ADMIN ONLY
// Admin credit or debit on any passenger wallet with full audit trail.
// Body: { user_id, type: 'credit'|'debit', amount, reason, notes? }
// ─────────────────────────────────────────────────────────────────────────────
export const adminAdjustWallet = async (req, res) => {
  const { user_id, type, amount, reason, notes } = req.body;
  const adminId = req.user.user_id;

  if (!user_id || !type || !amount || !reason) {
    return res.status(400).json({ error: "user_id, type, amount, and reason are required" });
  }
  if (!["credit", "debit"].includes(type)) {
    return res.status(400).json({ error: "type must be 'credit' or 'debit'" });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const pool = await poolPromise;
  const tx   = pool.transaction();

  try {
    await tx.begin();

    // Get current balance
    const balRes = await tx.request()
      .input("uid", sql.Int, user_id)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM wallets WHERE user_id=@uid)
          INSERT INTO wallets(user_id, balance) VALUES(@uid, 0);
        SELECT balance FROM wallets WHERE user_id=@uid;
      `);

    const balanceBefore = parseFloat(balRes.recordset[0]?.balance ?? 0);
    const delta         = type === "credit" ? parsedAmount : -parsedAmount;
    const balanceAfter  = balanceBefore + delta;

    if (type === "debit" && balanceAfter < 0) {
      await tx.rollback();
      return res.status(400).json({ error: `Insufficient balance. Current: ${balanceBefore.toFixed(2)}` });
    }

    // Update wallet
    await tx.request()
      .input("uid",    sql.Int,           user_id)
      .input("amount", sql.Decimal(10, 2), delta)
      .query("UPDATE wallets SET balance = balance + @amount WHERE user_id=@uid");

    // Log to wallet_transactions
    await tx.request()
      .input("uid",    sql.Int,           user_id)
      .input("type",   sql.VarChar(10),   type)
      .input("amount", sql.Decimal(10, 2), parsedAmount)
      .input("reason", sql.VarChar(200),  reason)
      .query(`
        INSERT INTO wallet_transactions(user_id, type, amount, description, created_at)
        VALUES(@uid, @type, @amount, CONCAT('Admin adjustment: ', @reason), GETUTCDATE())
      `);

    // Audit trail in wallet_adjustments
    await tx.request()
      .input("user_id",        sql.Int,           user_id)
      .input("admin_id",       sql.Int,           adminId)
      .input("type",           sql.NVarChar(10),  type)
      .input("amount",         sql.Decimal(10, 2), parsedAmount)
      .input("reason",         sql.NVarChar(200), reason)
      .input("notes",          sql.NVarChar(500), notes || null)
      .input("balance_before", sql.Decimal(10, 2), balanceBefore)
      .input("balance_after",  sql.Decimal(10, 2), balanceAfter)
      .query(`
        INSERT INTO wallet_adjustments
          (user_id,admin_id,type,amount,reason,notes,balance_before,balance_after)
        VALUES
          (@user_id,@admin_id,@type,@amount,@reason,@notes,@balance_before,@balance_after)
      `);

    await tx.commit();

    res.status(201).json({
      message:        `Wallet ${type}ed successfully`,
      balance_before: balanceBefore,
      balance_after:  balanceAfter,
      amount:         parsedAmount,
      type,
    });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Wallet adjustment failed — transaction rolled back" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/adjustments               ← ADMIN ONLY
// Full admin wallet adjustment audit trail.
// ─────────────────────────────────────────────────────────────────────────────
export const getAdjustmentHistory = async (req, res) => {
  try {
    const pool  = await poolPromise;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const result = await pool.request()
      .input("limit", sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          wa.adjustment_id, wa.type, wa.amount, wa.reason, wa.notes,
          wa.balance_before, wa.balance_after, wa.created_at,
          u.full_name  AS user_name,  u.email AS user_email,
          a.full_name  AS admin_name, a.email AS admin_email
        FROM wallet_adjustments wa
        JOIN users u ON u.user_id = wa.user_id
        JOIN users a ON a.user_id = wa.admin_id
        ORDER BY wa.created_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch adjustment history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/statuses                  ← ADMIN ONLY
// Returns every passenger wallet with live freeze status.
// Requires is_frozen, freeze_reason, freeze_notes, frozen_at, frozen_by_admin_id
// columns on the wallets table (see migration SQL below).
// ─────────────────────────────────────────────────────────────────────────────
export const getWalletStatuses = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        w.user_id,
        u.full_name                                          AS name,
        u.email,
        CAST(w.balance AS FLOAT)                             AS balance,
        CASE WHEN w.is_frozen = 1 THEN 'Frozen' ELSE 'Active' END AS status,
        w.freeze_reason                                      AS reason,
        w.freeze_notes                                       AS notes,
        w.frozen_at,
        a.full_name                                          AS frozen_by
      FROM wallets w
      JOIN  users u ON u.user_id = w.user_id
      LEFT JOIN users a ON a.user_id = w.frozen_by_admin_id
      WHERE u.role = 'passenger'
      ORDER BY w.is_frozen DESC, u.full_name
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wallet statuses" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/:id/freeze               ← ADMIN ONLY
// Freezes a passenger wallet — blocks deductions but preserves balance.
// Body: { reason, notes? }
// ─────────────────────────────────────────────────────────────────────────────
export const freezeWallet = async (req, res) => {
  const userId  = parseInt(req.params.id, 10);
  const adminId = req.user.user_id;
  const { reason, notes } = req.body;

  if (!reason) return res.status(400).json({ error: "reason is required" });

  const pool = await poolPromise;
  const tx   = pool.transaction();
  try {
    await tx.begin();

    const walletRes = await tx.request()
      .input("uid", sql.Int, userId)
      .query("SELECT wallet_id, is_frozen FROM wallets WHERE user_id = @uid");

    if (!walletRes.recordset[0]) {
      await tx.rollback();
      return res.status(404).json({ error: "Wallet not found" });
    }
    if (walletRes.recordset[0].is_frozen) {
      await tx.rollback();
      return res.status(409).json({ error: "Wallet is already frozen" });
    }

    await tx.request()
      .input("uid",     sql.Int,          userId)
      .input("reason",  sql.NVarChar(200), reason)
      .input("notes",   sql.NVarChar(500), notes || null)
      .input("adminId", sql.Int,          adminId)
      .query(`
        UPDATE wallets
        SET is_frozen            = 1,
            freeze_reason        = @reason,
            freeze_notes         = @notes,
            frozen_at            = GETUTCDATE(),
            frozen_by_admin_id   = @adminId
        WHERE user_id = @uid
      `);

    await tx.request()
      .input("uid",     sql.Int,          userId)
      .input("action",  sql.NVarChar(20),  "frozen")
      .input("reason",  sql.NVarChar(200), reason)
      .input("notes",   sql.NVarChar(500), notes || null)
      .input("adminId", sql.Int,          adminId)
      .query(`
        INSERT INTO wallet_freeze_log (user_id, action, reason, notes, admin_id, created_at)
        VALUES (@uid, @action, @reason, @notes, @adminId, GETUTCDATE())
      `);

    await tx.commit();
    res.json({ message: "Wallet frozen successfully" });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to freeze wallet" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/:id/unfreeze             ← ADMIN ONLY
// Re-enables deductions on a previously frozen wallet.
// Body: { notes? }
// ─────────────────────────────────────────────────────────────────────────────
export const unfreezeWallet = async (req, res) => {
  const userId  = parseInt(req.params.id, 10);
  const adminId = req.user.user_id;
  const { notes } = req.body;

  const pool = await poolPromise;
  const tx   = pool.transaction();
  try {
    await tx.begin();

    const walletRes = await tx.request()
      .input("uid", sql.Int, userId)
      .query("SELECT wallet_id, is_frozen FROM wallets WHERE user_id = @uid");

    if (!walletRes.recordset[0]) {
      await tx.rollback();
      return res.status(404).json({ error: "Wallet not found" });
    }
    if (!walletRes.recordset[0].is_frozen) {
      await tx.rollback();
      return res.status(409).json({ error: "Wallet is not frozen" });
    }

    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`
        UPDATE wallets
        SET is_frozen            = 0,
            freeze_reason        = NULL,
            freeze_notes         = NULL,
            frozen_at            = NULL,
            frozen_by_admin_id   = NULL
        WHERE user_id = @uid
      `);

    await tx.request()
      .input("uid",     sql.Int,          userId)
      .input("action",  sql.NVarChar(20),  "unfrozen")
      .input("reason",  sql.NVarChar(200), "Investigation completed")
      .input("notes",   sql.NVarChar(500), notes || null)
      .input("adminId", sql.Int,          adminId)
      .query(`
        INSERT INTO wallet_freeze_log (user_id, action, reason, notes, admin_id, created_at)
        VALUES (@uid, @action, @reason, @notes, @adminId, GETUTCDATE())
      `);

    await tx.commit();
    res.json({ message: "Wallet unfrozen successfully" });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to unfreeze wallet" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/freeze-log                ← ADMIN ONLY
// Full audit trail of freeze / unfreeze events.
// ─────────────────────────────────────────────────────────────────────────────
export const getFreezeLog = async (req, res) => {
  try {
    const pool  = await poolPromise;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const result = await pool.request()
      .input("limit", sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          fl.log_id        AS id,
          fl.user_id,
          u.full_name      AS [user],
          fl.action,
          fl.reason,
          fl.notes,
          a.full_name      AS [by],
          fl.created_at    AS at
        FROM wallet_freeze_log fl
        JOIN  users u ON u.user_id = fl.user_id
        LEFT JOIN users a ON a.user_id = fl.admin_id
        ORDER BY fl.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch freeze log" });
  }
};

