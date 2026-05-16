/**
 * ML Routes — Yalla Transit
 *
 * Base path: /api/ml
 *
 * Delay Prediction:
 *   GET  /delay-prediction          Predict delay for a route + departure time
 *   POST /train                     (admin) Re-train delay model from DB
 *
 * Demand Forecasting:
 *   GET  /demand-forecast           Predict occupancy for one departure slot
 *   GET  /demand-forecast/day       Full-day hourly demand schedule
 *   POST /train-demand              (admin) Re-train demand model from DB
 *
 * Utility:
 *   POST /train-all                 (admin) Re-train both models at once
 *   GET  /model-status              Metadata for both models (no auth)
 */

import express from "express";
import {
  predictDelay,
  trainDelayModel,
  predictDemand,
  forecastDemandDay,
  trainDemandModel,
  trainAll,
  modelStatus,
} from "../controllers/ml.controller.js";
import { requireAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Delay Prediction ──────────────────────────────────────────────────────────

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
 *         schema: { type: integer, example: 1 }
 *         description: Route ID
 *       - in: query
 *         name: departure_time
 *         schema: { type: string, format: date-time }
 *         description: ISO 8601 departure time (defaults to now)
 *     responses:
 *       200:
 *         description: Delay prediction with risk level and contributing factors
 *       400:
 *         description: Missing or invalid query parameters
 */
router.get("/delay-prediction", predictDelay);

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
 *         description: Training summary with sample count and RMSE
 *       403:
 *         description: Admin access required
 */
router.post("/train", requireAdminOnly, trainDelayModel);

// ── Demand Forecasting ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ml/demand-forecast:
 *   get:
 *     tags: [ML]
 *     summary: Predict passenger demand for one departure slot
 *     parameters:
 *       - in: query
 *         name: route_id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: departure_time
 *         schema: { type: string, format: date-time }
 *         description: ISO 8601 departure time (defaults to now)
 *     responses:
 *       200:
 *         description: |
 *           Demand prediction including expected_passengers, occupancy_pct,
 *           demand_level, peak_type, and operational recommendation.
 *       400:
 *         description: Missing or invalid query parameters
 */
router.get("/demand-forecast", predictDemand);

/**
 * @swagger
 * /api/ml/demand-forecast/day:
 *   get:
 *     tags: [ML]
 *     summary: Full-day hourly demand schedule for a route
 *     parameters:
 *       - in: query
 *         name: route_id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-05-20" }
 *         description: Date in YYYY-MM-DD format
 *       - in: query
 *         name: interval
 *         schema: { type: integer, enum: [1, 2], default: 1 }
 *         description: Slot interval in hours
 *     responses:
 *       200:
 *         description: |
 *           Hourly demand schedule with peak_hour, avg_occupancy_pct,
 *           total_expected_passengers, and per-slot breakdown.
 *       400:
 *         description: Missing or invalid query parameters
 */
router.get("/demand-forecast/day", forecastDemandDay);

/**
 * @swagger
 * /api/ml/train-demand:
 *   post:
 *     tags: [ML]
 *     summary: Re-train the demand forecasting model (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Training summary with sample count and RMSE
 *       403:
 *         description: Admin access required
 */
router.post("/train-demand", requireAdminOnly, trainDemandModel);

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ml/train-all:
 *   post:
 *     tags: [ML]
 *     summary: Re-train both models in parallel (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Training summaries for both models
 */
router.post("/train-all", requireAdminOnly, trainAll);

/**
 * @swagger
 * /api/ml/model-status:
 *   get:
 *     tags: [ML]
 *     summary: Get metadata for both ML models
 *     responses:
 *       200:
 *         description: Delay and demand model status including training RMSE and sample counts
 */
router.get("/model-status", modelStatus);

export default router;
