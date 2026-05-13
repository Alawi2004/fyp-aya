import express from "express";
import { getPassengerHeatmap, getGpsHeatmap } from "../controllers/analytics.controller.js";
import { requirePermission } from "../middleware/permissions.middleware.js";

const router = express.Router();

router.get("/passenger-heatmap", requirePermission("analytics", "view"), getPassengerHeatmap);
router.get("/gps-heatmap",       requirePermission("live",      "view"), getGpsHeatmap);

export default router;
