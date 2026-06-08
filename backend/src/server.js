import http  from "http";
import sql   from "mssql";
import app   from "./app.js";
import { attachWebSocket }       from "./services/gps.stream.service.js";
import { startGeofencingEngine } from "./services/geofencing.service.js";
import { poolPromise }           from "./db/db.js";

const PORT = process.env.PORT || 4000;

// Last-resort safety net — log and keep running instead of crashing the
// whole process on a stray unhandled rejection or thrown error in a
// background task (consistent with this server's "stay alive" design).
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
});

// Create a bare HTTP server so we can attach WebSocket alongside Express
const server = http.createServer(app);

// Attach WebSocket server at /gps-stream
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket GPS stream at ws://localhost:${PORT}/gps-stream`);
});

// Start server-side geofencing engine after the DB pool is ready
poolPromise
  .then(() => startGeofencingEngine())
  .catch(err => console.error("[startup] geofencing engine failed to start:", err.message));

// ── Legacy test + DB-table-list endpoints ─────────────────────────────────────
// (kept for dev convenience / health-check scripts)

app.get("/api/test", (req, res) => {
  res.json({
    status:  "success",
    message: "Backend API is working 🚀",
    time:    new Date(),
  });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const pool   = await sql.connect(process.env.SQL_CONNECTION_STRING);
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM   INFORMATION_SCHEMA.TABLES
      WHERE  TABLE_TYPE = 'BASE TABLE'
      ORDER  BY TABLE_SCHEMA, TABLE_NAME;
    `);
    res.json({ success: true, tables: result.recordset });
  } catch (error) {
    console.error("DB test error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
