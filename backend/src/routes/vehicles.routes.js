import express from "express";
import {
  createVehicle,
  getVehicles,
  getVehiclesNearby,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehicleDocs,
  updateVehicleDocs,
  getMaintenanceLog,
  addMaintenanceRecord,
  updateMaintenanceRecord,
  getFuelLog,
  addFuelRecord,
  getVehicleFuel,
  uploadVehiclePhoto,
  getVehiclePhotos,
  deleteVehiclePhoto,
} from "../controllers/vehicles.controller.js";
import { requireAdminOnly, requireAuth }  from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permissions.middleware.js";
import { crudLimiter }       from "../middleware/rateLimiter.middleware.js";
import { uploadPhoto }       from "../middleware/upload.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Fleet vehicle management
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get all vehicles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vehicles
 *   post:
 *     tags: [Vehicles]
 *     summary: Register a new vehicle
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plate_number, type, capacity]
 *             properties:
 *               plate_number:
 *                 type: string
 *                 example: BUS-001
 *               type:
 *                 type: string
 *                 enum: [bus, minibus]
 *               capacity:
 *                 type: integer
 *                 example: 40
 *     responses:
 *       201:
 *         description: Vehicle created
 */
router.post("/", crudLimiter,  requirePermission("vehicles", "create"), createVehicle);
router.get("/",               requirePermission("vehicles", "view"),   getVehicles);

/**
 * @swagger
 * /api/vehicles/nearby:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get vehicles near a latitude/longitude within a radius
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius_km
 *         required: false
 *         schema:
 *           type: number
 *           default: 3
 *     responses:
 *       200:
 *         description: Nearby vehicles
 */
router.get("/nearby", requirePermission("vehicles", "view"), getVehiclesNearby);

// Static sub-resource routes — all before /:id to avoid wildcard capture
router.get("/docs",               requireAdminOnly, getVehicleDocs);
router.put("/docs/:plate",        requireAdminOnly, updateVehicleDocs);
router.get("/maintenance",        requireAdminOnly, getMaintenanceLog);
router.post("/maintenance",       requireAdminOnly, addMaintenanceRecord);
router.put("/maintenance/:id",    requireAdminOnly, updateMaintenanceRecord);
router.get("/fuel",               requireAdminOnly, getFuelLog);
router.post("/fuel",              requireAdminOnly, addFuelRecord);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get a vehicle by ID
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
 *         description: Vehicle details
 *       404:
 *         description: Vehicle not found
 *   put:
 *     tags: [Vehicles]
 *     summary: Update vehicle details
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
 *               plate_number:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, maintenance, retired]
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.get("/:id",      requirePermission("vehicles", "view"),   getVehicleById);
router.put("/:id",      crudLimiter, requirePermission("vehicles", "edit"),   updateVehicle);
router.delete("/:id",   crudLimiter, requireAdminOnly,                        deleteVehicle);
router.get("/:id/fuel", requireAdminOnly, getVehicleFuel);

// Photo upload/retrieval — GET is open to any authenticated user (mobile app reads photos)
router.get("/:id/photos",                   requireAuth,      getVehiclePhotos);
router.post("/:id/photos",                  requireAdminOnly, uploadPhoto, uploadVehiclePhoto);
router.delete("/:id/photos/:filename",      requireAdminOnly, deleteVehiclePhoto);

export default router;
