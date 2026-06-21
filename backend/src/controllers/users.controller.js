import bcrypt from "bcrypt";
import { poolPromise, sql } from "../db/db.js";
import { ensureAuthTables } from "../db/featureSetup.js";
import { writeAuditLog } from "./auditLog.controller.js";

// ── POST /api/users — admin creates a user with any role ─────────────────────
const VALID_ROLES = ["passenger", "driver", "admin", "staff"];

function validateBirthDate(birth_date) {
  if (!birth_date) return null;
  const d = new Date(birth_date);
  if (isNaN(d.getTime())) return "Invalid date of birth";
  if (d > new Date()) return "Date of birth cannot be in the future";
  return null;
}

export const createUser = async (req, res) => {
  const { full_name, email, password, role, phone, birth_date, gender } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ error: "full_name and email are required" });
  }
  if (!password) {
    return res.status(400).json({ error: "password is required" });
  }
  if (role && !VALID_ROLES.includes(role.toLowerCase())) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (gender && !["male", "female"].includes(String(gender).toLowerCase())) {
    return res.status(400).json({ error: "gender must be 'male' or 'female'" });
  }
  const dobError = validateBirthDate(birth_date);
  if (dobError) return res.status(400).json({ error: dobError });

  const userRole = VALID_ROLES.includes(role?.toLowerCase()) ? role.toLowerCase() : "passenger";
  try {
    const hashed = await bcrypt.hash(password, 10);
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("full_name",  sql.NVarChar(100), full_name)
      .input("email",      sql.NVarChar(120), email.toLowerCase().trim())
      .input("password",   sql.NVarChar(200), hashed)
      .input("role",       sql.NVarChar(20),  userRole)
      .input("phone",      sql.NVarChar(30),  phone ?? null)
      .input("birth_date", sql.Date,          birth_date ? new Date(birth_date) : null)
      .input("gender",     sql.NVarChar(10),  gender ? String(gender).toLowerCase() : null)
      .query(`
        INSERT INTO users(full_name, email, password_hash, role, phone, birth_date, gender)
        OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.email, INSERTED.role,
               INSERTED.status, INSERTED.created_at, INSERTED.birth_date, INSERTED.gender
        VALUES (@full_name, @email, @password, @role, @phone, @birth_date, @gender)
      `);
    const newUser = result.recordset[0];
    writeAuditLog(pool, { actorUserId: req.user?.user_id, actorRole: req.user?.role, actionName: "user.created", entityType: "user", entityId: newUser.user_id, newValues: { email: newUser.email, role: newUser.role }, req });
    res.status(201).json(newUser);
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
};

