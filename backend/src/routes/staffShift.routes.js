import express from "express";
import {
  closeStaffShift,
  getCurrentStaffShift,
  openStaffShift,
  getShiftHistory,
} from "../controllers/staffShift.controller.js";
import { requireStaffOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireStaffOnly);

/**
 * @swagger
 * tags:
 *   name: Staff Shift
 *   description: Staff shift opening and cash reconciliation endpoints
 */

/**
 * @swagger
 * /api/staff/shift/open:
 *   post:
 *     tags: [Staff Shift]
 *     summary: Open a staff shift with starting cash
 *     security:
 *       - bearerAuth: []
 */
router.post("/open", openStaffShift);

/**
 * @swagger
 * /api/staff/shift/close:
 *   post:
 *     tags: [Staff Shift]
 *     summary: Close a staff shift and return a cash summary
 *     security:
 *       - bearerAuth: []
 */
router.post("/close", closeStaffShift);

/**
 * @swagger
 * /api/staff/shift/current:
 *   get:
 *     tags: [Staff Shift]
 *     summary: Get the currently open shift for the authenticated staff user
 *     security:
 *       - bearerAuth: []
 */
router.get("/current", getCurrentStaffShift);
router.get("/history", getShiftHistory);

export default router;
