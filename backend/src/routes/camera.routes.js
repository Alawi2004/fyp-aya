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

/**
 * @swagger
 * tags:
 *   name: Camera
 *   description: AI camera system — passenger counting and driver behaviour monitoring
 */

/**
 * @swagger
 * /api/camera/passenger/status:
 *   get:
 *     tags: [Camera]
 *     summary: Get live passenger status from the camera server
 *     responses:
 *       200:
 *         description: Current occupancy count and status
 *       502:
 *         description: Camera server unavailable
 */
router.get("/passenger/status", getPassengerStatus);

/**
 * @swagger
 * /api/camera/driver/status:
 *   get:
 *     tags: [Camera]
 *     summary: Get live driver behaviour status from the camera server
 *     responses:
 *       200:
 *         description: Current driver alert status
 *       502:
 *         description: Camera server unavailable
 */
router.get("/driver/status", getDriverStatus);

/**
 * @swagger
 * /api/camera/health:
 *   get:
 *     tags: [Camera]
 *     summary: Check camera system health
 *     responses:
 *       200:
 *         description: Health status of both camera services
 */
router.get("/health", getCameraHealth);

/**
 * @swagger
 * /api/camera/passenger-events:
 *   post:
 *     tags: [Camera]
 *     summary: Log a passenger boarding/alighting event (called by Python camera server)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bus_id, event_type, count]
 *             properties:
 *               bus_id:
 *                 type: integer
 *               event_type:
 *                 type: string
 *                 enum: [board, alight]
 *               count:
 *                 type: integer
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Event logged
 *   get:
 *     tags: [Camera]
 *     summary: Query logged passenger events
 *     parameters:
 *       - in: query
 *         name: bus_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of passenger events
 */
router.post("/passenger-events", logPassengerEvent);
router.get("/passenger-events", getPassengerEvents);

/**
 * @swagger
 * /api/camera/driver-alerts:
 *   post:
 *     tags: [Camera]
 *     summary: Log a driver behaviour alert (called by Python camera server)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bus_id, alert_type]
 *             properties:
 *               bus_id:
 *                 type: integer
 *               alert_type:
 *                 type: string
 *                 enum: [phone_use, drowsiness, distraction]
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high]
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Alert logged
 *   get:
 *     tags: [Camera]
 *     summary: Query driver alerts
 *     parameters:
 *       - in: query
 *         name: bus_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of driver alerts
 */
router.post("/driver-alerts", logDriverAlert);
router.get("/driver-alerts", getDriverAlerts);

/**
 * @swagger
 * /api/camera/passenger/trends:
 *   get:
 *     tags: [Camera]
 *     summary: Get hourly passenger trend data for a bus
 *     parameters:
 *       - in: query
 *         name: bus_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to look back
 *     responses:
 *       200:
 *         description: Trend data grouped by hour
 */
router.get("/passenger/trends", getPassengerTrends);

export default router;
