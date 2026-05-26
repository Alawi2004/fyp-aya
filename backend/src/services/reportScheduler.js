import { poolPromise, sql } from "../db/db.js";
import { sendScheduledReport } from "./email.service.js";
import { fetchReportData } from "../controllers/scheduledReports.controller.js";

// ─────────────────────────────────────────────────────────────────────────────
// Restart-safe report scheduler
//
// Strategy: instead of setInterval (loses state on restart), we:
//   1. On startup: immediately check for any overdue reports (reports whose
//      next_send_at <= NOW, meaning they were missed while the server was down).
//   2. After every check: query the DB for the earliest next_send_at and
//      setTimeout to that exact moment — no polling, no drift.
//   3. All state lives in the DB (last_sent_at, next_send_at), so restarting
//      the server never loses scheduling information.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_INTERVAL_MS = 30 * 60 * 1000; // check every 30 min if nothing is due
const MIN_DELAY_MS          = 60 * 1000;       // never schedule sooner than 1 min out

let scheduledTimer = null;

function calcNextSend(frequency, dayOfWeek, hourOfDay) {
  const now  = new Date();
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(hourOfDay);

  if (frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    while (next.getDay() !== (dayOfWeek ?? 1) || next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (frequency === "monthly") {
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next;
}

// Send every overdue enabled report and update last_sent_at / next_send_at.
async function checkAndSend() {
  try {
    const pool = await poolPromise;
    if (!pool) return;

    const now    = new Date();
    const result = await pool.request()
      .input("now", sql.DateTime2, now)
      .query(`
        SELECT * FROM scheduled_reports
        WHERE enabled = 1 AND (next_send_at IS NULL OR next_send_at <= @now)
      `);

    for (const report of result.recordset) {
      try {
        const recipients = JSON.parse(report.recipients);
        const { rows, cols } = await fetchReportData(pool, report.report_type);
        await sendScheduledReport(recipients, report.report_type, report.report_name, rows, cols);

        const nextSend = calcNextSend(report.frequency, report.day_of_week, report.hour_of_day);

        await pool.request()
          .input("id",           sql.Int,       report.schedule_id)
          .input("last_sent_at", sql.DateTime2, now)
          .input("next_send_at", sql.DateTime2, nextSend)
          .query(`
            UPDATE scheduled_reports
            SET last_sent_at = @last_sent_at, next_send_at = @next_send_at
            WHERE schedule_id = @id
          `);

        console.log(`[scheduler] Sent "${report.report_name}" → next at ${nextSend.toISOString()}`);
      } catch (err) {
        console.error(`[scheduler] Failed report id=${report.schedule_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[scheduler] checkAndSend error:", err.message);
  }
}

// Query the DB for the next due time and schedule a precise wakeup.
async function scheduleNextWakeup() {
  clearTimeout(scheduledTimer);

  let delayMs = FALLBACK_INTERVAL_MS;

  try {
    const pool = await poolPromise;
    if (pool) {
      const result = await pool.request().query(`
        SELECT MIN(next_send_at) AS earliest
        FROM scheduled_reports
        WHERE enabled = 1 AND next_send_at IS NOT NULL
      `);
      const earliest = result.recordset[0]?.earliest;
      if (earliest) {
        const msUntil = new Date(earliest).getTime() - Date.now();
        delayMs = Math.max(MIN_DELAY_MS, Math.min(msUntil, FALLBACK_INTERVAL_MS));
      }
    }
  } catch {
    // Fall back to default interval if DB is unavailable
  }

  scheduledTimer = setTimeout(async () => {
    await checkAndSend();
    await scheduleNextWakeup(); // reschedule after every run
  }, delayMs);

  const wakeAt = new Date(Date.now() + delayMs).toISOString();
  console.log(`[scheduler] Next wakeup in ${Math.round(delayMs / 60000)} min (at ${wakeAt})`);
}

// Ensure the tracking columns exist (idempotent — safe to run every startup).
async function ensureColumns() {
  try {
    const pool = await poolPromise;
    if (!pool) return;
    await pool.request().query(`
      IF OBJECT_ID('scheduled_reports','U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                       WHERE TABLE_NAME='scheduled_reports' AND COLUMN_NAME='last_sent_at')
          ALTER TABLE scheduled_reports ADD last_sent_at DATETIME2 NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                       WHERE TABLE_NAME='scheduled_reports' AND COLUMN_NAME='next_send_at')
          ALTER TABLE scheduled_reports ADD next_send_at DATETIME2 NULL;
      END
    `);
  } catch (err) {
    console.warn("[scheduler] Could not verify columns:", err.message);
  }
}

export function startReportScheduler() {
  console.log("[scheduler] Starting restart-safe report scheduler");

  // 10 s delay lets the DB pool settle and ensures columns exist before first run.
  scheduledTimer = setTimeout(async () => {
    await ensureColumns();
    await checkAndSend();
    await scheduleNextWakeup();
  }, 10_000);
}
