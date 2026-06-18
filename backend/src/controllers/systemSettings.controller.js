import { poolPromise, sql } from "../db/db.js";
import { ensureAuthTables } from "../db/featureSetup.js";
import { invalidateSettingsCache } from "../db/settingsCache.js";

// ── GET /api/settings  (all) or  /api/settings?category=fare ─────────────────
export const getSettings = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);

    const request = pool.request();
    let where = "WHERE 1=1";

    if (req.query.category) {
      request.input("cat", sql.NVarChar(50), req.query.category);
      where += " AND category=@cat";
    }

    const result = await request.query(
      `SELECT setting_key, setting_value, category, label, description, value_type, updated_at FROM system_settings ${where} ORDER BY category, setting_key`
    );

    // Return as a flat key→value map AND as a categorised array
    const flat = {};
    const categorised = {};
    for (const row of result.recordset) {
      flat[row.setting_key] = row.setting_value;
      if (!categorised[row.category]) categorised[row.category] = [];
      categorised[row.category].push(row);
    }

    res.json({ flat, categorised, rows: result.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

// ── PUT /api/settings  — bulk upsert { key: value, … } ───────────────────────
export const updateSettings = async (req, res) => {
  const updates = req.body; // { "fare.base_fare": "1.50", ... }
  if (!updates || typeof updates !== "object" || Array.isArray(updates))
    return res.status(400).json({ error: "Body must be a key-value object" });

  const adminId = req.user?.user_id ?? null;

  try {
    const pool = await poolPromise;
    const now  = new Date();

    for (const [key, value] of Object.entries(updates)) {
      await pool.request()
        .input("key",        sql.NVarChar(100),      key)
        .input("value",      sql.NVarChar(sql.MAX),   String(value))
        .input("updated_at", sql.DateTime2,           now)
        .input("updated_by", sql.Int,                 adminId)
        .query(`
          IF EXISTS (SELECT 1 FROM system_settings WHERE setting_key=@key)
            UPDATE system_settings SET setting_value=@value, updated_at=@updated_at, updated_by=@updated_by WHERE setting_key=@key
          ELSE
            INSERT INTO system_settings(setting_key, setting_value, category, value_type, updated_at, updated_by)
            VALUES(@key, @value, 'custom', 'string', @updated_at, @updated_by)
        `);
    }

    invalidateSettingsCache();
    res.json({ message: "Settings updated", count: Object.keys(updates).length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

// ── GET /api/settings/public — no auth, returns safe app.* and wallet.* keys ──
export const getPublicSettings = async (req, res) => {
  const DEFAULTS = {
    "app.name":             "Yalla Transit",
    "app.support_phone":    "+961 1 999 000",
    "app.support_email":    "support@yallatransit.lb",
    "app.language":         "en",
    "wallet.max_balance":       "1000",
    "wallet.min_topup":         "5",
    "wallet.max_topup":         "500",
    "wallet.low_balance_alert": "5",
    "gps.update_interval_sec":  "10",
    "gps.stale_threshold_sec":  "60",
    "gps.geofence_radius_m":    "150",
  };
  try {
    const pool = await poolPromise;
    const keys = Object.keys(DEFAULTS);
    const result = await pool.request().query(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('${keys.join("','")}')`
    );
    // Start from defaults so missing DB rows always return a value
    const flat = { ...DEFAULTS };
    for (const row of result.recordset) flat[row.setting_key] = row.setting_value;
    res.json(flat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch public settings" });
  }
};

// ── GET /api/settings/:key ────────────────────────────────────────────────────
export const getSetting = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request()
      .input("key", sql.NVarChar(100), req.params.key)
      .query("SELECT setting_key, setting_value, label, value_type FROM system_settings WHERE setting_key=@key");

    if (!result.recordset[0]) return res.status(404).json({ error: "Setting not found" });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch setting" });
  }
};
