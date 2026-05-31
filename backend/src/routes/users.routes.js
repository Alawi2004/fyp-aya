import express from "express";
import {
  getAllUsers,
  createUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  getUserTickets,
  getUserNotifications,
  getPassengers,
  suspendUser,
  restoreUser,
  getSuspensionLogs,
  getFavorites,
  addFavorite,
  removeFavorite,
  deleteMyAccount,
} from "../controllers/users.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Passenger and user account management
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
// ── Self-service routes (any authenticated user) ─────────────────────────────
// IMPORTANT: these must come BEFORE /:id to avoid route capture.

router.get("/me/favorites",             requireAuth, getFavorites);
router.post("/me/favorites",            requireAuth, addFavorite);
router.delete("/me/favorites/:routeId", requireAuth, removeFavorite);
router.delete("/me",                    requireAuth, deleteMyAccount);

// ── Admin / permission-gated routes ──────────────────────────────────────────

router.get("/",  requirePermission("users", "view"),   getAllUsers);
router.post("/", requirePermission("users", "create"), createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user's profile
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
 *         description: User profile
 *       404:
 *         description: User not found
 *   put:
 *     tags: [Users]
 *     summary: Update a user's profile
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
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Updated successfully
 */
router.get("/:id",    requirePermission("users", "view"),   getUserProfile);
router.put("/:id",    requirePermission("users", "edit"),   updateUserProfile);
router.delete("/:id", requirePermission("users", "delete"), deleteUser);

/**
 * @swagger
 * /api/users/{id}/tickets:
 *   get:
 *     tags: [Users]
 *     summary: Get all tickets purchased by a user
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
 *         description: List of tickets
 */
router.get("/:id/tickets", requirePermission("users", "view"), getUserTickets);

/**
 * @swagger
 * /api/users/{id}/notifications:
 *   get:
 *     tags: [Users]
 *     summary: Get notifications for a user
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
 *         description: List of notifications
 */
router.get("/:id/notifications",   requirePermission("users", "view"), getUserNotifications);

// ── Passenger-specific ────────────────────────────────────────────────────────

router.get("/passengers/list",    requirePermission("users", "view"), getPassengers);
router.get("/:id/suspension-logs", requirePermission("users", "view"), getSuspensionLogs);
router.post("/:id/suspend",        requirePermission("users", "edit"), suspendUser);
router.post("/:id/restore",        requirePermission("users", "edit"), restoreUser);

export default router;
