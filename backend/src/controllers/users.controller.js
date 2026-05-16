import { poolPromise, sql } from "../db/db.js";
import { ensureAuthTables } from "../db/featureSetup.js";

export const getAllUsers = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(200, Number(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const { search, role, status } = req.query;

    const build = () => {
      const r = pool.request()
        .input("limit",  sql.Int, limit)
        .input("offset", sql.Int, offset);
      let where = "WHERE 1=1";
      if (search) { r.input("search", sql.NVarChar(200), `%${search}%`); where += " AND (full_name LIKE @search OR email LIKE @search OR phone LIKE @search)"; }
      if (role)   { r.input("role",   sql.NVarChar(50),  role);          where += " AND role = @role"; }
      if (status) { r.input("status", sql.NVarChar(50),  status);        where += " AND status = @status"; }
      return { r, where };
    };

    const { r: cr, where } = build();
    const countRes = await cr.query(`SELECT COUNT(*) AS total FROM users ${where}`);

    const { r: dr } = build();
    const dataRes  = await dr.query(`
      SELECT user_id,full_name,email,phone,role,status,category,created_at
      FROM users ${where}
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({ total: countRes.recordset[0].total, page, limit, data: dataRes.recordset });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT user_id,full_name,email,phone,role,status,created_at FROM users WHERE user_id=@id");
    if (!result.recordset[0]) return res.status(404).json({ error: "User not found" });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const pool = await poolPromise;
    await pool.request()
      .input("id",        sql.Int,     req.params.id)
      .input("full_name", sql.VarChar, full_name)
      .input("phone",     sql.VarChar, phone)
      .query("UPDATE users SET full_name=@full_name, phone=@phone WHERE user_id=@id");
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user profile" });
  }
};

export const getUserTickets = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM tickets WHERE user_id=@id");
  res.json(result.recordset);
};

export const getUserNotifications = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM notifications WHERE user_id=@id");
  res.json(result.recordset);
};

// ── GET /api/users/passengers ─────────────────────────────────────────────────

export const getPassengers = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const result = await pool.request().query(`
      SELECT
        u.user_id, u.full_name, u.email, u.phone, u.status, u.category, u.created_at,
        ISNULL(w.balance, 0) AS wallet_balance,
        (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.user_id) AS trip_count,
        sl.last_action, sl.last_reason, sl.last_acted_at
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.user_id
      LEFT JOIN (
        SELECT user_id,
               MAX(action)   AS last_action,
               MAX(reason)   AS last_reason,
               MAX(acted_at) AS last_acted_at
        FROM user_suspension_logs
        GROUP BY user_id
      ) sl ON sl.user_id = u.user_id
      WHERE u.role = 'passenger'
      ORDER BY u.created_at DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch passengers" });
  }
};

// ── POST /api/users/:id/suspend ───────────────────────────────────────────────

const VALID_REASONS = ["Fraud", "Abuse", "Policy Violation", "Payment Issue", "Security Concern", "Other"];
const VALID_ACTIONS = ["suspend", "block"];

export const suspendUser = async (req, res) => {
  const userId  = Number(req.params.id);
  const adminId = req.user.user_id;
  const { action = "suspend", reason, notes, duration_days } = req.body;

  if (!reason || !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason is required. Must be one of: ${VALID_REASONS.join(", ")}` });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: "action must be 'suspend' or 'block'" });
  }

  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const userRow = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT user_id, role, status FROM users WHERE user_id=@id");

    const user = userRow.recordset[0];
    if (!user)                  return res.status(404).json({ error: "User not found" });
    if (user.role !== "passenger") return res.status(400).json({ error: "Can only suspend passengers" });
    if (user.status !== "active")  return res.status(400).json({ error: `User is already ${user.status}` });

    const newStatus      = action === "block" ? "blocked" : "suspended";
    const days           = action === "suspend" ? (Number(duration_days) || 7) : null;
    const suspendedUntil = days ? new Date(Date.now() + days * 86400000) : null;

    const tx = pool.transaction();
    await tx.begin();

    await tx.request()
      .input("id",     sql.Int,         userId)
      .input("status", sql.NVarChar(20), newStatus)
      .query("UPDATE users SET status=@status WHERE user_id=@id");

    await tx.request()
      .input("user_id",         sql.Int,          userId)
      .input("action",          sql.NVarChar(20),  newStatus)
      .input("reason",          sql.NVarChar(100), reason)
      .input("notes",           sql.NVarChar(500), notes || null)
      .input("duration_days",   sql.Int,           days)
      .input("suspended_until", sql.DateTime2,     suspendedUntil)
      .input("acted_by",        sql.Int,           adminId)
      .query(`
        INSERT INTO user_suspension_logs
          (user_id, action, reason, notes, duration_days, suspended_until, acted_by)
        VALUES
          (@user_id, @action, @reason, @notes, @duration_days, @suspended_until, @acted_by)
      `);

    await tx.commit();

    res.json({
      message:         `User ${newStatus} successfully`,
      new_status:      newStatus,
      suspended_until: suspendedUntil,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Suspend failed" });
  }
};

// ── POST /api/users/:id/restore ───────────────────────────────────────────────

export const restoreUser = async (req, res) => {
  const userId  = Number(req.params.id);
  const adminId = req.user.user_id;
  const { notes } = req.body;

  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const userRow = await pool.request()
      .input("id", sql.Int, userId)
      .query("SELECT user_id, role, status FROM users WHERE user_id=@id");

    const user = userRow.recordset[0];
    if (!user)                return res.status(404).json({ error: "User not found" });
    if (user.status === "active") return res.status(400).json({ error: "User is already active" });

    const tx = pool.transaction();
    await tx.begin();

    await tx.request()
      .input("id", sql.Int, userId)
      .query("UPDATE users SET status='active' WHERE user_id=@id");

    await tx.request()
      .input("user_id",  sql.Int,          userId)
      .input("notes",    sql.NVarChar(500), notes || null)
      .input("acted_by", sql.Int,          adminId)
      .query(`
        INSERT INTO user_suspension_logs(user_id, action, reason, notes, acted_by)
        VALUES(@user_id, 'restore', 'Admin restored account', @notes, @acted_by)
      `);

    await tx.commit();
    res.json({ message: "User restored successfully", new_status: "active" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Restore failed" });
  }
};

// ── GET /api/users/:id/suspension-logs ───────────────────────────────────────

export const getSuspensionLogs = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT sl.log_id, sl.action, sl.reason, sl.notes,
               sl.duration_days, sl.suspended_until, sl.acted_at,
               u.full_name AS acted_by_name
        FROM user_suspension_logs sl
        JOIN users u ON u.user_id = sl.acted_by
        WHERE sl.user_id = @id
        ORDER BY sl.acted_at DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch suspension logs" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Favourite Routes  (self-service, authenticated passenger)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/me/favorites
export const getFavorites = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.user.user_id)
      .query(`
        SELECT
          ufr.favorite_id,
          ufr.route_id,
          r.route_name     AS name,
          r.start_location AS origin,
          r.end_location   AS destination,
          ufr.nickname,
          ufr.created_at
        FROM user_favorite_routes ufr
        JOIN routes r ON r.route_id = ufr.route_id
        WHERE ufr.user_id = @uid
        ORDER BY ufr.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
};

// POST /api/users/me/favorites  — body: { route_id, nickname? }
export const addFavorite = async (req, res) => {
  try {
    const { route_id, nickname } = req.body;
    if (!route_id) return res.status(400).json({ error: "route_id is required" });

    const pool = await poolPromise;

    // Verify route exists
    const routeCheck = await pool.request()
      .input("rid", sql.Int, Number(route_id))
      .query("SELECT route_id FROM routes WHERE route_id = @rid");
    if (!routeCheck.recordset[0]) return res.status(404).json({ error: "Route not found" });

    const ins = await pool.request()
      .input("uid",  sql.Int,          req.user.user_id)
      .input("rid",  sql.Int,          Number(route_id))
      .input("nick", sql.NVarChar(100), nickname ?? null)
      .query(`
        INSERT INTO user_favorite_routes (user_id, route_id, nickname)
        OUTPUT INSERTED.favorite_id, INSERTED.route_id, INSERTED.nickname, INSERTED.created_at
        VALUES (@uid, @rid, @nick)
      `);

    res.status(201).json(ins.recordset[0]);
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {   // UNIQUE violation
      return res.status(409).json({ error: "Route is already in favorites." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to add favorite" });
  }
};

// DELETE /api/users/me/favorites/:routeId
export const removeFavorite = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.user.user_id)
      .input("rid", sql.Int, parseInt(req.params.routeId, 10))
      .query(`
        DELETE FROM user_favorite_routes
        WHERE user_id = @uid AND route_id = @rid
      `);
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Favorite not found." });
    }
    res.json({ message: "Removed from favorites" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Account Deletion  (self-service, authenticated user)
// DELETE /api/users/me
// Sets status='deleted', revokes all sessions, freezes wallet,
// cancels confirmed tickets.  Irreversible without admin intervention.
// ─────────────────────────────────────────────────────────────────────────────
export const deleteMyAccount = async (req, res) => {
  const pool   = await poolPromise;
  const userId = req.user.user_id;
  const tx     = pool.transaction();

  try {
    await tx.begin();

    // 1. Soft-delete: mark user as deleted
    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`
        UPDATE users
        SET status = 'deleted', deleted_at = GETUTCDATE()
        WHERE user_id = @uid
      `);

    // 2. Revoke all active sessions (force logout everywhere)
    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`DELETE FROM user_sessions WHERE user_id = @uid`);

    // 3. Freeze wallet to prevent any transactions
    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`UPDATE wallets SET is_frozen = 1 WHERE user_id = @uid`);

    // 4. Cancel confirmed tickets (pending bookings)
    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`
        UPDATE tickets SET status = 'cancelled'
        WHERE user_id = @uid AND status = 'confirmed'
      `);

    await tx.commit();
    res.json({ message: "Account deletion scheduled. You have been signed out of all devices." });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[deleteAccount]", err);
    res.status(500).json({ error: "Failed to process account deletion." });
  }
};
