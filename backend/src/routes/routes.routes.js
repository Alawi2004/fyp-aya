import express from "express";
import {
  getRoutes, getRouteById, updateRoute, createRoute, deleteRoute,
  getRouteStops, assignStopToRoute, updateStopPosition,
  checkRouteOverlap,
  getWaypoints, saveWaypoints,
  getFareZones, createFareZone, updateFareZone, deleteFareZone,
  assignStopToZone, removeStopFromZone,
} from "../controllers/routes.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getMultiTripRoute } from "../controllers/multiTrip.controller.js";
import { getTrafficForecast } from "../controllers/eta.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Routes
 *   description: Bus route definitions and stop assignments
 */

/**
 * @swagger
 * /api/routes:
 *   get:
 *     tags: [Routes]
 *     summary: Get all routes
 *     responses:
 *       200:
 *         description: List of routes
 *   post:
 *     tags: [Routes]
 *     summary: Create a new route
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, origin, destination]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ruwi – Qurum
 *               origin:
 *                 type: string
 *               destination:
 *                 type: string
 *     responses:
 *       201:
 *         description: Route created
 */
router.get("/", getRoutes);

/**
 * @swagger
 * /api/routes/multi-trip:
 *   get:
 *     tags: [Routes]
 *     summary: Find the best multi-trip route between two stops
 *     parameters:
 *       - in: query
 *         name: start_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Origin stop ID
 *       - in: query
 *         name: end_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Destination stop ID
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [fastest, fewest_transfers]
 *           default: fastest
 *     responses:
 *       200:
 *         description: Recommended trip segments
 *       400:
 *         description: No route found
 */
router.get("/multi-trip", getMultiTripRoute);

/**
 * @swagger
 * /api/routes/traffic-forecast:
 *   get:
 *     tags: [Routes]
 *     summary: Get traffic forecast and historical trip stats for a time window
 *     parameters:
 *       - in: query
 *         name: day
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         description: Day of week (0=Sunday). Defaults to today.
 *       - in: query
 *         name: hour
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 23
 *         description: Hour of day. Defaults to current hour.
 *       - in: query
 *         name: route_id
 *         schema:
 *           type: integer
 *         description: Optional route ID for historical GPS stats.
 *     responses:
 *       200:
 *         description: Traffic multiplier, condition, 24-hour forecast, best departure windows
 */
router.get("/traffic-forecast", getTrafficForecast);

router.post("/", createRoute);

/**
 * @swagger
 * /api/routes/{id}:
 *   get:
 *     tags: [Routes]
 *     summary: Get a route by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Route details
 *       404:
 *         description: Route not found
 *   put:
 *     tags: [Routes]
 *     summary: Update a route
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               origin:
 *                 type: string
 *               destination:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.get("/:id",    getRouteById);
router.put("/:id",    requireAuth, updateRoute);
router.delete("/:id", requirePermission("routes", "delete"), deleteRoute);

/**
 * @swagger
 * /api/routes/{route_id}/stops:
 *   get:
 *     tags: [Routes]
 *     summary: Get all stops on a route
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ordered list of stops
 *   post:
 *     tags: [Routes]
 *     summary: Assign a stop to a route
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stop_id, stop_order]
 *             properties:
 *               stop_id:
 *                 type: integer
 *               stop_order:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Stop assigned
 */
router.post("/:route_id/stops", assignStopToRoute);
router.get("/:route_id/stops", getRouteStops);

// ── Stop position update ──────────────────────────────────────────────────────
router.put("/stops/:stop_id/position", updateStopPosition);

// ── Route overlap detection ───────────────────────────────────────────────────
router.get("/:id/overlap", checkRouteOverlap);

// ── Waypoints ─────────────────────────────────────────────────────────────────
router.get("/:id/waypoints",  getWaypoints);
router.post("/:id/waypoints", saveWaypoints);

// ── Fare zones ────────────────────────────────────────────────────────────────
router.get("/:id/fare-zones",                         getFareZones);
router.post("/:id/fare-zones",                        createFareZone);
router.put("/:id/fare-zones/:zoneId",                 updateFareZone);
router.delete("/:id/fare-zones/:zoneId",              deleteFareZone);
router.post("/:id/fare-zones/:zoneId/stops",          assignStopToZone);
router.delete("/:id/fare-zones/:zoneId/stops/:stopId", removeStopFromZone);

export default router;
