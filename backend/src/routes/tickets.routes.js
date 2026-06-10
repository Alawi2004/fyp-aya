import express from "express";
import {
  getTickets,
  getTicketsByTrip,
  bookTicket,
} from "../controllers/tickets.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: Ticket booking and lookup
 */

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     tags: [Tickets]
 *     summary: Get all tickets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tickets
 *   post:
 *     tags: [Tickets]
 *     summary: Book a ticket
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, user_id]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               seat_number:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Ticket booked
 *       400:
 *         description: Trip full or invalid
 */
router.get("/", requirePermission("tickets", "view"), getTickets);

/**
 * @swagger
 * /api/tickets/book:
 *   post:
 *     tags: [Tickets]
 *     summary: Book a ticket (alias)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, user_id]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Ticket booked
 */
router.post("/book", requirePermission("tickets", "create"), bookTicket);

/**
 * @swagger
 * /api/tickets/trip/{id}:
 *   get:
 *     tags: [Tickets]
 *     summary: Get all tickets for a specific trip
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of tickets for the trip
 */
router.get("/trip/:id", requirePermission("tickets", "view"),   getTicketsByTrip);
router.post("/",        requirePermission("tickets", "create"), bookTicket);

export default router;
