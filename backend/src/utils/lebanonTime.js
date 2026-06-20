// Centralised Lebanon (Asia/Beirut, UTC+2/+3 DST) time helpers.
//
// Raw timestamps are stored in UTC; these helpers convert to Lebanon local
// time for anything users perceive as a calendar day / hour: reporting,
// "today" stats, daily limits, peak-hour analytics, and ETA/traffic models.
//
// SQL side uses the Windows zone id "Middle East Standard Time" (= Beirut).
// JS side uses the IANA id "Asia/Beirut".

const IANA = "Asia/Beirut";

// ── SQL fragments (constant strings — safe to interpolate into queries) ───────
// Convert a stored-UTC column to a Beirut datetimeoffset.
const toBeirut = (col) => `${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Middle East Standard Time'`;

// Beirut calendar date of a column, e.g. sqlLocalDate('created_at')
export const sqlLocalDate    = (col) => `CAST(${toBeirut(col)} AS DATE)`;
// Beirut hour-of-day (0–23) of a column
export const sqlLocalHour    = (col) => `DATEPART(HOUR, ${toBeirut(col)})`;
// Beirut weekday (SQL: 1=Sunday … 7=Saturday) of a column
export const sqlLocalWeekday = (col) => `DATEPART(WEEKDAY, ${toBeirut(col)})`;
// Beirut "today" (a DATE)
export const SQL_LOCAL_TODAY = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Middle East Standard Time' AS DATE)";

// ── JS helpers ───────────────────────────────────────────────────────────────
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Beirut hour-of-day (0–23) for a given instant (defaults to now).
export function beirutHour(date = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: IANA, hour: "2-digit", hour12: false }).format(date)
  );
  return h % 24; // some runtimes format midnight as "24"
}

// Beirut day-of-week (0=Sunday … 6=Saturday) for a given instant.
export function beirutDay(date = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: IANA, weekday: "short" }).format(date);
  return WEEKDAYS.indexOf(wd);
}

// Beirut calendar date as "YYYY-MM-DD" for a given instant.
export function beirutDateStr(date = new Date()) {
  // en-CA yields ISO-style yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", { timeZone: IANA }).format(date);
}
