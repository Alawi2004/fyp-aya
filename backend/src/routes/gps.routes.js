import express from "express";
import {
  getLatestGps,
  getTripGpsHistory,
  getLiveGps,
  getBusGps,
  getGeofenceAlerts,
} from "../controllers/gps.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: GPS
 *   description: Real-time vehicle location tracking
 */

// Driver GPS ingest is POST /api/driver/location (single write path into gps_logs).

// Named routes must precede /:trip_id/latest to avoid param capture
router.get("/live",                requirePermission("live", "view"), getLiveGps);
router.get("/geofence-alerts",     requireAuth, getGeofenceAlerts);
router.get("/bus/:vehicleId",      requireAuth, getBusGps);
router.get("/trip/:id",            requireAuth, getTripGpsHistory);

/**
 * @swagger
 * /api/gps/{trip_id}/latest:
 *   get:
 *     tags: [GPS]
 *     summary: Get the latest GPS point for a trip
 *     parameters:
 *       - in: path
 *         name: trip_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Latest GPS coordinates
 *       404:
 *         description: No GPS data found for this trip
 */
router.get("/:trip_id/latest", requireAuth, getLatestGps);

export default router;
