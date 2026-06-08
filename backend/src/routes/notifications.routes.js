import express from "express";
import {
  getAllNotifications,
  markNotificationRead,
  createNotification,
  updateNotification,
  deleteNotification,
  getUserNotifications,
  getTemplates,
  createTemplateDb,
  updateTemplateDb,
  deleteTemplateDb,
  getScheduledNotifications,
  createScheduledNotification,
  updateScheduledNotification,
  cancelScheduledNotification,
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
router.get("/",    getAllNotifications);
router.post("/",   requirePermission("notifications", "create"), createNotification);

// ── Specific sub-paths BEFORE /:id catch-alls ─────────────────────────────────
router.put("/:id/read",         markNotificationRead);
router.get("/user/:user_id",    getUserNotifications);

// ── Templates (must be before /:id so /templates/:id is not swallowed) ────────
router.get("/templates",        getTemplates);
router.post("/templates",       requirePermission("notifications", "create"), createTemplateDb);
router.put("/templates/:id",    requirePermission("notifications", "edit"),   updateTemplateDb);
router.delete("/templates/:id", requirePermission("notifications", "delete"), deleteTemplateDb);

// ── Scheduled notifications ───────────────────────────────────────────────────
router.get("/scheduled",        getScheduledNotifications);
router.post("/schedule",        requirePermission("notifications", "create"), createScheduledNotification);
router.put("/scheduled/:id",    requirePermission("notifications", "edit"),   updateScheduledNotification);
router.delete("/scheduled/:id", requirePermission("notifications", "delete"), cancelScheduledNotification);

// ── Generic /:id catch-alls last ──────────────────────────────────────────────
router.put("/:id",    requirePermission("notifications", "edit"),   updateNotification);
router.delete("/:id", requirePermission("notifications", "delete"), deleteNotification);

export default router;
