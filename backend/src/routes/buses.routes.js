import express from "express";
import {
  getBuses,
  getBusById,
  getBusLocation,
  getBusRoute,
} from "../controllers/buses.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Buses
 *   description: Live bus tracking for passengers
 */

/**
 * @swagger
 * /api/buses:
 *   get:
 *     tags: [Buses]
 *     summary: Get all active buses
 *     responses:
 *       200:
 *         description: List of buses
 */
router.get("/", getBuses);

/**
 * @swagger
 * /api/buses/{id}:
 *   get:
 *     tags: [Buses]
 *     summary: Get details of a specific bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bus details
 *       404:
 *         description: Bus not found
 */
router.get("/:id", getBusById);

/**
 * @swagger
 * /api/buses/{id}/location:
 *   get:
 *     tags: [Buses]
 *     summary: Get the current GPS location of a bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Current latitude and longitude
 */
router.get("/:id/location", getBusLocation);

/**
 * @swagger
 * /api/buses/{id}/route:
 *   get:
 *     tags: [Buses]
 *     summary: Get the route assigned to a bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Route with ordered stops
 */
router.get("/:id/route", getBusRoute);

export default router;
