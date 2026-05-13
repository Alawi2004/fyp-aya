import express from "express";
import {
  getWallet,
  getTransactions,
  getTopUpLocations,
  adminTopUpWallet,
  getRechargeAuditLog,
  adminAdjustWallet,
  getAdjustmentHistory,
  getWalletStatuses,
  freezeWallet,
  unfreezeWallet,
  getFreezeLog,
} from "../controllers/wallet.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Passenger wallet balance and transactions
 */

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Get the authenticated passenger's wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance and details
 *       401:
 *         description: Unauthorized
 */
router.get("/", requirePermission("wallet", "view"), getWallet);

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Get the authenticated passenger's transaction history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get("/transactions", requirePermission("wallet", "view"), getTransactions);

/**
 * @swagger
 * /api/wallet/locations:
 *   get:
 *     tags: [Wallet]
 *     summary: Get physical top-up locations (no auth required)
 *     responses:
 *       200:
 *         description: List of top-up locations
 */
router.get("/locations", getTopUpLocations);

/**
 * @swagger
 * /api/wallet/topup:
 *   post:
 *     tags: [Wallet]
 *     summary: Top up a passenger's wallet (admin only)
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
 *                 example: 50.00
 *     responses:
 *       200:
 *         description: Wallet topped up
 *       403:
 *         description: Admin access required
 */
router.post("/topup", requirePermission("wallet", "create"), adminTopUpWallet);

/**
 * @swagger
 * /api/wallet/recharges:
 *   get:
 *     tags: [Wallet]
 *     summary: Get the recharge audit log (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log entries
 *       403:
 *         description: Admin access required
 */
router.get("/recharges",    requirePermission("wallet", "view"), getRechargeAuditLog);
router.post("/adjust",      requirePermission("wallet", "edit"), adminAdjustWallet);
router.get("/adjustments",  requirePermission("wallet", "view"), getAdjustmentHistory);

// ── Freeze management (admin only) ────────────────────────────────────────────
// Static paths must come before /:id/* to avoid wildcard capture.
router.get("/statuses",    requirePermission("wallet", "view"), getWalletStatuses);
router.get("/freeze-log",  requirePermission("wallet", "view"), getFreezeLog);
router.post("/:id/freeze",   requirePermission("wallet", "edit"), freezeWallet);
router.post("/:id/unfreeze", requirePermission("wallet", "edit"), unfreezeWallet);

export default router;
