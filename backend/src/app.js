import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";
import cookieParser from "cookie-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Routes
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import driversRoutes from "./routes/drivers.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import tripsRoutes from "./routes/trips.routes.js";
import gpsRoutes from "./routes/gps.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import routesRoutes from "./routes/routes.routes.js";
import stopsRoutes from "./routes/stops.routes.js";
import passengerCountRoutes from "./routes/passengerCount.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import ratingsRoutes from "./routes/ratings.routes.js";
import busesRoutes from "./routes/buses.routes.js";
import driverAppRoutes from "./routes/driverApp.routes.js";
import walletRoutes     from "./routes/wallet.routes.js";
import staffWalletRoutes from "./routes/staffWallet.routes.js";
import staffShiftRoutes from "./routes/staffShift.routes.js";
import staffAdminRoutes  from "./routes/staffAdmin.routes.js";
import bookingsRoutes   from "./routes/bookings.routes.js";
import cameraRoutes     from "./routes/camera.routes.js";
import complaintsRoutes from "./routes/complaints.routes.js";
import passengerRoutes from "./routes/passenger.routes.js";
import reportsRoutes           from "./routes/reports.routes.js";
import scheduledReportsRoutes  from "./routes/scheduledReports.routes.js";
import auditLogRoutes          from "./routes/auditLog.routes.js";
import settingsRoutes          from "./routes/systemSettings.routes.js";
import rolesRoutes             from "./routes/roles.routes.js";
import analyticsRoutes         from "./routes/analytics.routes.js";
import shareTicketRoutes       from "./routes/shareTicket.routes.js";
import mlRoutes                from "./routes/ml.routes.js";
import taxiReservationsRoutes  from "./routes/taxiReservations.routes.js";
import { startReportScheduler } from "./services/reportScheduler.js";
import { poolPromise }          from "./db/db.js";
import { ensureAuthTables, ensureOperationalTables } from "./db/featureSetup.js";
import { maintenanceModeMiddleware } from "./middleware/maintenanceMode.middleware.js";
import { generalLimiter } from "./middleware/rateLimiter.middleware.js";

dotenv.config();

// ── Sentry — must be initialised before express app is created ───────────────
// Only active when SENTRY_DSN is set; silently no-ops in dev without a DSN.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.2,   // 20 % of requests traced — tune for volume
  });
  console.log("[sentry] Error monitoring active");
}

const app = express();

// Sentry request handler — must be FIRST middleware (captures req context for errors)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(helmet({
  // Allow the admin UI to load Leaflet tiles and camera WS from localhost
  crossOriginResourcePolicy:  { policy: "cross-origin" },
  contentSecurityPolicy: false,   // CSP is complex with Leaflet/WS — enable and tune per deployment
}));

// ── CORS — explicit origin allowlist ─────────────────────────────────────────
// Add new origins via ALLOWED_ORIGINS env var (comma-separated) without code changes.
// ADMIN_BASE_URL / STAFF_BASE_URL are already in .env — reuse them here.
const envOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",").map(s => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",          // admin dashboard (dev)
  "http://localhost:5174",          // staff portal (dev)
  process.env.ADMIN_BASE_URL,       // e.g. http://192.168.1.109:5173
  process.env.STAFF_BASE_URL,       // e.g. http://192.168.1.109:5174
  ...envOrigins,
].filter(Boolean));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin header (Postman, mobile apps, curl, SSR)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(Object.assign(new Error(`CORS: origin '${origin}' is not allowed`), { status: 403 }));
  },
  credentials: true,   // needed if cookies are ever introduced; harmless now
}));

app.use(cookieParser());
app.use(express.json());
app.use(generalLimiter);        // 200 req/min per IP — global DoS floor

// Serve uploaded vehicle photos as static files
// In production, point this to Azure Blob Storage or a CDN instead.
const uploadsDir = path.join(__dirname, "../../uploads");
app.use("/uploads", express.static(uploadsDir));

