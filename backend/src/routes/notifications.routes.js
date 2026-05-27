import express from "express";
import {
  getAllNotifications,
  markNotificationRead,
  createNotification,
  getUserNotifications,
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notifications and alerts
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get all notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 *   post:
 *     tags: [Notifications]
 *     summary: Create a new notification
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, message]
 *             properties:
 *               user_id:
 *                 type: integer
 *               message:
 *                 type: string
 *                 example: Your bus departs in 5 minutes.
 *               type:
 *                 type: string
 *                 example: trip_reminder
 *     responses:
 *       201:
 *         description: Notification created
 */
router.get("/", getAllNotifications);
router.post("/", requirePermission("notifications", "create"), createNotification);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
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
 *         description: Notification marked as read
 */
router.put("/:id/read", markNotificationRead);

/**
 * @swagger
 * /api/notifications/user/{user_id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications for a specific user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User's notifications
 */
router.get("/user/:user_id", getUserNotifications);

export default router;
