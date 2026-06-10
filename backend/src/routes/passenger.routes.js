import express from "express";
import { getPassengerQr } from "../controllers/passengerQr.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Passenger
 *   description: Passenger-only authenticated features
 */

/**
 * @swagger
 * /api/passenger/qr:
 *   get:
 *     tags: [Passenger]
 *     summary: Generate a short-lived signed passenger boarding QR token
 *     description: Returns an HMAC-signed QR token that expires after 60 seconds and revokes any previously active passenger QR to reduce replay risk.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rotating QR token generated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Passenger access only
 */
router.get("/qr", requireAuth, getPassengerQr);

export default router;
