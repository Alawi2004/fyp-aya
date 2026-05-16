import express from "express";
import { getNfcStatus, linkCard, unlinkCard } from "../controllers/nfc.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// All NFC endpoints require the passenger to be authenticated
router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: NFC
 *   description: Passenger NFC card linking for contactless boarding
 */

/**
 * @swagger
 * /api/nfc/status:
 *   get:
 *     tags: [NFC]
 *     summary: Get the authenticated passenger's linked NFC card
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: NFC card status (linked / not linked)
 */
router.get("/status", getNfcStatus);

/**
 * @swagger
 * /api/nfc/link:
 *   post:
 *     tags: [NFC]
 *     summary: Link a scanned NFC card UID to the passenger's account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uid]
 *             properties:
 *               uid:
 *                 type: string
 *                 example: "AB:CD:EF:01"
 *     responses:
 *       201:
 *         description: Card linked successfully
 *       409:
 *         description: UID already linked to another account
 */
router.post("/link", linkCard);

/**
 * @swagger
 * /api/nfc/unlink:
 *   delete:
 *     tags: [NFC]
 *     summary: Unlink the passenger's NFC card
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Card unlinked
 *       404:
 *         description: No active card found
 */
router.delete("/unlink", unlinkCard);

export default router;
