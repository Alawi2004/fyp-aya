import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDriverPerformance,
  getDriverSchedules,
  updateDriverSchedule,
} from "../controllers/drivers.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Drivers
 *   description: Driver profiles and management
 */

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     tags: [Drivers]
 *     summary: Get all drivers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of drivers
 *   post:
 *     tags: [Drivers]
 *     summary: Create a new driver
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, license_number, phone]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mohammed Ali
 *               license_number:
 *                 type: string
 *                 example: LIC-00123
 *               phone:
 *                 type: string
 *                 example: "+96812345678"
 *     responses:
 *       201:
 *         description: Driver created
 */
router.post("/",              requirePermission("drivers", "create"), createDriver);
router.get("/",               requirePermission("drivers", "view"),   getDrivers);
router.get("/performance",    requirePermission("drivers", "view"),   getDriverPerformance);
router.get("/schedules",      requirePermission("drivers", "view"),   getDriverSchedules);
router.put("/:id/schedule",   requirePermission("drivers", "edit"),   updateDriverSchedule);

/**
 * @swagger
 * /api/drivers/{id}:
 *   get:
 *     tags: [Drivers]
 *     summary: Get a driver by ID
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
 *         description: Driver details
 *       404:
 *         description: Driver not found
 *   put:
 *     tags: [Drivers]
 *     summary: Update a driver
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
 *               phone:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.get("/:id",    requirePermission("drivers", "view"),   getDriverById);
router.put("/:id",    requirePermission("drivers", "edit"),   updateDriver);
router.delete("/:id", requirePermission("drivers", "delete"), deleteDriver);

export default router;
