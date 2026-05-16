import express from "express";
import { trainModel, predictDelay, modelStatus } from "../controllers/ml.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ML
 *   description: Delay prediction machine-learning model
 */

/**
 * @swagger
 * /api/ml/delay-prediction:
 *   get:
 *     tags: [ML]
 *     summary: Predict expected delay for a route departure
 *     parameters:
 *       - in: query
 *         name: route_id
 *         required: true
 *         schema: { type: integer }
 *         description: Route ID to predict delay for
 *       - in: query
 *         name: departure_time
 *         schema: { type: string, format: date-time }
 *         description: ISO 8601 departure time (defaults to now)
 *     responses:
 *       200:
 *         description: Delay prediction result
 */
router.get("/delay-prediction", predictDelay);

/**
 * @swagger
 * /api/ml/model-status:
 *   get:
 *     tags: [ML]
 *     summary: Get current model training metadata
 *     responses:
 *       200:
 *         description: Model metadata
 */
router.get("/model-status", modelStatus);

/**
 * @swagger
 * /api/ml/train:
 *   post:
 *     tags: [ML]
 *     summary: Re-train the delay prediction model (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Training result with sample count and RMSE
 *       403:
 *         description: Admin access required
 */
router.post("/train", requireAdminOnly, trainModel);

export default router;
