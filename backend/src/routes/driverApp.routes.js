import express from "express";
import {
  getDriverTrips,
  startTrip,
  completeTrip,
  getTripPassengers,
  getDriverEarnings,
  reportIssue,
  sendEmergency,
  updateLocation,
  submitChecklist,
  scanPassengerQr,
  markStopArrival,
} from "../controllers/driverApp.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Driver App
 *   description: Mobile driver app endpoints
 */

/**
 * @swagger
 * /api/driver/trips:
 *   get:
 *     tags: [Driver App]
 *     summary: Get trips assigned to the authenticated driver
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned trips
 */
router.get("/trips", getDriverTrips);

/**
 * @swagger
 * /api/driver/trips/{id}/start:
 *   put:
 *     tags: [Driver App]
 *     summary: Start a trip
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trip started
 */
router.put("/trips/:id/start", startTrip);

/**
 * @swagger
 * /api/driver/trips/{id}/complete:
 *   put:
 *     tags: [Driver App]
 *     summary: Mark a trip as completed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trip completed
 */
router.put("/trips/:id/complete", completeTrip);
router.post("/trips/:id/checklist", submitChecklist);

/**
 * @swagger
 * /api/driver/trips/{id}/passengers:
 *   get:
 *     tags: [Driver App]
 *     summary: Get the passenger manifest for a trip
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Passenger list
 */
router.get("/trips/:id/passengers", getTripPassengers);

/**
 * @swagger
 * /api/driver/earnings:
 *   get:
 *     tags: [Driver App]
 *     summary: Get earnings summary for the authenticated driver
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings data
 */
router.get("/earnings", getDriverEarnings);

/**
 * @swagger
 * /api/driver/issues:
 *   post:
 *     tags: [Driver App]
 *     summary: Report a vehicle or safety issue
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, description]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Issue reported
 */
router.post("/issues", reportIssue);

/**
 * @swagger
 * /api/driver/emergency:
 *   post:
 *     tags: [Driver App]
 *     summary: Send an emergency alert
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
 *               longitude:
 *                 type: number
 *                 format: double
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Emergency alert sent
 */
router.post("/emergency", sendEmergency);

/**
 * @swagger
 * /api/driver/location:
 *   post:
 *     tags: [Driver App]
 *     summary: Update the driver's current GPS location
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
 *               longitude:
 *                 type: number
 *                 format: double
 *     responses:
 *       200:
 *         description: Location updated
 */
router.post("/location", updateLocation);
router.post("/scan-qr", scanPassengerQr);
router.post("/trips/:id/stops/:stopId/arrive", markStopArrival);

export default router;