// ── HTTP access logging ───────────────────────────────────────────────────────
// Always log to stdout (picked up by Azure App Service / container logs).
// Also write to logs/access.log so requests survive a pod restart for debugging.
const logsDir = path.join(__dirname, "../../logs");
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const accessStream = fs.createWriteStream(path.join(logsDir, "access.log"), { flags: "a" });
  app.use(morgan("combined", { stream: accessStream }));
} catch { /* log dir not writable in some environments — skip file logging */ }
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(maintenanceModeMiddleware);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/drivers", driversRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/gps", gpsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/stops", stopsRoutes);
app.use("/api/passenger-count", passengerCountRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/buses", busesRoutes);
app.use("/api/driver", driverAppRoutes);
app.use("/api/wallet",        walletRoutes);
app.use("/api/staff/wallet",  staffWalletRoutes);  // staff-only (requireStaffOnly)
app.use("/api/staff/shift",   staffShiftRoutes);
app.use("/api/staff",         staffAdminRoutes);   // admin-only; must come AFTER /api/staff/wallet
app.use("/api/bookings",      bookingsRoutes);
app.use("/api/camera",        cameraRoutes);
app.use("/api/complaints",    complaintsRoutes);
app.use("/api/passenger",          passengerRoutes);
app.use("/api/reports",            reportsRoutes);
app.use("/api/reports/scheduled",  scheduledReportsRoutes);
app.use("/api/audit-logs",         auditLogRoutes);
app.use("/api/settings",           settingsRoutes);
app.use("/api/roles",              rolesRoutes);
app.use("/api/analytics",          analyticsRoutes);
app.use("/api/share",              shareTicketRoutes);
app.use("/api/ml",                 mlRoutes);
app.use("/api/taxi-reservations",  taxiReservationsRoutes);

// Run DB setup batches at startup so login requests don't pay the cold cost
poolPromise.then(pool => {
  if (!pool) return;
  ensureAuthTables(pool).catch(err => console.error("[startup] ensureAuthTables:", err.message));
  ensureOperationalTables(pool).catch(err => console.error("[startup] ensureOperationalTables:", err.message));
});
// Note: geofencing engine is started in server.js after the HTTP server is up.

// Start scheduled report delivery (checks every 30 min)
startReportScheduler();

// API docs — disabled in production to avoid leaking schema to the public
if (process.env.NODE_ENV !== "production") {
  app.use("/api/docs", swaggerUi.serve);
  app.get("/api/docs", swaggerUi.setup(swaggerSpec, { explorer: false }));
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// ── Health check — simple string for root (legacy / load-balancer ping) ──────
app.get("/", (req, res) => {
  res.send("🚍 Yalla Transit API running...");
});

// ── GET /api/health — structured health check used by load balancers + PM2 ──
// Pings the DB and returns 200 ok / 503 degraded so orchestrators can route
// traffic away from an unhealthy instance automatically.
app.get("/api/health", async (req, res) => {
  const started = Date.now();

  // Test DB connectivity
  let dbStatus  = "connected";
  let dbLatency = null;
  let dbError   = null;

  try {
    const pool = await poolPromise;
    const t0   = Date.now();
    await pool.request().query("SELECT 1 AS ping");
    dbLatency = Date.now() - t0;
  } catch (err) {
    dbStatus = "error";
    dbError  = err.message;
  }

  const healthy = dbStatus === "connected";
  const mem     = process.memoryUsage();

  const body = {
    status:    healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime_s:  Math.round(process.uptime()),
    db: {
      status:      dbStatus,
      latency_ms:  dbLatency,
      ...(dbError ? { error: dbError } : {}),
    },
    scheduler: {
      // The report scheduler fires its first check 10 s after startup.
      // If process has been up > 15 s the scheduler has run at least once.
      status: process.uptime() > 15 ? "running" : "starting",
    },
    memory: {
      heap_used_mb:  Math.round(mem.heapUsed  / 1_048_576),
      heap_total_mb: Math.round(mem.heapTotal / 1_048_576),
      rss_mb:        Math.round(mem.rss       / 1_048_576),
    },
    response_ms: Date.now() - started,
  };

  res.status(healthy ? 200 : 503).json(body);
});

// ── Sentry error handler — must be LAST middleware, after all routes ──────────
// Captures any error passed to next(err) with full request context + stack trace.
if (process.env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}

// Generic fallback error handler (runs after Sentry so Sentry captures first)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[unhandled]", err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ error: err.message ?? "Internal server error" });
});

export default app;
