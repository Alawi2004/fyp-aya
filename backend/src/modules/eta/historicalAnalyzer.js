import { sql } from '../../db/db.js';

// Average actual trip duration from GPS logs for a route + time band.
// Looks ±1 hour around the target hour to increase sample size.
// Returns null when there are fewer than 3 matched trips (insufficient data).
export async function getHistoricalStats(pool, routeId, hourOfDay, dayOfWeek) {
  try {
    // SQL Server DATEPART WEEKDAY: 1=Sunday … 7=Saturday (matches JS +1)
    const sqlDay = dayOfWeek + 1;

    const result = await pool
      .request()
      .input('route_id', sql.Int, routeId)
      .input('hour', sql.Int, hourOfDay)
      .input('day', sql.Int, sqlDay)
      .query(`
        SELECT
          AVG(CAST(dur AS FLOAT))  AS avg_min,
          COUNT(*)                 AS samples,
          STDEV(CAST(dur AS FLOAT)) AS std_dev
        FROM (
          SELECT
            DATEDIFF(MINUTE, MIN(g.recorded_at), MAX(g.recorded_at)) AS dur
          FROM   trips t
          JOIN   gps_logs g ON g.trip_id = t.trip_id
          WHERE  t.route_id   = @route_id
            AND  t.status     = 'completed'
            AND  t.start_time >= DATEADD(DAY, -120, GETDATE())
            AND  ABS(DATEPART(HOUR, t.start_time) - @hour) <= 1
            AND  DATEPART(WEEKDAY, t.start_time) = @day
          GROUP  BY t.trip_id
          HAVING COUNT(g.log_id) >= 8
             AND DATEDIFF(MINUTE, MIN(g.recorded_at), MAX(g.recorded_at)) BETWEEN 1 AND 360
        ) d
      `);

    const row = result.recordset[0];
    if (!row || row.samples < 3 || !row.avg_min) return null;

    return {
      avg_min: Math.round(row.avg_min * 10) / 10,
      samples: row.samples,
      std_dev: row.std_dev ? Math.round(row.std_dev * 10) / 10 : 0,
      // Confidence rises linearly: 0.2 at 3 samples → 1.0 at 15+ samples
      confidence: Math.min(1.0, 0.2 + (row.samples - 3) * (0.8 / 12)),
    };
  } catch {
    return null;
  }
}

// 24-hour trip duration profile for a route (for analytics charts).
// Returns [{hour_of_day, avg_min, samples}] sorted by hour.
export async function getRouteHourlyProfile(pool, routeId) {
  try {
    const result = await pool
      .request()
      .input('route_id', sql.Int, routeId)
      .query(`
        SELECT
          hour_of_day,
          AVG(CAST(dur AS FLOAT)) AS avg_min,
          COUNT(*)                AS samples
        FROM (
          SELECT
            DATEPART(HOUR, t.start_time) AS hour_of_day,
            DATEDIFF(MINUTE, MIN(g.recorded_at), MAX(g.recorded_at)) AS dur
          FROM   trips t
          JOIN   gps_logs g ON g.trip_id = t.trip_id
          WHERE  t.route_id   = @route_id
            AND  t.status     = 'completed'
            AND  t.start_time >= DATEADD(DAY, -90, GETDATE())
          GROUP  BY t.trip_id, DATEPART(HOUR, t.start_time)
          HAVING COUNT(g.log_id) >= 8
             AND DATEDIFF(MINUTE, MIN(g.recorded_at), MAX(g.recorded_at)) BETWEEN 1 AND 360
        ) d
        GROUP  BY hour_of_day
        ORDER  BY hour_of_day
      `);

    return result.recordset.map((r) => ({
      hour: r.hour_of_day,
      avg_min: Math.round(r.avg_min * 10) / 10,
      samples: r.samples,
    }));
  } catch {
    return [];
  }
}
