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
      .query("SELECT balance FROM wallets WHERE user_id = @id");

    const row = result.recordset[0];
    res.json({ balance: row ? parseFloat(row.balance) : 0 });
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
          wr.location_name,
          wr.tx_ref,
          u.full_name AS processed_by
        FROM wallet_transactions wt
        LEFT JOIN wallet_recharges wr ON wt.recharge_id = wr.recharge_id
        LEFT JOIN users           u  ON wr.staff_id    = u.user_id
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
        SELECT location_id, name, address, city, phone, hours, is_active
        FROM top_up_locations
        WHERE is_active = 1
        ORDER BY city, name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    // Return hardcoded fallback if table not yet created
    res.json(FALLBACK_LOCATIONS);
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
// Fallback locations shown if DB table doesn't exist yet
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_LOCATIONS = [
  {
    location_id: 1,
    name:    "Central Bus Station — Main Office",
    address: "1 Station Road",
    city:    "City Center",
    phone:   "+1 555-0100",
    hours:   "Mon–Fri 7:00 AM – 8:00 PM, Sat–Sun 8:00 AM – 6:00 PM",
    is_active: true,
  },
  {
    location_id: 2,
    name:    "North Terminal Customer Service",
    address: "45 North Ave",
    city:    "North District",
    phone:   "+1 555-0101",
    hours:   "Daily 6:00 AM – 10:00 PM",
    is_active: true,
  },
  {
    location_id: 3,
    name:    "Airport Transit Hub Kiosk",
    address: "Terminal 2, Departures Level",
    city:    "Airport",
    phone:   "+1 555-0102",
    hours:   "Daily 5:00 AM – 11:00 PM",
    is_active: true,
  },
  {
    location_id: 4,
    name:    "Mall Junction Agent Counter",
    address: "Ground Floor, Grand Mall",
    city:    "South District",
    phone:   "+1 555-0103",
    hours:   "Mon–Sun 10:00 AM – 9:00 PM",
    is_active: true,
  },
];
