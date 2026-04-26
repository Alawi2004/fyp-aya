import express from "express";
import {
  getPassengerStatus,
  getDriverStatus,
  logPassengerEvent,
  logDriverAlert,
  getPassengerEvents,
  getDriverAlerts,
  getPassengerTrends,
  getCameraHealth,
} from "../controllers/camera.controller.js";

const router = express.Router();

// ── Live status (proxied from Python camera server) ───────────────────────────
router.get("/passenger/status",   getPassengerStatus);   // GET /api/camera/passenger/status
router.get("/driver/status",      getDriverStatus);      // GET /api/camera/driver/status
router.get("/health",             getCameraHealth);      // GET /api/camera/health

// ── DB event log (written by Python camera server) ───────────────────────────
router.post("/passenger-events",  logPassengerEvent);    // POST /api/camera/passenger-events
router.post("/driver-alerts",     logDriverAlert);       // POST /api/camera/driver-alerts

// ── Historical queries ────────────────────────────────────────────────────────
router.get("/passenger-events",   getPassengerEvents);   // GET /api/camera/passenger-events?bus_id=&limit=
router.get("/driver-alerts",      getDriverAlerts);      // GET /api/camera/driver-alerts?bus_id=&limit=
router.get("/passenger/trends",   getPassengerTrends);   // GET /api/camera/passenger/trends?bus_id=&hours=

export default router;
