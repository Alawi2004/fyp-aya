import express from "express";
import {
  createTrip,
  getTrips,
  getTripById,
  updateTripStatus,
  updateTrip,
  getTripsByVehicleType,
  getPassengerLoad,
  getTripConflicts,
  getRecurringSchedules,
  createRecurringSchedule,
  updateRecurringSchedule,
  deleteRecurringSchedule,
  getTimetableTrips,
  getTripDelays,
  getTripChecklists,
  getTripStopArrivals,
} from "../controllers/trips.controller.js";
import { getTripEtaPredictions } from "../controllers/eta.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Trip scheduling and lifecycle
 */

/**
 * @swagger
 * /api/trips:
 *   get:
 *     tags: [Trips]
 *     summary: Get all trips
 *     responses:
 *       200:
 *         description: List of trips
 *   post:
 *     tags: [Trips]
 *     summary: Create a new trip
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicle_id, driver_id, route_id, scheduled_departure]
 *             properties:
 *               vehicle_id:
 *                 type: integer
 *               driver_id:
 *                 type: integer
 *               route_id:
 *                 type: integer
 *               scheduled_departure:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Trip created
 */
router.post("/", requirePermission("trips", "create"), createTrip);
router.get("/", getTrips);

/**
 * @swagger
 * /api/trips/vehicle/{type}:
 *   get:
 *     tags: [Trips]
 *     summary: Get trips filtered by vehicle type
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [bus, minibus]
 *     responses:
 *       200:
 *         description: Filtered list of trips
 */
router.get("/vehicle/:type", getTripsByVehicleType);
router.get("/vehicle-type/:type", getTripsByVehicleType);
router.get("/conflicts",  getTripConflicts);
router.get("/timetable",  getTimetableTrips);
router.get("/recurring",  getRecurringSchedules);
router.post("/recurring", requirePermission("trips", "create"), createRecurringSchedule);
router.put("/recurring/:id",    requirePermission("trips", "edit"), updateRecurringSchedule);
router.delete("/recurring/:id", requirePermission("trips", "delete"), deleteRecurringSchedule);

/**
 * @swagger
 * /api/trips/{id}/load:
 *   get:
 *     tags: [Trips]
 *     summary: Get current passenger load for a trip
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Passenger load data
 */
router.get("/:id/load", getPassengerLoad);
router.get("/:id/passenger-load", getPassengerLoad);

/**
 * @swagger
 * /api/trips/{id}/eta-predictions:
 *   get:
 *     tags: [Trips]
 *     summary: Get real-time ETA predictions for all remaining stops on a trip
 *     description: >
 *       Uses HERE Routing API v8 (live traffic), Beirut traffic model (time-of-day + day-of-week),
 *       and historical GPS data to compute accurate ETAs from the bus's current GPS position.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: ETA predictions with traffic context
 *       404:
 *         description: Trip or route not found
 */
router.get("/:id/eta-predictions", getTripEtaPredictions);

/**
 * @swagger
 * /api/trips/{id}:
 *   get:
 *     tags: [Trips]
 *     summary: Get a trip by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trip details
 *       404:
 *         description: Trip not found
 *
 * /api/trips/{id}/status:
 *   put:
 *     tags: [Trips]
 *     summary: Update trip status
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [scheduled, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.get("/delays",      getTripDelays);
router.get("/checklists",  getTripChecklists);
router.get("/:id/arrivals", getTripStopArrivals);
router.get("/:id", getTripById);
router.put("/:id/status", requirePermission("trips", "edit"), updateTripStatus);
router.put("/:id",        requirePermission("trips", "edit"), updateTrip);

export default router;
