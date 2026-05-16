import { poolPromise, sql } from "../db/db.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// ─────────────────────────────────────────────────────────────────────────────
// Fetch push tokens for a target group and deliver via Expo push service.
// Runs fire-and-forget — errors are logged, not surfaced to the API caller.
// ─────────────────────────────────────────────────────────────────────────────
async function _sendPush(pool, target, title, body, specificUserId = null) {
  try {
    let rows;
    if (specificUserId) {
      rows = (await pool.request()
        .input("uid", sql.Int, specificUserId)
        .query("SELECT push_token FROM users WHERE user_id = @uid AND push_token IS NOT NULL")
      ).recordset;
    } else {
      const roleClause =
        target === "all_passengers" ? "role = 'passenger'" :
        target === "all_drivers"    ? "role = 'driver'"    : "1=1";
      rows = (await pool.request()
        .query(`SELECT push_token FROM users WHERE push_token IS NOT NULL AND ${roleClause}`)
      ).recordset;
    }

    const messages = rows
      .map((r) => r.push_token)
      .filter((t) => Expo.isExpoPushToken(t))
      .map((to) => ({ to, sound: "default", title, body, channelId: "default" }));

    if (messages.length === 0) return;

    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (e) {
        console.warn("[push] chunk error:", e.message);
      }
    }
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
        ISNULL(title,   LEFT(ISNULL(message,''), 80))  AS title,
        ISNULL(body,    ISNULL(message,''))             AS body,
        ISNULL(message, '')                              AS message,
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
// GET /api/notifications/user/:user_id
// ─────────────────────────────────────────────────────────────────────────────
export const getUserNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("uid", sql.Int, req.params.user_id)
      .query(`
        SELECT notification_id, message, is_read, created_at
        FROM notifications
        WHERE user_id = @uid
        ORDER BY created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user notifications" });
  }
};
