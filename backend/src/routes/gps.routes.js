import express from "express";
import {
  sendGpsLocation,
  getLatestGps,
  getTripGpsHistory,
  getLiveGps,
  getBusGps,
} from "../controllers/gps.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: GPS
 *   description: Real-time vehicle location tracking
 */

/**
 * @swagger
 * /api/gps:
 *   post:
 *     tags: [GPS]
 *     summary: Send a GPS location update from a driver
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, latitude, longitude]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               latitude:
 *                 type: number
 *                 format: double
 *                 example: 23.5880
 *               longitude:
 *                 type: number
 *                 format: double
 *                 example: 58.3829
 *     responses:
 *       200:
 *         description: Location recorded
 */
router.post("/", sendGpsLocation);

// Named routes must precede /:trip_id/latest to avoid param capture
router.get("/live",          getLiveGps);
router.get("/bus/:vehicleId", getBusGps);
router.get("/trip/:id",      getTripGpsHistory);

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
router.get("/:trip_id/latest", getLatestGps);

export default router;
