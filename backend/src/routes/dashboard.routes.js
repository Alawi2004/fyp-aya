import express from "express";
import {
  getTripsDashboard,
  getDashboardStats,
  getDashboardOverview,
  getEmergencyAlerts,
  getAdminIssues,
} from "../controllers/dashboard.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAdminOnly);

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Admin-only analytics and overview endpoints
 */

/**
 * @swagger
 * /api/dashboard/trips:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get trips summary for the dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trip analytics data
 *       403:
 *         description: Admin access required
 */
router.get("/trips", getTripsDashboard);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get overall system statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System stats (users, vehicles, trips, revenue)
 *       403:
 *         description: Admin access required
 */
router.get("/stats", getDashboardStats);

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get a combined dashboard overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview data
 *       403:
 *         description: Admin access required
 */
router.get("/overview", getDashboardOverview);
router.get("/emergency-alerts", getEmergencyAlerts);
router.get("/issues",           getAdminIssues);

export default router;
