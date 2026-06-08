import express from "express";
import {
  getRatings,
  createRating,
  getTripRatings,
  getDriverRatings,
} from "../controllers/ratings.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: Passenger trip ratings and feedback
 */

/**
 * @swagger
 * /api/ratings:
 *   get:
 *     tags: [Ratings]
 *     summary: Get all ratings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ratings
 *   post:
 *     tags: [Ratings]
 *     summary: Submit a rating for a trip
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trip_id, user_id, score]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Rating submitted
 */
router.get("/", getRatings);
router.post("/", createRating);

/**
 * @swagger
 * /api/ratings/trip/{trip_id}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get all ratings for a specific trip
 *     parameters:
 *       - in: path
 *         name: trip_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trip ratings
 */
router.get("/driver", getDriverRatings);
router.get("/trip/:trip_id", getTripRatings);
router.get("/:trip_id", getTripRatings);

export default router;
