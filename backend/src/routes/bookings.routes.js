import express from "express";
import {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  verifyTicket,
} from "../controllers/bookings.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Advance seat bookings and ticket verification
 */

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Get all bookings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookings
 *   post:
 *     tags: [Bookings]
 *     summary: Create a new booking
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, user_id, seats]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               seats:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Booking confirmed
 *       400:
 *         description: Not enough seats or invalid trip
 */
router.get("/", requireAuth, getBookings);
router.post("/", requireAuth, createBooking);

/**
 * @swagger
 * /api/bookings/verify:
 *   post:
 *     tags: [Bookings]
 *     summary: Verify a ticket QR code at boarding
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: QR code token from the ticket
 *     responses:
 *       200:
 *         description: Ticket is valid
 *       400:
 *         description: Invalid or expired ticket
 */
router.post("/verify", verifyTicket);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get a booking by ID
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
 *         description: Booking details
 *       404:
 *         description: Booking not found
 *   delete:
 *     tags: [Bookings]
 *     summary: Cancel a booking
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
 *         description: Booking cancelled
 */
router.get("/:id", getBookingById);
router.delete("/:id", requireAuth, cancelBooking);

export default router;
