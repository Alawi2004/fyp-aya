import { poolPromise, sql } from "../db/db.js";
import { dispatchToTokens } from "../services/fcm.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fetch push + FCM tokens for a target group and deliver via Expo + FCM.
// Dual-channel: Expo tokens → expo-server-sdk; FCM tokens → firebase-admin.
// Runs fire-and-forget — errors are logged, not surfaced to the API caller.
// ─────────────────────────────────────────────────────────────────────────────
async function _sendPush(pool, target, title, body, specificUserId = null) {
  try {
    let rows;
    if (specificUserId) {
      rows = (await pool.request()
        .input("uid", sql.Int, specificUserId)
        .query("SELECT push_token, fcm_token FROM users WHERE user_id = @uid")
      ).recordset;
    } else {
      const roleClause =
        target === "all_passengers" ? "role = 'passenger'" :
        target === "all_drivers"    ? "role = 'driver'"    : "1=1";
      rows = (await pool.request()
        .query(`SELECT push_token, fcm_token FROM users WHERE ${roleClause}`)
      ).recordset;
    }

    const tokens = rows.flatMap(r => [r.push_token, r.fcm_token].filter(Boolean));
    if (!tokens.length) return;

    await dispatchToTokens(tokens, title, body);
  } catch (err) {
    console.warn("[push] dispatch error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ensure delivery-tracking columns exist (idempotent — safe on every startup)
// ─────────────────────────────────────────────────────────────────────────────
let columnsEnsured = false;

async function ensureDeliveryColumns(pool) {
  if (columnsEnsured) return;
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='title')
        ALTER TABLE notifications ADD title NVARCHAR(200) NULL;
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='body')
        ALTER TABLE notifications ADD body NVARCHAR(2000) NULL;
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='type')
        ALTER TABLE notifications ADD type NVARCHAR(20) NULL DEFAULT 'info';
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='target_group')
        ALTER TABLE notifications ADD target_group NVARCHAR(50) NULL DEFAULT 'all_users';
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='sent_count')
        ALTER TABLE notifications ADD sent_count INT NOT NULL DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME='notifications' AND COLUMN_NAME='read_count')
        ALTER TABLE notifications ADD read_count INT NOT NULL DEFAULT 0;
    `);
    columnsEnsured = true;
  } catch (err) {
    console.warn("[notifications] Could not ensure delivery columns:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Count users in a target group for sent_count
// ─────────────────────────────────────────────────────────────────────────────
async function countTargetUsers(pool, target) {
  const map = {
    all_users:        "SELECT COUNT(*) AS n FROM users",
    all_passengers:   "SELECT COUNT(*) AS n FROM users WHERE role='passenger'",
    all_drivers:      "SELECT COUNT(*) AS n FROM users WHERE role='driver'",
    route_passengers: "SELECT COUNT(*) AS n FROM users WHERE role='passenger'", // approximation
    specific_driver:  "SELECT 1 AS n",
  };
  const q = map[target] ?? map.all_users;
  try {
    const res = await pool.request().query(q);
    return res.recordset[0]?.n ?? 1;
  } catch {
    return 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications — all notifications with real delivery stats
// ─────────────────────────────────────────────────────────────────────────────
export const getAllNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureDeliveryColumns(pool);

    const result = await pool.request().query(`
      SELECT
        notification_id,
        user_id,
        ISNULL(title,   LEFT(CAST(ISNULL(message,'') AS NVARCHAR(MAX)), 80)) AS title,
        ISNULL(body,    CAST(ISNULL(message,'') AS NVARCHAR(MAX)))        AS body,
        CAST(ISNULL(message,'') AS NVARCHAR(MAX))                          AS message,
        ISNULL(type,    'info')                         AS type,
        ISNULL(target_group, 'all_users')               AS target_group,
        is_read,
        sent_count,
        read_count,
        created_at
      FROM notifications
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications
// Supports two call modes:
//   Legacy:    { user_id, message }
//   Broadcast: { title, body, type, target, channel }
// ─────────────────────────────────────────────────────────────────────────────
export const createNotification = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureDeliveryColumns(pool);

    const { user_id, message, title, body, type, target, channel } = req.body;

    // Broadcast mode (admin compose)
    if (title && body && target) {
      const sentCount = await countTargetUsers(pool, target);

      const ins = await pool.request()
        .input("uid",     sql.Int,           null)
        .input("msg",     sql.NVarChar(2000), `${title} — ${body}`)
        .input("title",   sql.NVarChar(200),  title)
        .input("body",    sql.NVarChar(2000), body)
        .input("type",    sql.NVarChar(20),   type   ?? "info")
        .input("target",  sql.NVarChar(50),   target ?? "all_users")
        .input("sent",    sql.Int,            sentCount)
        .query(`
          INSERT INTO notifications
            (user_id, message, title, body, type, target_group, sent_count, read_count)
          OUTPUT INSERTED.notification_id
          VALUES
            (@uid, @msg, @title, @body, @type, @target, @sent, 0)
        `);

      // Fire push delivery asynchronously — don't await so DB insert isn't blocked
      _sendPush(pool, target, title, body);

      return res.status(201).json({
        notification_id: ins.recordset[0].notification_id,
        sent_count:      sentCount,
        message:         "Notification broadcast created",
      });
    }

    // Legacy per-user mode
    if (!user_id || !message) {
      return res.status(400).json({ error: "user_id and message are required (or title, body, and target for broadcasts)" });
    }

    await pool.request()
      .input("uid", sql.Int,           user_id)
      .input("msg", sql.NVarChar(2000), message)
      .input("sent", sql.Int,          1)
      .query(`
        INSERT INTO notifications (user_id, message, sent_count, read_count)
        VALUES (@uid, @msg, @sent, 0)
      `);

    // Push to the specific user (best-effort)
    _sendPush(pool, "specific_user", "New notification", message, user_id);

    res.status(201).json({ message: "Notification sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create notification" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/notifications/:id/read
// Marks as read and increments read_count (once per unique call).
// ─────────────────────────────────────────────────────────────────────────────
export const markNotificationRead = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureDeliveryColumns(pool);

    // Only increment read_count when transitioning from unread → read
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE notifications
        SET is_read = 1,
            read_count = read_count + CASE WHEN is_read = 0 THEN 1 ELSE 0 END
        WHERE notification_id = @id
      `);

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/notifications/:id  — update title/body/type
// ─────────────────────────────────────────────────────────────────────────────
export const updateNotification = async (req, res) => {
  try {
    const { title, body, type } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id",    sql.Int,           req.params.id)
      .input("title", sql.NVarChar(200),  title ?? null)
      .input("body",  sql.NVarChar(2000), body  ?? null)
      .input("type",  sql.NVarChar(20),   type  ?? null)
      .query(`
        UPDATE notifications SET
          title   = COALESCE(@title, title),
          body    = COALESCE(@body,  body),
          type    = COALESCE(@type,  type),
          message = COALESCE(@title, title) + ' — ' + COALESCE(@body, body)
        WHERE notification_id = @id
      `);
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification updated" });
  } catch (err) {
    console.error("[updateNotification]", err.message);
    res.status(500).json({ error: "Failed to update notification" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id  — permanently delete a notification
// ─────────────────────────────────────────────────────────────────────────────
export const deleteNotification = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM notifications WHERE notification_id = @id");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error("[deleteNotification]", err.message);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/user/:user_id
// Returns personal notifications + broadcast notifications targeted at the
// user's role group (all_users, all_passengers, all_drivers).
// ─────────────────────────────────────────────────────────────────────────────
export const getUserNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureDeliveryColumns(pool);

    // Look up the user's role so we can include the right broadcasts
    const userRow = await pool.request()
      .input("uid", sql.Int, req.params.user_id)
      .query("SELECT role FROM users WHERE user_id = @uid");
    const role = userRow.recordset[0]?.role ?? "passenger";

    const roleGroup = role === "driver" ? "all_drivers" : "all_passengers";

    const result = await pool.request()
      .input("uid", sql.Int, req.params.user_id)
      .input("roleGroup", sql.NVarChar(50), roleGroup)
      .query(`
        SELECT
          notification_id,
          ISNULL(title, LEFT(CAST(ISNULL(message,'') AS NVARCHAR(MAX)), 80)) AS title,
          ISNULL(body,  CAST(ISNULL(message,'') AS NVARCHAR(MAX)))           AS body,
          CAST(ISNULL(message,'') AS NVARCHAR(MAX))                          AS message,
          ISNULL(type, 'info')                                               AS type,
          ISNULL(target_group, 'all_users')                                  AS target_group,
          is_read,
          created_at
        FROM notifications
        WHERE user_id = @uid
           OR (user_id IS NULL AND target_group IN ('all_users', @roleGroup))
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user notifications" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE CRUD   GET / POST / PUT / DELETE  /api/notifications/templates
// ─────────────────────────────────────────────────────────────────────────────

export const getTemplates = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT template_id AS id, name, title, body, type, target, created_at, updated_at
      FROM notification_templates
      ORDER BY created_at DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[getTemplates]", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
};

export const createTemplateDb = async (req, res) => {
  try {
    const { name, title, body, type, target } = req.body;
    if (!name || !title || !body) return res.status(400).json({ error: "name, title, and body are required" });
    const pool = await poolPromise;
    const ins = await pool.request()
      .input("name",   sql.NVarChar(100),  name)
      .input("title",  sql.NVarChar(200),  title)
      .input("body",   sql.NVarChar(2000), body)
      .input("type",   sql.NVarChar(20),   type   ?? "info")
      .input("target", sql.NVarChar(50),   target ?? "all_users")
      .query(`
        INSERT INTO notification_templates (name, title, body, type, target)
        OUTPUT INSERTED.template_id AS id, INSERTED.name, INSERTED.title,
               INSERTED.body, INSERTED.type, INSERTED.target, INSERTED.created_at
        VALUES (@name, @title, @body, @type, @target)
      `);
    res.status(201).json(ins.recordset[0]);
  } catch (err) {
    console.error("[createTemplate]", err.message);
    res.status(500).json({ error: "Failed to create template" });
  }
};

export const updateTemplateDb = async (req, res) => {
  try {
    const { name, title, body, type, target } = req.body;
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id",     sql.Int,            req.params.id)
      .input("name",   sql.NVarChar(100),  name   ?? null)
      .input("title",  sql.NVarChar(200),  title  ?? null)
      .input("body",   sql.NVarChar(2000), body   ?? null)
      .input("type",   sql.NVarChar(20),   type   ?? null)
      .input("target", sql.NVarChar(50),   target ?? null)
      .query(`
        UPDATE notification_templates SET
          name       = COALESCE(@name,   name),
          title      = COALESCE(@title,  title),
          body       = COALESCE(@body,   body),
          type       = COALESCE(@type,   type),
          target     = COALESCE(@target, target),
          updated_at = GETUTCDATE()
        WHERE template_id = @id
      `);
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Template not found" });
    res.json({ message: "Template updated" });
  } catch (err) {
    console.error("[updateTemplate]", err.message);
    res.status(500).json({ error: "Failed to update template" });
  }
};

export const deleteTemplateDb = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM notification_templates WHERE template_id = @id");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Template not found" });
    res.json({ message: "Template deleted" });
  } catch (err) {
    console.error("[deleteTemplate]", err.message);
    res.status(500).json({ error: "Failed to delete template" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED NOTIFICATIONS
// GET  /api/notifications/scheduled   — list all scheduled
// POST /api/notifications/schedule    — create a scheduled notification
// DELETE /api/notifications/scheduled/:id — cancel
// ─────────────────────────────────────────────────────────────────────────────

export const getScheduledNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT schedule_id AS id, title, body, type, target, target_label,
             scheduled_at, status, created_at
      FROM scheduled_notifications
      ORDER BY scheduled_at ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("[getScheduled]", err.message);
    res.status(500).json({ error: "Failed to fetch scheduled notifications" });
  }
};

export const createScheduledNotification = async (req, res) => {
  try {
    const { title, body, type, target, target_label, scheduled_at } = req.body;
    if (!title || !body || !scheduled_at)
      return res.status(400).json({ error: "title, body, and scheduled_at are required" });

    const pool = await poolPromise;
    const ins = await pool.request()
      .input("title",        sql.NVarChar(200),  title)
      .input("body",         sql.NVarChar(2000), body)
      .input("type",         sql.NVarChar(20),   type         ?? "info")
      .input("target",       sql.NVarChar(50),   target       ?? "all_users")
      .input("target_label", sql.NVarChar(200),  target_label ?? null)
      .input("scheduled_at", sql.DateTime2,      new Date(scheduled_at))
      .query(`
        INSERT INTO scheduled_notifications
          (title, body, type, target, target_label, scheduled_at, status)
        OUTPUT INSERTED.schedule_id AS id, INSERTED.title, INSERTED.body,
               INSERTED.type, INSERTED.target, INSERTED.target_label,
               INSERTED.scheduled_at, INSERTED.status, INSERTED.created_at
        VALUES (@title, @body, @type, @target, @target_label, @scheduled_at, 'pending')
      `);
    res.status(201).json(ins.recordset[0]);
  } catch (err) {
    console.error("[createScheduled]", err.message);
    res.status(500).json({ error: "Failed to schedule notification" });
  }
};

export const updateScheduledNotification = async (req, res) => {
  try {
    const { title, body, type, target, target_label, scheduled_at } = req.body;
    const pool = await poolPromise;
    const r = pool.request().input("id", sql.Int, req.params.id);
    const sets = [];
    if (title)        { r.input("title",        sql.NVarChar(200),  title);                    sets.push("title=@title"); }
    if (body)         { r.input("body",          sql.NVarChar(2000), body);                     sets.push("body=@body"); }
    if (type)         { r.input("type",          sql.NVarChar(20),   type);                     sets.push("type=@type"); }
    if (target)       { r.input("target",        sql.NVarChar(50),   target);                   sets.push("target=@target"); }
    if (target_label !== undefined) { r.input("target_label", sql.NVarChar(200), target_label); sets.push("target_label=@target_label"); }
    if (scheduled_at) { r.input("scheduled_at",  sql.DateTime2,      new Date(scheduled_at));   sets.push("scheduled_at=@scheduled_at"); }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    const result = await r.query(`UPDATE scheduled_notifications SET ${sets.join(", ")} WHERE schedule_id = @id AND status = 'pending'`);
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: "Scheduled notification not found or already sent" });
    res.json({ message: "Scheduled notification updated" });
  } catch (err) {
    console.error("[updateScheduled]", err.message);
    res.status(500).json({ error: "Failed to update scheduled notification" });
  }
};

export const cancelScheduledNotification = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM scheduled_notifications WHERE schedule_id = @id");
    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ error: "Scheduled notification not found" });
    res.json({ message: "Scheduled notification cancelled" });
  } catch (err) {
    console.error("[cancelScheduled]", err.message);
    res.status(500).json({ error: "Failed to cancel scheduled notification" });
  }
};