// ── DELETE /api/users/:id — admin hard-deletes a user ───────────────────────
// Queries sys.foreign_keys at runtime to find every dependent table,
// so the cleanup stays correct as the schema evolves.
export const deleteUser = async (req, res) => {
  const pool = await poolPromise;
  const uid  = Number(req.params.id);
  if (!uid) return res.status(400).json({ error: "Invalid user id" });

  try {
    // Step 1 — break the transitive FK chain: drivers → trips
    // trips.driver_id references drivers, not users directly.
    // Nullify trips.driver_id before we delete the drivers row.
    await pool.request().input("uid", sql.Int, uid).query(`
      IF OBJECT_ID('drivers','U') IS NOT NULL AND OBJECT_ID('trips','U') IS NOT NULL
      BEGIN
        DECLARE @drid INT = (SELECT TOP 1 driver_id FROM drivers WHERE user_id = @uid);
        IF @drid IS NOT NULL
          UPDATE trips SET driver_id = NULL WHERE driver_id = @drid;
      END
    `);

    // Step 2 — discover every non-CASCADE FK that directly points to users
    const fkRows = await pool.request().query(`
      SELECT DISTINCT
        OBJECT_NAME(fk.parent_object_id)                       AS tbl,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id)  AS col,
        c.is_nullable
      FROM sys.foreign_keys         fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.columns               c ON c.object_id  = fkc.parent_object_id
                                      AND c.column_id  = fkc.parent_column_id
      WHERE OBJECT_NAME(fk.referenced_object_id) = 'users'
        AND fk.delete_referential_action = 0
    `);

    // Step 3 — run cleanup + final delete inside one transaction
    const tx = pool.transaction();
    await tx.begin();

    for (const { tbl, col, is_nullable } of fkRows.recordset) {
      const stmt = is_nullable
        ? `UPDATE [${tbl}] SET [${col}] = NULL WHERE [${col}] = @uid`
        : `DELETE FROM [${tbl}] WHERE [${col}] = @uid`;
      await tx.request().input("uid", sql.Int, uid).query(stmt);
    }

    // otp_codes references email not user_id — handle separately
    await tx.request().input("uid", sql.Int, uid).query(`
      IF OBJECT_ID('otp_codes','U') IS NOT NULL
        DELETE FROM otp_codes
        WHERE email = (SELECT TOP 1 email FROM users WHERE user_id = @uid)
    `);

    const del = await tx.request().input("uid", sql.Int, uid)
      .query("DELETE FROM users WHERE user_id = @uid");

    await tx.commit();

    if (del.rowsAffected[0] === 0) return res.status(404).json({ error: "User not found" });
    writeAuditLog(pool, { actorUserId: req.user?.user_id, actorRole: req.user?.role, actionName: "user.deleted", entityType: "user", entityId: uid, req });
    res.json({ message: "User deleted" });
  } catch (err) {
    try { await tx.rollback(); } catch {}
    console.error("[deleteUser]", err.message);
    res.status(500).json({ error: "Delete failed: " + err.message });
  }
};

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
      let where = "WHERE u.status != 'deleted'";
      if (search) { r.input("search", sql.NVarChar(200), `%${search}%`); where += " AND (u.full_name LIKE @search OR u.email LIKE @search OR u.phone LIKE @search)"; }
      if (role)   { r.input("role",   sql.NVarChar(50),  role);          where += " AND u.role = @role"; }
      if (status) { r.input("status", sql.NVarChar(50),  status);        where += " AND u.status = @status"; }
      return { r, where };
    };

    const { r: cr, where } = build();
    const countRes = await cr.query(`SELECT COUNT(*) AS total FROM users u ${where}`);

    const { r: dr } = build();
    const dataRes  = await dr.query(`
      SELECT
        u.user_id, u.full_name, u.email, u.phone,
        u.role, u.status, u.created_at, u.birth_date,
        ISNULL((SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.user_id), 0) AS trips,
        ISNULL((SELECT w.balance FROM wallets w WHERE w.user_id = u.user_id), 0) AS wallet_balance
      FROM users u
      ${where}
      ORDER BY u.created_at DESC
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
      .query("SELECT user_id,full_name,email,phone,role,status,birth_date,created_at FROM users WHERE user_id=@id");
    if (!result.recordset[0]) return res.status(404).json({ error: "User not found" });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { full_name, phone, role, status, birth_date, gender } = req.body;

    // 'me' or own user_id → self-edit (passengers allowed, role/status locked)
    const isSelf = req.params.id === 'me' || String(req.params.id) === String(req.user.user_id);
    const targetId = req.params.id === 'me' ? req.user.user_id : Number(req.params.id);
    const isAdmin  = req.user.role === "admin";

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: "Full name is required" });
    }
    if (gender !== undefined && gender !== null && gender !== "" &&
        !["male", "female"].includes(String(gender).toLowerCase())) {
      return res.status(400).json({ error: "gender must be 'male' or 'female'" });
    }
    const dobError = validateBirthDate(birth_date);
    if (dobError) return res.status(400).json({ error: dobError });

    const pool = await poolPromise;
    const r = pool.request()
      .input("id",         sql.Int,          targetId)
      .input("full_name",  sql.NVarChar(100), String(full_name).trim())
      .input("phone",      sql.NVarChar(30),  phone ? String(phone).trim() : null)
      .input("birth_date", sql.Date,          birth_date ? new Date(birth_date) : null);

    let sets = "full_name=@full_name, phone=@phone, birth_date=@birth_date";

    // Gender is a personal attribute — allow both admins and self-edit to set it
    if (gender !== undefined) {
      r.input("gender", sql.NVarChar(10), gender ? String(gender).toLowerCase() : null);
      sets += ", gender=@gender";
    }

    // Only admins can change role or status — passengers editing their own profile cannot
    if (isAdmin) {
      const validRoles    = ["passenger", "driver", "admin", "staff"];
      const validStatuses = ["active", "inactive", "suspended", "blocked"];
      if (role && validRoles.includes(role.toLowerCase())) {
        r.input("role", sql.NVarChar(20), role.toLowerCase());
        sets += ", role=@role";
      }
      if (status && validStatuses.includes(status.toLowerCase())) {
        r.input("status", sql.NVarChar(20), status.toLowerCase());
        sets += ", status=@status";
      }
    }

    const result = await r.query(`
      UPDATE users SET ${sets}
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.email, INSERTED.phone,
             INSERTED.role, INSERTED.status, INSERTED.birth_date, INSERTED.gender, INSERTED.created_at
      WHERE user_id = @id
    `);

    if (!result.recordset[0]) return res.status(404).json({ error: "User not found" });

    writeAuditLog(pool, { actorUserId: req.user?.user_id, actorRole: req.user?.role, actionName: "user.updated", entityType: "user", entityId: targetId, newValues: { full_name, role, status }, req });
    res.json({ message: "Profile updated", user: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user profile" });
  }
};

export const getUserTickets = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          MIN(tk.ticket_id)                                    AS ticket_id,
          tk.trip_id,
          COUNT(*)                                             AS seat_count,
          STRING_AGG(tk.seat_number, ', ')
            WITHIN GROUP (ORDER BY tk.seat_number)            AS seat_number,
          ISNULL(SUM(tk.amount), 0)                            AS fare,
          MIN(tk.created_at)                                   AS created_at,
          MIN(tk.booking_time)                                 AS booking_time,
          r.route_name,
          r.start_location                                     AS origin,
          r.end_location                                       AS destination,
          t.start_time,
          t.end_time,
          t.status                                             AS trip_status,
          CASE
            WHEN t.start_time IS NOT NULL
            THEN CAST(
                   DATEDIFF(MINUTE, t.start_time,
                     ISNULL(t.end_time, DATEADD(MINUTE, 60, t.start_time)))
                 AS NVARCHAR(10)) + N' min'
            ELSE NULL
          END                                                  AS duration,
          v.model                                              AS vehicle_name,
          v.plate_number                                       AS plate,
          v.capacity                                           AS vehicle_capacity,
          LOWER(ISNULL(v.vehicle_type, 'bus'))                 AS vehicle_type,
          du.full_name                                         AS driver_name,
          du.phone                                             AS driver_phone,
          d.license_number                                     AS driver_license,
          CASE
            WHEN MAX(CASE WHEN tk.status != 'cancelled' THEN 1 ELSE 0 END) = 0
                 THEN 'cancelled'
            WHEN t.status = 'completed' THEN 'completed'
            ELSE 'upcoming'
          END                                                  AS ui_status
        FROM       tickets  tk
        LEFT JOIN  trips    t   ON  t.trip_id    = tk.trip_id
        LEFT JOIN  routes   r   ON  r.route_id   = t.route_id
        LEFT JOIN  vehicles v   ON  v.vehicle_id = t.vehicle_id
        LEFT JOIN  drivers  d   ON  d.driver_id  = t.driver_id
        LEFT JOIN  users    du  ON  du.user_id   = d.user_id
        WHERE tk.user_id = @id
        GROUP BY
          tk.trip_id,
          t.start_time, t.end_time, t.status,
          r.route_name, r.start_location, r.end_location,
          v.model, v.plate_number, v.capacity, v.vehicle_type,
          du.full_name, du.phone,
          d.license_number
        ORDER BY MIN(tk.ticket_id) DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[getUserTickets]", err.message);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
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
        u.user_id, u.full_name, u.email, u.phone, u.status,
        u.birth_date, u.gender, u.created_at,
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

export const addFavorite = async (req, res) => {
  try {
    const { route_id, nickname } = req.body;
    if (!route_id) return res.status(400).json({ error: "route_id is required" });

    const pool = await poolPromise;

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
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: "Route is already in favorites." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to add favorite" });
  }
};

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
// Self-service profile  (GET /api/users/me  /  PUT /api/users/me)
// ─────────────────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.user.user_id)
      .query(`
        SELECT user_id, full_name, email, phone, role, category, status, birth_date, gender, created_at
        FROM   users
        WHERE  user_id = @id
      `);
    if (!result.recordset[0]) return res.status(404).json({ error: "User not found" });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateMe = async (req, res) => {
  const { full_name, phone, birth_date, gender } = req.body;

  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: "Full name is required" });
  }
  const dobError = validateBirthDate(birth_date);
  if (dobError) return res.status(400).json({ error: dobError });

  const normalizedGender = gender ? String(gender).toLowerCase() : null;
  if (normalizedGender && !["male", "female"].includes(normalizedGender)) {
    return res.status(400).json({ error: "gender must be 'male' or 'female'" });
  }

  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("id",         sql.Int,          req.user.user_id)
      .input("full_name",  sql.NVarChar(100), String(full_name).trim())
      .input("phone",      sql.NVarChar(30),  phone ? String(phone).trim() : null)
      .input("birth_date", sql.Date,          birth_date ? new Date(birth_date) : null)
      .input("gender",     sql.NVarChar(10),  normalizedGender)
      .query(`
        UPDATE users
        SET full_name = @full_name, phone = @phone, birth_date = @birth_date, gender = @gender
        OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.email, INSERTED.phone,
               INSERTED.role, INSERTED.category, INSERTED.status, INSERTED.birth_date,
               INSERTED.gender, INSERTED.created_at
        WHERE  user_id = @id
      `);
    if (!result.recordset[0]) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Profile updated", user: result.recordset[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const deleteMyAccount = async (req, res) => {
  const pool   = await poolPromise;
  const userId = req.user.user_id;
  const tx     = pool.transaction();

  try {
    await tx.begin();

    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`UPDATE users SET status = 'deleted', deleted_at = GETUTCDATE() WHERE user_id = @uid`);

    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`DELETE FROM user_sessions WHERE user_id = @uid`);

    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`UPDATE wallets SET is_frozen = 1 WHERE user_id = @uid`);

    await tx.request()
      .input("uid", sql.Int, userId)
      .query(`UPDATE tickets SET status = 'cancelled' WHERE user_id = @uid AND status = 'confirmed'`);

    await tx.commit();
    res.json({ message: "Account deletion scheduled. You have been signed out of all devices." });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error("[deleteAccount]", err);
    res.status(500).json({ error: "Failed to process account deletion." });
  }
};
