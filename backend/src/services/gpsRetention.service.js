/**
 * GPS-log retention job — Yalla Transit
 *
 * gps_logs grows by a row every couple of seconds per active trip, so it must
 * be pruned. This job deletes points older than `gps.history_retention_days`
 * (system_settings, default 90) once on startup and every 24 h thereafter.
 *
 * Deletes are batched (TOP 5000) so a large backlog never holds a long
 * transaction or escalates to a table lock.
 */
import { poolPromise, sql } from "../db/db.js";

const DAY_MS      = 24 * 60 * 60 * 1000;
const BATCH_SIZE  = 5000;
let   _started    = false;

async function getRetentionDays(pool) {
  try {
    const r = await pool.request().query(
      "SELECT setting_value FROM system_settings WHERE setting_key='gps.history_retention_days'"
    );
    const n = parseInt(r.recordset[0]?.setting_value ?? "90", 10);
    return Number.isFinite(n) && n > 0 ? n : 90;
  } catch {
    return 90;
  }
}

async function purgeOldGpsLogs() {
  const pool = await poolPromise;
  const days = await getRetentionDays(pool);

  let total = 0;
  let affected = 0;
  do {
    const res = await pool.request()
      .input("days", sql.Int, days)
      .query(`
        DELETE TOP (${BATCH_SIZE}) FROM gps_logs
        WHERE recorded_at < DATEADD(day, -@days, GETUTCDATE())
      `);
    affected = res.rowsAffected[0] ?? 0;
    total   += affected;
  } while (affected === BATCH_SIZE);

  if (total) console.log(`[gps-retention] purged ${total} gps_logs older than ${days} days`);
}

/**
 * Start the daily GPS-log purge. Safe to call once; subsequent calls are ignored.
 */
export function startGpsRetentionJob() {
  if (_started) return;
  _started = true;

  const run = () =>
    purgeOldGpsLogs().catch(err => console.warn("[gps-retention] purge error:", err.message));

  run();                       // initial purge on startup
  setInterval(run, DAY_MS);    // daily thereafter
  console.log("[gps-retention] job started — daily purge of old GPS logs");
}

export { purgeOldGpsLogs };
