import express from "express";
import {
  recordPassengerCount,
  getPassengerCountsByTrip,
} from "../controllers/passengerCount.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Passenger Count
 *   description: Camera-based passenger count events per trip
 */

/**
 * @swagger
 * /api/passenger-count:
 *   post:
 *     tags: [Passenger Count]
 *     summary: Record a passenger count snapshot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, count]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               count:
 *                 type: integer
 *                 example: 23
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Count recorded
 */
router.post("/", recordPassengerCount);

/**
 * @swagger
 * /api/passenger-count/{trip_id}:
 *   get:
 *     tags: [Passenger Count]
 *     summary: Get all passenger count records for a trip
 *     parameters:
 *       - in: path
 *         name: trip_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of count snapshots
 */
router.get("/:trip_id", getPassengerCountsByTrip);

export default router;
