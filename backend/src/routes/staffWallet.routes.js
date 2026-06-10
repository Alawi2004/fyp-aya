import express from "express";
import {
  searchUser,
  staffTopUpWallet,
  getStaffHistory,
  getStaffStats,
} from "../controllers/staffWallet.controller.js";
import { requireStaffOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Staff Wallet
 *   description: Staff-only wallet top-up and audit endpoints
 */

/**
 * @swagger
 * /api/staff/wallet/search:
 *   get:
 *     tags: [Staff Wallet]
 *     summary: Search for a passenger by name or card number
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term (name, email, or card number)
 *     responses:
 *       200:
 *         description: Matching user records
 *       403:
 *         description: Staff access required
 */
router.get("/search", requireStaffOnly, searchUser);

/**
 * @swagger
 * /api/staff/wallet/topup:
 *   post:
 *     tags: [Staff Wallet]
 *     summary: Top up a passenger's wallet at a kiosk
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, amount]
 *             properties:
 *               user_id:
 *                 type: integer
 *               amount:
 *                 type: number
 *                 format: double
 *                 example: 20.00
 *     responses:
 *       200:
 *         description: Wallet topped up
 *       403:
 *         description: Staff access required
 */
router.post("/topup", requireStaffOnly, staffTopUpWallet);

/**
 * @swagger
 * /api/staff/wallet/history:
 *   get:
 *     tags: [Staff Wallet]
 *     summary: Get the top-up history performed by the authenticated staff member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Top-up history
 *       403:
 *         description: Staff access required
 */
router.get("/history", requireStaffOnly, getStaffHistory);

/**
 * @swagger
 * /api/staff/wallet/stats:
 *   get:
 *     tags: [Staff Wallet]
 *     summary: Get aggregate top-up stats for the authenticated staff member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats including total topped up, transaction count
 *       403:
 *         description: Staff access required
 */
router.get("/stats", requireStaffOnly, getStaffStats);

export default router;
