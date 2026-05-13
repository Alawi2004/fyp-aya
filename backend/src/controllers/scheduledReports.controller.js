import { poolPromise, sql } from "../db/db.js";
import { ensureAuthTables } from "../db/featureSetup.js";
import { sendScheduledReport } from "../services/email.service.js";

function calcNextSend(frequency, dayOfWeek, hourOfDay) {
  const now  = new Date();
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(hourOfDay);
  if (frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    while (next.getDay() !== (dayOfWeek ?? 1) || next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === "monthly") {
    next.setDate(1); next.setMonth(next.getMonth() + 1);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export const listSchedules = async (req, res) => {
  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);
    const result = await pool.request().query("SELECT * FROM scheduled_reports ORDER BY created_at DESC");
    const rows = result.recordset.map(r => ({ ...r, recipients: JSON.parse(r.recipients) }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
};

export const createSchedule = async (req, res) => {
  const { report_name, report_type, frequency, day_of_week, hour_of_day = 8, recipients, enabled = true } = req.body;
  if (!report_name || !report_type || !frequency || !recipients?.length)
    return res.status(400).json({ error: "report_name, report_type, frequency and recipients are required" });

  try {
    const pool = await poolPromise;
    await ensureAuthTables(pool);
    const nextSend = calcNextSend(frequency, day_of_week, hour_of_day);

    const r = await pool.request()
      .input("report_name",  sql.NVarChar(100), report_name)
      .input("report_type",  sql.NVarChar(50),  report_type)
      .input("frequency",    sql.NVarChar(20),  frequency)
      .input("day_of_week",  sql.Int,           day_of_week ?? null)
      .input("hour_of_day",  sql.Int,           hour_of_day)
      .input("recipients",   sql.NVarChar(sql.MAX), JSON.stringify(recipients))
      .input("enabled",      sql.Bit,           enabled ? 1 : 0)
      .input("next_send_at", sql.DateTime2,     nextSend)
      .input("created_by",   sql.Int,           req.user?.user_id ?? null)
      .query(`
        INSERT INTO scheduled_reports(report_name,report_type,frequency,day_of_week,hour_of_day,recipients,enabled,next_send_at,created_by)
        OUTPUT INSERTED.schedule_id
        VALUES(@report_name,@report_type,@frequency,@day_of_week,@hour_of_day,@recipients,@enabled,@next_send_at,@created_by)
      `);
    res.status(201).json({ schedule_id: r.recordset[0].schedule_id, message: "Schedule created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create schedule" });
  }
};

export const updateSchedule = async (req, res) => {
  const { report_name, report_type, frequency, day_of_week, hour_of_day, recipients, enabled } = req.body;
  try {
    const pool = await poolPromise;
    const nextSend = calcNextSend(frequency, day_of_week, hour_of_day ?? 8);
    await pool.request()
      .input("id",           sql.Int,           req.params.id)
      .input("report_name",  sql.NVarChar(100), report_name)
      .input("report_type",  sql.NVarChar(50),  report_type)
      .input("frequency",    sql.NVarChar(20),  frequency)
      .input("day_of_week",  sql.Int,           day_of_week ?? null)
      .input("hour_of_day",  sql.Int,           hour_of_day ?? 8)
      .input("recipients",   sql.NVarChar(sql.MAX), JSON.stringify(recipients))
      .input("enabled",      sql.Bit,           enabled ? 1 : 0)
      .input("next_send_at", sql.DateTime2,     nextSend)
      .query(`
        UPDATE scheduled_reports SET
          report_name=@report_name, report_type=@report_type, frequency=@frequency,
          day_of_week=@day_of_week, hour_of_day=@hour_of_day, recipients=@recipients,
          enabled=@enabled, next_send_at=@next_send_at
        WHERE schedule_id=@id
      `);
    res.json({ message: "Schedule updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update schedule" });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input("id", sql.Int, req.params.id).query("DELETE FROM scheduled_reports WHERE schedule_id=@id");
    res.json({ message: "Schedule deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
};

export const sendNow = async (req, res) => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().input("id", sql.Int, req.params.id).query("SELECT * FROM scheduled_reports WHERE schedule_id=@id");
    const sched = r.recordset[0];
    if (!sched) return res.status(404).json({ error: "Schedule not found" });

    const recipients = JSON.parse(sched.recipients);
    await sendScheduledReport(recipients, sched.report_type, sched.report_name);

    await pool.request()
      .input("id", sql.Int, req.params.id)
      .input("now", sql.DateTime2, new Date())
      .query("UPDATE scheduled_reports SET last_sent_at=@now WHERE schedule_id=@id");

    res.json({ message: `Report sent to ${recipients.join(", ")}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send report: " + err.message });
  }
};
